//! The I Love Lawyer desktop app: a native shell (Tauri) around the Next.js web app.
//!
//! The web app owns everything about cases, documents and the API. This Rust side only does what
//! a browser tab can't: open real OS windows, place them on specific monitors, and notice other
//! apps' windows. New here? Read `docs/desktop/getting-started.md` first.
//!
//! ## Where things live
//!
//! | File               | What it does                                                        |
//! |--------------------|---------------------------------------------------------------------|
//! | `lib.rs` (this)    | Startup: registers everything with Tauri and opens the first window |
//! | `config.rs`        | Settings read from `src-tauri/.env`                                 |
//! | `sidecar.rs`       | Starts/waits for the web server the windows load                    |
//! | `shell.rs`         | Shared window helpers, id checks, the dashboard (`main`) window     |
//! | `monitors.rs`      | Choosing which screen a window opens on                             |
//! | `case_terminal.rs` | Command: open a case's Terminal window                              |
//! | `panels.rs`        | Command: pop a panel out into its own window; closing rules         |
//! | `docking.rs`       | Command + logic: dock a panel beside another app's window           |
//! | `popups.rs`        | New windows/tabs: Google sign-in in-app, links → default browser   |
//! | `deep_links.rs`    | `ilovelawyer://` links — a browser handing its sign-in to this app  |
//! | `tenant_site.rs`   | Which site (UK/PH) the app opens on — remembers the last one        |
//! | `window_intel/`    | Watching *other* apps' windows (Windows API)                        |
//!
//! A **command** is a Rust function the web page can call (marked `#[tauri::command]`). An
//! **event** is a message Rust sends to the page (`app.emit(...)`). Both are reached from the web
//! side only through `apps/web/lib/desktop/index.ts`.

// Each `mod` line pulls in the file of the same name (or the folder, for `window_intel`).
mod case_terminal;
mod config;
mod deep_links;
mod docking;
mod monitors;
mod panels;
mod popups;
mod shell;
mod sidecar;
mod tenant_site;
mod window_intel;

// `Manager` is a *trait*: importing it is what makes methods like `window.app_handle()` available.
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;

use config::Config;
use deep_links::PendingLink;
use panels::PanelWindows;
use shell::{Shell, MAIN_WINDOW_LABEL};
use sidecar::SidecarProcess;

/// Starts the app. Called from `main.rs`.
///
/// Reading top to bottom: register shared state (`.manage`), register the commands the page may
/// call (`.invoke_handler`), react to windows closing (`.on_window_event`), then once Tauri is
/// ready (`.setup`) start the web server if needed and open the dashboard.
pub fn run() {
    let config = Config::load();
    let base_url = config.base_url();
    let frontend_port = config.frontend_port;
    let window_title = config.window_title;
    let is_remote = config.frontend_url.is_some();

    tauri::Builder::default()
        // Must be the first plugin. Clicking an `ilovelawyer://` link while the app is open makes
        // Windows start a second copy; this stops it and passes the link to the running one
        // (through the deep-link plugin below — see deep_links.rs). Also brings the window forward.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        // Shared state. Any command can ask for these by type, e.g. `State<'_, Shell>`.
        .manage(SidecarProcess::default())
        .manage(PanelWindows::default())
        .manage(PendingLink::default())
        .manage(Shell { base_url: base_url.clone(), window_title: window_title.clone() })
        // Every command must be listed here — and in build.rs and capabilities/default.json —
        // or the page can't call it. See docs/desktop/adding-features.md §3.
        .invoke_handler(tauri::generate_handler![
            case_terminal::open_case_terminal,
            panels::open_panel_window,
            docking::current_dock_target,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                // Closing the dashboard quits the app (which also stops the sidecar — see the
                // Exit handler below). Anything else might own or be a popped-out panel.
                if window.label() == MAIN_WINDOW_LABEL {
                    window.app_handle().exit(0);
                } else {
                    panels::handle_panel_windows_on_destroy(window.app_handle(), window.label());
                }
            }
        })
        .setup(move |app| {
            window_intel::start(app.handle().clone());

            // `ilovelawyer://` links (a browser handing over its sign-in — see deep_links.rs).
            // register_all writes the scheme to the Windows registry, so links reach even a
            // `tauri dev` build; the installer registers it too. Best-effort: without it, only
            // that one feature is missing.
            #[cfg(windows)]
            if let Err(err) = app.deep_link().register_all() {
                eprintln!("could not register ilovelawyer:// links: {err}");
            }
            let link_app = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for link in event.urls() {
                    deep_links::handle(&link_app, &link);
                }
            });
            // The app may have been *started* by a link, before anything was listening.
            if let Ok(Some(links)) = app.deep_link().get_current() {
                for link in links {
                    deep_links::handle(app.handle(), &link);
                }
            }

            let app_handle = app.handle().clone();
            let base_url = base_url.clone();
            let window_title = window_title.clone();
            // Startup waits on the network, so it runs in the background (`async`) rather than
            // blocking Tauri while the web server comes up.
            tauri::async_runtime::spawn(async move {
                // Spawn the bundled Next.js standalone server as a local sidecar only when
                // there's no remote override and this isn't `tauri dev` (which expects
                // ilovelawyer-app's own `next dev` to already be running — see README).
                //
                // `cfg!(dev)` (which tauri-build sets from the actual `tauri dev` vs
                // `tauri build` invocation), not `cfg!(debug_assertions)`: the latter is also
                // true for `tauri build --debug`, a debug-profile *production* bundle that
                // still needs its sidecar spawned like any other build.
                if !is_remote && !cfg!(dev) {
                    if let Err(err) = sidecar::spawn_web_server_sidecar(&app_handle, frontend_port) {
                        eprintln!("failed to spawn web server sidecar: {err}");
                        app_handle.exit(1);
                        return;
                    }
                }

                // The UK/PH site this user last ended up on, if it's a sibling of the configured
                // address — so a PH user isn't sent to the UK site (and made to log in twice).
                let start_url = tenant_site::start_url(&app_handle, &base_url);

                if let Err(err) = sidecar::wait_for_server_ready(&start_url).await {
                    eprintln!("web server did not become ready: {err}");
                    app_handle.exit(1);
                    return;
                }

                // Every branch here exits rather than just logging: with no window open and no
                // tray icon, a surviving process is invisible to the user, who sees the app
                // "not start" and has to kill it from Task Manager.
                if let Err(err) = shell::open_main_window(&app_handle, &start_url, &base_url, &window_title) {
                    eprintln!("failed to open main window: {err}");
                    app_handle.exit(1);
                    return;
                }
                // A handoff link that started the app, now that there's a window to open it in.
                deep_links::open_pending(&app_handle);
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the I Love Lawyer desktop app")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                sidecar::stop(app_handle);
            }
        });
}
