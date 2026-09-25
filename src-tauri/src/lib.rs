use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{
    AppHandle, Emitter, Manager, Monitor, RunEvent, Runtime, State, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder, WindowEvent,
};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const HEALTH_CHECK_TIMEOUT_SECS: u64 = 20;
const HEALTH_CHECK_REQUEST_TIMEOUT_SECS: u64 = 3;
const DEFAULT_FRONTEND_PORT: u16 = 3002;
const DEFAULT_WINDOW_TITLE: &str = "I Love Lawyer Terminal!";

const MAIN_WINDOW_LABEL: &str = "main";
const CASE_TERMINAL_LABEL_PREFIX: &str = "case-terminal-";
const PANEL_LABEL_PREFIX: &str = "panel-";
/// Separates the two ids in a panel's label. Must be a character Tauri allows in a window label
/// (alphanumeric, `-`, `/`, `:`, `_`) but `validate_id` rejects, so the split is unambiguous:
/// with a `-` separator, `("case-1", "notes")` and `("case", "1-notes")` produce the same label,
/// and the second pop-out would focus the first's window and report the wrong ids on close.
const PANEL_ID_SEPARATOR: char = ':';
const PANEL_WIDTH: f64 = 560.0;
const PANEL_HEIGHT: f64 = 680.0;
/// Event sent to every window when a popped-out panel window closes, so the Terminal that
/// popped it out can put the pane back on its grid (see ilovelawyer-app's lib/desktop).
const PANEL_WINDOW_CLOSED_EVENT: &str = "panel-window-closed";

/// Holds the sidecar's child process handle so it can be killed on app exit (see `run`'s
/// `RunEvent::Exit` handling below). `None` whenever no local sidecar was spawned — dev mode,
/// or `frontend_url` pointing at an already-deployed remote server.
#[derive(Default)]
struct SidecarProcess(Mutex<Option<CommandChild>>);

/// What the window commands need to build a window: every window loads a path under the same
/// base URL and shares one title.
struct Shell {
    base_url: String,
    window_title: String,
}

/// One popped-out panel window: which window popped it out (closing that window closes the
/// panel) and which case/panel it shows (sent back in `PANEL_WINDOW_CLOSED_EVENT`).
struct PanelWindow {
    owner_label: String,
    case_id: String,
    panel_id: String,
}

/// Popped-out panel windows, keyed by their window label.
#[derive(Default)]
struct PanelWindows(Mutex<HashMap<String, PanelWindow>>);

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelWindowClosed {
    case_id: String,
    panel_id: String,
}

/// Desktop-shell-only config, loaded from `.env` (see `.env.example`) with hardcoded
/// fallbacks. Deliberately just things specific to this Tauri shell itself — no app/API
/// secrets belong here (this shell orchestrates windows,
/// it never holds the application's own credentials).
struct Config {
    frontend_port: u16,
    window_title: String,
    /// Full base URL override (e.g. `https://ph-dev.ilovelawyer.com`) — points every window at
    /// an already-deployed remote server instead of a local dev server/sidecar. When set, the
    /// local sidecar is never spawned, since there's nothing local to run.
    frontend_url: Option<String>,
}

impl Config {
    fn load() -> Self {
        // Missing .env is fine (e.g. a packaged production build) — fall back to defaults.
        let _ = dotenvy::dotenv();

        let frontend_port = std::env::var("FRONTEND_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(DEFAULT_FRONTEND_PORT);

        let window_title =
            std::env::var("WINDOW_TITLE").unwrap_or_else(|_| DEFAULT_WINDOW_TITLE.to_string());

        let frontend_url = std::env::var("FRONTEND_URL")
            .ok()
            .map(|v| v.trim_end_matches('/').to_string())
            .filter(|v| !v.is_empty());

        Self { frontend_port, window_title, frontend_url }
    }

    /// The base origin every window loads, e.g. `http://localhost:3002` or
    /// `https://ph-dev.ilovelawyer.com`. Deliberately `localhost`, not `127.0.0.1`, for the
    /// local case — ilovelawyer-api's CORS allowlist (`CLIENT_URL`) is keyed off exact origin
    /// strings and only lists the `localhost` form.
    fn base_url(&self) -> String {
        self.frontend_url
            .clone()
            .unwrap_or_else(|| format!("http://localhost:{}", self.frontend_port))
    }
}

pub fn run() {
    let config = Config::load();
    let base_url = config.base_url();
    let frontend_port = config.frontend_port;
    let window_title = config.window_title;
    let is_remote = config.frontend_url.is_some();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(SidecarProcess::default())
        .manage(PanelWindows::default())
        .manage(Shell { base_url: base_url.clone(), window_title: window_title.clone() })
        .invoke_handler(tauri::generate_handler![open_case_terminal, open_panel_window])
        .on_window_event(|window, event| {
            if let WindowEvent::Destroyed = event {
                handle_window_destroyed(window.app_handle(), window.label());
            }
        })
        .setup(move |app| {
            let app_handle = app.handle().clone();
            let base_url = base_url.clone();
            let window_title = window_title.clone();
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
                    if let Err(err) = spawn_web_server_sidecar(&app_handle, frontend_port) {
                        eprintln!("failed to spawn web server sidecar: {err}");
                        app_handle.exit(1);
                        return;
                    }
                }

                if let Err(err) = wait_for_server_ready(&base_url).await {
                    eprintln!("web server did not become ready: {err}");
                    app_handle.exit(1);
                    return;
                }

                // Every branch here exits rather than just logging: with no window open and no
                // tray icon, a surviving process is invisible to the user, who sees the app
                // "not start" and has to kill it from Task Manager.
                if let Err(err) = open_main_window(&app_handle, &base_url, &window_title) {
                    eprintln!("failed to open main window: {err}");
                    app_handle.exit(1);
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the I Love Lawyer desktop app")
        .run(|app_handle, event| {
            // Kill the sidecar (if one was spawned) when the app exits, so a closed desktop app
            // never leaves an orphaned `node server.js` process running.
            if let RunEvent::Exit = event {
                let state = app_handle.state::<SidecarProcess>();
                let mut guard = state.0.lock().unwrap();
                if let Some(child) = guard.take() {
                    let _ = child.kill();
                }
            }
        });
}

/// Spawns the bundled Next.js standalone server (`server.js`) via a portable Node sidecar
/// binary. The sidecar name/binary must match `bundle.externalBin` in tauri.conf.json.
/// Only used for a local production build — not `tauri dev`, and not when `FRONTEND_URL`
/// points at an already-deployed remote server.
fn spawn_web_server_sidecar(app: &AppHandle, frontend_port: u16) -> tauri::Result<()> {
    let resource_dir = app.path().resource_dir()?;
    let standalone_dir = resource_dir.join("web-standalone");

    let (mut rx, child) = app
        .shell()
        .sidecar("node")
        .map_err(|err| tauri::Error::Anyhow(err.into()))?
        .current_dir(standalone_dir.clone())
        .args(["server.js"])
        .env("PORT", frontend_port.to_string())
        // `localhost`, not `127.0.0.1`, so the sidecar binds whatever address the windows will
        // actually resolve `localhost` to. These are *different addresses* on an IPv6-enabled
        // machine: `localhost` resolves to `::1` first, so a sidecar bound to `127.0.0.1` is
        // not reachable at the URL every window loads (see `Config::base_url`, which uses
        // `localhost` deliberately for the API's CORS allowlist). Two processes can even hold
        // the same port at once — one on `[::1]`, one on `127.0.0.1` — without either
        // reporting EADDRINUSE, in which case the health check passes against whatever
        // unrelated server got there first and the windows silently show *that* app.
        .env("HOSTNAME", "localhost")
        .spawn()
        .map_err(|err| tauri::Error::Anyhow(err.into()))?;

    *app.state::<SidecarProcess>().0.lock().unwrap() = Some(child);

    // Surface sidecar stdout/stderr in the app's own log output for now; nothing in this
    // pass depends on parsing it.
    tauri::async_runtime::spawn(async move {
        use tauri_plugin_shell::process::CommandEvent;
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    print!("[web-server] {}", String::from_utf8_lossy(&line))
                }
                CommandEvent::Stderr(line) => {
                    eprint!("[web-server] {}", String::from_utf8_lossy(&line))
                }
                CommandEvent::Error(err) => eprintln!("[web-server] error: {err}"),
                _ => {}
            }
        }
    });

    Ok(())
}

/// Polls `{base_url}/homepage/terminal` until it responds or `HEALTH_CHECK_TIMEOUT_SECS`
/// elapses. In local dev, this is really just waiting for `next dev` to finish its first
/// compile; against a remote `base_url` it's just confirming the deployment is reachable.
///
/// Each attempt gets its own `HEALTH_CHECK_REQUEST_TIMEOUT_SECS` timeout — `reqwest::get`'s
/// default client has none, so a connection that's accepted but never answered (a dead port
/// still held open, a firewall dropping packets after the SYN) would hang that single `.await`
/// forever, and the outer deadline below, only checked between completed attempts, would never
/// be reached.
async fn wait_for_server_ready(base_url: &str) -> Result<(), String> {
    let url = format!("{base_url}/homepage/terminal");
    let deadline = tokio::time::Instant::now() + tokio::time::Duration::from_secs(HEALTH_CHECK_TIMEOUT_SECS);
    let client = reqwest::Client::builder()
        .timeout(tokio::time::Duration::from_secs(HEALTH_CHECK_REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| e.to_string())?;

    loop {
        if client.get(&url).send().await.is_ok() {
            return Ok(());
        }
        if tokio::time::Instant::now() >= deadline {
            return Err(format!("timed out waiting for {url}"));
        }
        tokio::time::sleep(tokio::time::Duration::from_millis(300)).await;
    }
}

/// Opens the one window that exists at launch: the dashboard (`{base_url}/homepage`), maximized
/// on the primary monitor. Case Terminals and panels are opened later, on demand, by the web app
/// calling `open_case_terminal` / `open_panel_window` — Tauri owns every window because it
/// creates every window, rather than trying to find windows the page opened itself.
fn open_main_window(app: &AppHandle, base_url: &str, window_title: &str) -> tauri::Result<()> {
    let monitor = match app.primary_monitor()? {
        Some(monitor) => Some(monitor),
        None => sorted_monitors(app)?.into_iter().next(),
    };

    let builder = WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, external_url(base_url, "/homepage"))
        .title(window_title);

    // Fallback for the (unexpected) case where the OS reports no monitors: still open a window
    // so the app isn't unusable.
    match monitor {
        Some(monitor) => maximized_on(builder, &monitor).build()?,
        None => builder.inner_size(1280.0, 800.0).build()?,
    };
    Ok(())
}

/// Opens the Case Terminal for `case_id`, or focuses it if it's already open — one window per
/// case, labeled `case-terminal-{case_id}`, so later calls target that exact window.
///
/// Placed on the first monitor (left to right) that isn't the calling window's, so opening a
/// case from the dashboard puts its Terminal beside it; with a single monitor it opens on top.
/// Async because creating a window from a synchronous command deadlocks on Windows.
#[tauri::command]
async fn open_case_terminal(
    app: AppHandle,
    window: WebviewWindow,
    shell: State<'_, Shell>,
    case_id: String,
) -> Result<(), String> {
    validate_id("caseId", &case_id)?;
    let label = format!("{CASE_TERMINAL_LABEL_PREFIX}{case_id}");
    if focus_existing(&app, &label) {
        return Ok(());
    }

    let current = window.current_monitor().map_err(|e| e.to_string())?;
    let monitors = sorted_monitors(&app).map_err(|e| e.to_string())?;
    let target = monitors
        .iter()
        .find(|m| current.as_ref().map_or(true, |c| !same_monitor(m, c)))
        .or(current.as_ref())
        .or(monitors.first());

    let url = external_url(&shell.base_url, &format!("/homepage/terminal/{case_id}"));
    let builder = WebviewWindowBuilder::new(&app, label, url).title(&shell.window_title);
    let built = match target {
        Some(monitor) => maximized_on(builder, monitor).build(),
        None => builder.inner_size(1280.0, 800.0).build(),
    };
    built.map_err(|e| e.to_string())?;
    Ok(())
}

/// Pops a Terminal panel out into its own window (`panel-{case_id}-{panel_id}`), or focuses it
/// if it's already out. The calling window becomes the panel's owner: when the owner closes,
/// the panel closes with it (see `handle_window_destroyed`).
///
/// Placed near the right edge of the calling window's monitor, cascading when several are out.
#[tauri::command]
async fn open_panel_window(
    app: AppHandle,
    window: WebviewWindow,
    shell: State<'_, Shell>,
    panels: State<'_, PanelWindows>,
    case_id: String,
    panel_id: String,
) -> Result<(), String> {
    validate_id("caseId", &case_id)?;
    validate_id("panelId", &panel_id)?;
    let label = panel_label(&case_id, &panel_id);
    if focus_existing(&app, &label) {
        return Ok(());
    }

    // Resolve everything fallible up front, so the only thing that can fail after this panel's
    // slot is reserved below is the window build itself (which rolls the slot back).
    let url = external_url(&shell.base_url, &format!("/homepage/terminal/{case_id}/panel/{panel_id}"));
    let current_monitor = window.current_monitor().map_err(|e| e.to_string())?;

    // Read the count and insert under one lock: doing them separately lets two `open_panel_window`
    // calls arriving close together (two pop-out buttons clicked in quick succession) both read
    // the same count before either inserts, so both windows land on the same cascade offset
    // instead of stacking distinctly.
    let open_count = {
        let mut map = panels.0.lock().unwrap();
        let count = map.len() as f64;
        map.insert(
            label.clone(),
            PanelWindow {
                owner_label: window.label().to_string(),
                case_id: case_id.clone(),
                panel_id: panel_id.clone(),
            },
        );
        count
    };

    let mut builder = WebviewWindowBuilder::new(&app, label.clone(), url)
        .title(&shell.window_title)
        .inner_size(PANEL_WIDTH, PANEL_HEIGHT);

    if let Some(monitor) = current_monitor {
        let scale = monitor.scale_factor();
        let origin = monitor.position().to_logical::<f64>(scale);
        let size = monitor.size().to_logical::<f64>(scale);
        let cascade = (open_count % 8.0) * 32.0;
        let x = origin.x + (size.width - PANEL_WIDTH - 48.0 - cascade).max(0.0);
        let y = origin.y + 80.0 + cascade;
        builder = builder.position(x, y);
    }

    if let Err(err) = builder.build() {
        panels.0.lock().unwrap().remove(&label);
        return Err(err.to_string());
    }
    Ok(())
}

/// Window lifecycle rules, run whenever any window is destroyed:
/// - `main` closing exits the app (which also stops the sidecar — see `run`'s Exit handler).
/// - A panel closing tells every window, so its Terminal can put the pane back on the grid.
/// - Any other window closing closes the panels it popped out, so none are left orphaned.
fn handle_window_destroyed(app: &AppHandle, label: &str) {
    if label == MAIN_WINDOW_LABEL {
        app.exit(0);
        return;
    }

    let panels = app.state::<PanelWindows>();
    // Collect under the lock, act after releasing it: closing a panel re-enters this handler.
    let (closed_panel, owned_panels) = {
        let mut map = panels.0.lock().unwrap();
        let closed_panel = map.remove(label);
        let owned: Vec<String> = map
            .iter()
            .filter(|(_, panel)| panel.owner_label == label)
            .map(|(panel_label, _)| panel_label.clone())
            .collect();
        (closed_panel, owned)
    };

    if let Some(panel) = closed_panel {
        let _ = app.emit(
            PANEL_WINDOW_CLOSED_EVENT,
            PanelWindowClosed { case_id: panel.case_id, panel_id: panel.panel_id },
        );
    }
    for panel_label in owned_panels {
        if let Some(panel_window) = app.get_webview_window(&panel_label) {
            let _ = panel_window.close();
        }
    }
}

/// The label for a popped-out panel window. See `PANEL_ID_SEPARATOR` for why it isn't `-`.
fn panel_label(case_id: &str, panel_id: &str) -> String {
    format!("{PANEL_LABEL_PREFIX}{case_id}{PANEL_ID_SEPARATOR}{panel_id}")
}

/// Case and panel ids become part of a window label and a URL path, so only plain id
/// characters are accepted — anything else (`/`, `..`, `?`) is rejected outright.
fn validate_id(name: &str, value: &str) -> Result<(), String> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if valid {
        Ok(())
    } else {
        Err(format!("invalid {name}"))
    }
}

/// Brings an already-open window to the front. Returns false if no window has that label.
fn focus_existing(app: &AppHandle, label: &str) -> bool {
    let Some(window) = app.get_webview_window(label) else {
        return false;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    true
}

/// Connected monitors sorted by physical position (x, then y for stacked monitors) rather than
/// raw OS enumeration order, which isn't documented as stable or spatially meaningful.
/// Detected on each call, so a monitor plugged in mid-session is picked up by the next window.
fn sorted_monitors(app: &AppHandle) -> tauri::Result<Vec<Monitor>> {
    let mut monitors = app.available_monitors()?;
    monitors.sort_by_key(|m| (m.position().x, m.position().y));
    Ok(monitors)
}

fn same_monitor(a: &Monitor, b: &Monitor) -> bool {
    a.position() == b.position() && a.size() == b.size()
}

/// Maximized, not fullscreen: fills the monitor's actual work area and respects the taskbar,
/// while keeping normal window chrome (title bar, controls).
fn maximized_on<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    monitor: &Monitor,
) -> WebviewWindowBuilder<'a, R, M> {
    let position = monitor.position().to_logical::<f64>(monitor.scale_factor());
    builder.position(position.x, position.y).maximized(true)
}

/// `path` is always built here from ids already passed through `validate_id`, never handed in
/// by the page — that's what keeps this concatenation safe, since an id can't contain the `@`,
/// `/` or `:` needed to retarget the URL's authority. Keep it that way: if a command ever takes
/// a caller-supplied path, this must resolve it against `base_url` and reject anything landing
/// outside that origin instead. A parse failure here can therefore only mean a malformed base
/// URL in config — a startup misconfiguration, not a runtime input error.
fn external_url(base_url: &str, path: &str) -> WebviewUrl {
    WebviewUrl::External(
        format!("{base_url}{path}")
            .parse()
            .expect("configured frontend URL must be a valid URL"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_plain_ids() {
        let max_len = "x".repeat(64);
        for id in ["a", "A1", "case-123", "with_underscore", max_len.as_str()] {
            assert!(validate_id("id", id).is_ok(), "{id:?} should be accepted");
        }
    }

    /// These are the characters that would let an id escape its window label or URL path.
    #[test]
    fn rejects_ids_that_could_escape_a_label_or_path() {
        let too_long = "x".repeat(65);
        for id in ["", "a/b", "..", "a?b", "a b", "@evil.com", "é", ":", too_long.as_str()] {
            assert!(validate_id("id", id).is_err(), "{id:?} should be rejected");
        }
    }

    /// `-` is a legal id character, so a `-` separator would collide these two labels: the
    /// second pop-out would focus the first's window instead of opening its own.
    #[test]
    fn panel_labels_are_unambiguous() {
        assert_ne!(panel_label("case-1", "notes"), panel_label("case", "1-notes"));
    }
}
