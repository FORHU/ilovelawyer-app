//! What happens when a page tries to open a new window or tab (`window.open`, or a link with
//! `target="_blank"` such as "Open in new tab", a law's source, a citation).
//!
//! Tauri blocks every one of these unless told otherwise. Two things broke because of that:
//! - "Continue with Google": Google's sign-in opens `accounts.google.com` in a popup, and login
//!   failed with `[GSI_LOGGER]: Failed to open popup window … Maybe blocked by the browser?`.
//! - About 20 "open in new tab" links (sources, laws, decisions, the library viewers, attachments)
//!   silently did nothing.
//!
//! The rule — three outcomes, decided by `decide`:
//! - **In the app**, only for Google sign-in. It opens as WebView2's own popup, which stays linked
//!   to the page that opened it; Google's sign-in hands the result back through that link
//!   (`window.opener`), which a separate browser couldn't do.
//! - **In the user's normal browser** (Chrome, Edge…), for any other web link — what people expect
//!   from a desktop app, and it keeps outside websites out of the app's own windows.
//! - **Blocked**, for anything that isn't a web link (`file:`, `javascript:`, custom schemes).

use tauri::webview::NewWindowResponse;
use tauri::{Manager, Runtime, Url, WebviewWindowBuilder};

/// Hosts allowed to open *inside* the app.
fn is_in_app_host(host: &str) -> bool {
    host == "accounts.google.com"
        || host == "localhost"
        || host == "127.0.0.1"
        || host.ends_with(".localhost")
        || host == "ilovelawyer.com"
        || host.ends_with(".ilovelawyer.com")
        || host == "ilovelawyer.local"
        || host.ends_with(".ilovelawyer.local")
}

#[derive(Debug, PartialEq)]
enum Decision {
    InApp,
    DefaultBrowser,
    Block,
}

/// Where a new window/tab for `url` should go.
fn decide(url: &Url) -> Decision {
    let host = url.host_str();
    match url.scheme() {
        "https" | "http" if host.is_some_and(is_in_app_host) => Decision::InApp,
        "https" | "http" if host.is_some() => Decision::DefaultBrowser,
        _ => Decision::Block,
    }
}

/// Applies the rule to a window that's being built. Every window the app opens goes through this
/// (via `shell::web_window`), since any of them can show a sign-in prompt or a link.
pub(crate) fn with_popup_policy<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
) -> WebviewWindowBuilder<'a, R, M> {
    builder.on_new_window(|url, _features| match decide(&url) {
        Decision::InApp => NewWindowResponse::Allow,
        Decision::DefaultBrowser => {
            if let Err(err) = tauri_plugin_opener::open_url(url.as_str(), None::<&str>) {
                // Only the host, never the full URL: query strings can carry tokens.
                eprintln!("could not open {} in the browser: {err}", url.host_str().unwrap_or("(no host)"));
            }
            NewWindowResponse::Deny
        }
        Decision::Block => {
            eprintln!("popup blocked: {} link", url.scheme());
            NewWindowResponse::Deny
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn decision(url: &str) -> Decision {
        decide(&url.parse().unwrap())
    }

    #[test]
    fn google_sign_in_stays_in_the_app() {
        assert_eq!(decision("https://accounts.google.com/o/oauth2/v2/auth?client_id=x&display=popup"), Decision::InApp);
    }

    #[test]
    fn internal_app_links_stay_in_the_app() {
        assert_eq!(decision("http://localhost:3002/homepage/terminal/abc"), Decision::InApp);
        assert_eq!(decision("http://uk.localhost:3002/homepage/terminal/abc"), Decision::InApp);
        assert_eq!(decision("https://uk.ilovelawyer.com/homepage/terminal/abc"), Decision::InApp);
    }

    #[test]
    fn other_web_links_go_to_the_browser() {
        assert_eq!(decision("https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html"), Decision::DefaultBrowser);
        assert_eq!(decision("https://mail.google.com/"), Decision::DefaultBrowser);
    }

    /// Look-alikes of the in-app host get a normal browser tab, never an in-app popup.
    #[test]
    fn look_alikes_never_open_in_the_app() {
        assert_eq!(decision("https://accounts.google.com.evil.example/"), Decision::DefaultBrowser);
        assert_eq!(decision("https://accounts.google.com@evil.example/"), Decision::DefaultBrowser);
        assert_eq!(decision("https://ilovelawyer.com.evil.example/"), Decision::DefaultBrowser);
    }

    #[test]
    fn anything_that_isnt_a_web_link_is_blocked() {
        assert_eq!(decision("javascript:alert(1)"), Decision::Block);
        assert_eq!(decision("file:///C:/Windows/System32/calc.exe"), Decision::Block);
        assert_eq!(decision("ms-settings:display"), Decision::Block);
    }
}
