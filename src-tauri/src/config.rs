//! Settings for the desktop shell, read once at startup.
//!
//! They come from `src-tauri/.env` (copy `.env.example` to start). Anything not set there falls
//! back to the defaults below, so the app still starts with no `.env` at all — which is exactly
//! the situation in a packaged production build.

const DEFAULT_FRONTEND_PORT: u16 = 3002;
const DEFAULT_WINDOW_TITLE: &str = "I Love Lawyer Terminal!";

/// Desktop-shell-only config, loaded from `.env` (see `.env.example`) with hardcoded
/// fallbacks. Deliberately just things specific to this Tauri shell itself — no app/API
/// secrets belong here (this shell orchestrates windows,
/// it never holds the application's own credentials).
pub(crate) struct Config {
    /// The port the web app runs on when it's local (`next dev`, or the bundled sidecar).
    pub frontend_port: u16,
    /// Text shown in every window's title bar.
    pub window_title: String,
    /// Full base URL override (e.g. `https://ph-dev.ilovelawyer.com`) — points every window at
    /// an already-deployed remote server instead of a local dev server/sidecar. When set, the
    /// local sidecar is never spawned, since there's nothing local to run.
    pub frontend_url: Option<String>,
}

impl Config {
    /// Reads the settings. Each one is optional: a missing or unparseable value quietly uses
    /// its default rather than stopping the app.
    pub fn load() -> Self {
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
    pub fn base_url(&self) -> String {
        self.frontend_url
            .clone()
            .unwrap_or_else(|| format!("http://localhost:{}", self.frontend_port))
    }
}
