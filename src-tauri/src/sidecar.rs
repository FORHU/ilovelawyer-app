//! Starting (and stopping) the web server the windows load.
//!
//! The desktop app is a shell around the Next.js web app, so something has to be serving it:
//! - **`tauri dev`** — you (or `beforeDevCommand`) run `next dev`; we only wait for it.
//! - **`FRONTEND_URL` set** — a deployed server; we only wait for it.
//! - **A packaged build** — we start the bundled Next.js server ourselves, using a portable
//!   Node executable shipped inside the app. That helper program is called a *sidecar*.

use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const HEALTH_CHECK_TIMEOUT_SECS: u64 = 20;
const HEALTH_CHECK_REQUEST_TIMEOUT_SECS: u64 = 3;

/// Holds the sidecar's child process handle so it can be killed on app exit (see `stop`).
/// `None` whenever no local sidecar was spawned — dev mode, or `frontend_url` pointing at an
/// already-deployed remote server.
///
/// Registered with Tauri via `.manage(...)` in `lib.rs`, which lets any code holding the
/// `AppHandle` reach it with `app.state::<SidecarProcess>()`.
#[derive(Default)]
pub(crate) struct SidecarProcess(Mutex<Option<CommandChild>>);

/// Spawns the bundled Next.js standalone server (`server.js`) via a portable Node sidecar
/// binary. The sidecar name/binary must match `bundle.externalBin` in tauri.conf.json.
/// Only used for a local production build — not `tauri dev`, and not when `FRONTEND_URL`
/// points at an already-deployed remote server.
pub(crate) fn spawn_web_server_sidecar(app: &AppHandle, frontend_port: u16) -> tauri::Result<()> {
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

/// Kills the sidecar, if one was spawned, so a closed desktop app never leaves an orphaned
/// `node server.js` process running. Called when the app exits.
pub(crate) fn stop(app: &AppHandle) {
    let state = app.state::<SidecarProcess>();
    let mut guard = state.0.lock().unwrap();
    if let Some(child) = guard.take() {
        let _ = child.kill();
    }
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
pub(crate) async fn wait_for_server_ready(base_url: &str) -> Result<(), String> {
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
