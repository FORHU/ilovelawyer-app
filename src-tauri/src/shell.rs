//! Things every window needs, whatever kind it is: the shared settings, checking ids that come
//! from the web page, building the URL a window loads, and the dashboard window opened at launch.
//!
//! The app has three kinds of window, each told apart by its *label* (Tauri's unique name for a
//! window):
//! - `main` — the dashboard, opened at launch (below).
//! - `case-terminal-{caseId}` — one per open case (`case_terminal.rs`).
//! - `panel-{caseId}:{panelId}` — a Terminal panel popped out on its own (`panels.rs`).

use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::monitors::{maximized_on, sorted_monitors};
use crate::popups::with_popup_policy;
use crate::tenant_site;

pub(crate) const MAIN_WINDOW_LABEL: &str = "main";

/// What the window commands need to build a window: every window loads a path under the same
/// base URL and shares one title.
///
/// Registered once with `.manage(...)` in `lib.rs`; a command gets it by taking a
/// `State<'_, Shell>` parameter, which Tauri fills in automatically.
pub(crate) struct Shell {
    pub base_url: String,
    pub window_title: String,
}

/// Settings every window needs because it shows the web app. Every window builder goes through
/// this — the dashboard below, `case_terminal.rs` and `panels.rs` — so a new kind of window
/// gets them too by calling it.
///
/// - **Drag and drop goes to the page.** Tauri catches files dropped on a window for its own
///   drop events, and on Windows the page then never sees the drop: dropping a document on the
///   upload area did nothing, and neither did dragging Terminal panes around. Nothing in this
///   app uses Tauri's drop events, so the handler is switched off.
/// - **Only sign-in popups may open** — see `popups.rs`.
pub(crate) fn web_window<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    with_popup_policy(builder.disable_drag_drop_handler())
}

/// Opens the one window that exists at launch: the dashboard (`{start_url}/homepage`, or the UK/PH
/// chooser at `/` when `start_url` doesn't name a site — see `tenant_site::start_path`), maximized
/// on the primary monitor. Case Terminals and panels are opened later, on demand, by the web app
/// calling `open_case_terminal` / `open_panel_window` — Tauri owns every window because it
/// creates every window, rather than trying to find windows the page opened itself.
///
/// `start_url` is where it opens (the remembered UK/PH site, or the configured address — see
/// `tenant_site.rs`); `configured_url` is `FRONTEND_URL`, which decides what counts as a site
/// worth remembering when the window later navigates.
pub(crate) fn open_main_window(
    app: &AppHandle,
    start_url: &str,
    configured_url: &str,
    window_title: &str,
) -> tauri::Result<()> {
    let monitor = match app.primary_monitor()? {
        Some(monitor) => Some(monitor),
        None => sorted_monitors(app)?.into_iter().next(),
    };

    let remember_app = app.clone();
    let configured_url = configured_url.to_string();
    let base_title = window_title.to_string();
    let first_title = Url::parse(start_url)
        .map(|url| tenant_site::window_title(window_title, &url))
        .unwrap_or_else(|_| window_title.to_string());
    let builder = web_window(
        WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, external_url(start_url, tenant_site::start_path(start_url)))
            .title(first_title)
            // On every navigation: remember which UK/PH site the dashboard ends up on (e.g. after
            // the web app redirects a PH user off a `uk.` address) so the next launch starts
            // there, and show that site in the title bar. Never blocks the navigation.
            .on_navigation(move |url| {
                tenant_site::remember(&remember_app, &configured_url, url);
                let title = tenant_site::window_title(&base_title, url);
                let app = remember_app.clone();
                // Not set_title() directly: this callback runs mid-navigation on the window's own
                // thread, and asking that same window for a change from here can deadlock.
                tauri::async_runtime::spawn(async move {
                    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
                        let _ = window.set_title(&title);
                    }
                });
                true
            }),
    );

    // Fallback for the (unexpected) case where the OS reports no monitors: still open a window
    // so the app isn't unusable.
    match monitor {
        Some(monitor) => maximized_on(builder, &monitor).build()?,
        None => builder.inner_size(1280.0, 800.0).build()?,
    };
    Ok(())
}

/// Case and panel ids become part of a window label and a URL path, so only plain id
/// characters are accepted — anything else (`/`, `..`, `?`) is rejected outright.
///
/// Every command must call this on every id the page sends, *before* using it: the web page is
/// not trusted to send well-formed ids.
pub(crate) fn validate_id(name: &str, value: &str) -> Result<(), String> {
    let valid = !value.is_empty()
        && value.len() <= 64
        && value.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if valid {
        Ok(())
    } else {
        Err(format!("invalid {name}"))
    }
}

/// The address a window opened *by* `caller` should load from: the caller's own current site.
///
/// Not `Shell::base_url`: after the web app redirects a user from the `uk.` site to `ph.` (or back),
/// the configured address is the wrong site — a panel opened there isn't logged in, because the
/// two sites don't share a login. Falls back to the configured address if the caller's can't be
/// read. Safe to trust: only pages on the origins in capabilities/default.json can call commands
/// at all, so `caller` is always on one of those.
pub(crate) fn caller_base_url(caller: &WebviewWindow, shell: &Shell) -> String {
    caller
        .url()
        .ok()
        .map(|url| url.origin().ascii_serialization())
        .filter(|origin| origin != "null")
        .unwrap_or_else(|| shell.base_url.clone())
}

/// Title for a window loading from `base_url`: its site, then the configured title ("UK …").
pub(crate) fn site_title(shell: &Shell, base_url: &str) -> String {
    Url::parse(base_url)
        .map(|url| tenant_site::window_title(&shell.window_title, &url))
        .unwrap_or_else(|_| shell.window_title.clone())
}

/// Brings an already-open window to the front. Returns false if no window has that label.
pub(crate) fn focus_existing(app: &AppHandle, label: &str) -> bool {
    let Some(window) = app.get_webview_window(label) else {
        return false;
    };
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    true
}

/// `path` is always built here from ids already passed through `validate_id`, never handed in
/// by the page — that's what keeps this concatenation safe, since an id can't contain the `@`,
/// `/` or `:` needed to retarget the URL's authority. Keep it that way: if a command ever takes
/// a caller-supplied path, this must resolve it against `base_url` and reject anything landing
/// outside that origin instead. A parse failure here can therefore only mean a malformed base
/// URL in config — a startup misconfiguration, not a runtime input error.
pub(crate) fn external_url(base_url: &str, path: &str) -> WebviewUrl {
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
}
