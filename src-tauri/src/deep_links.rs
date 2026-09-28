//! `ilovelawyer://` links — how a browser hands the user's sign-in to this app.
//!
//! The browser (signed in) asks the API for a one-time code and opens
//! `ilovelawyer://handoff?code=…&site=https://uk.ilovelawyer.com&next=/homepage/…`
//! (apps/web/lib/desktop/handoff.ts). Windows passes that link to this app, and we point the main
//! window at `{site}/handoff?code=…&next=…` — the web page that trades the code for a login.
//!
//! How the link gets here:
//! - `tauri.conf.json` → `plugins.deep-link` declares the `ilovelawyer` scheme; `register_all`
//!   (in `lib.rs`) writes it to the Windows registry, so it also works in `tauri dev`.
//! - If the app is already running, Windows starts a *second* copy with the link as an argument.
//!   The single-instance plugin stops that copy and forwards the link to the running one.
//!
//! Everything in the link came from outside the app, so it's checked before use: the site must be
//! the configured address or its UK/PH sibling (`tenant_site::is_app_site`), the code must look like
//! a code, and `next` is only ever passed on — the web page keeps it on the same site.

use std::sync::Mutex;
use tauri::{AppHandle, Manager, Url};

use crate::shell::{Shell, MAIN_WINDOW_LABEL};
use crate::tenant_site;

/// The one link kind we act on: `ilovelawyer://handoff?…`. Keep the scheme in sync with
/// `tauri.conf.json` and apps/web/lib/desktop/handoff.ts's DESKTOP_LINK_SCHEME.
const SCHEME: &str = "ilovelawyer";

/// A handoff link that arrived before the main window existed (the app was *started* by the
/// link). `lib.rs` opens it once the window is up. Registered with `.manage(...)`.
#[derive(Default)]
pub(crate) struct PendingLink(pub Mutex<Option<String>>);

/// The page to open for a handoff link, or None if the link isn't one we trust.
fn handoff_page(configured: &str, link: &Url) -> Option<String> {
    if link.scheme() != SCHEME || link.host_str() != Some("handoff") {
        return None;
    }
    let param = |name: &str| link.query_pairs().find(|(key, _)| key == name).map(|(_, value)| value.into_owned());

    let code = param("code")?;
    // 32 random bytes, base64url — what the API issues (ilovelawyer-api utils/handoff.ts).
    if code.len() != 43 || !code.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_') {
        return None;
    }
    let site = Url::parse(&param("site")?).ok()?;
    if !tenant_site::is_app_site(configured, &site) {
        return None;
    }
    let next = param("next").unwrap_or_else(|| "/homepage".into());

    let mut page = Url::parse(&tenant_site::origin(&site)).ok()?.join("/handoff").ok()?;
    page.query_pairs_mut().append_pair("code", &code).append_pair("next", &next);
    Some(page.into())
}

/// Handles one incoming link: opens the handoff page in the main window and brings it forward,
/// or parks it until the window exists. Links we don't trust are dropped (and logged — the scheme
/// only, never the code).
pub(crate) fn handle(app: &AppHandle, link: &Url) {
    let configured = app.state::<Shell>().base_url.clone();
    let Some(page) = handoff_page(&configured, link) else {
        eprintln!("ignored an {SCHEME}:// link that isn't a valid handoff");
        return;
    };
    match app.get_webview_window(MAIN_WINDOW_LABEL) {
        Some(window) => {
            if let Ok(url) = Url::parse(&page) {
                let _ = window.navigate(url);
            }
            let _ = window.unminimize();
            let _ = window.show();
            let _ = window.set_focus();
        }
        None => *app.state::<PendingLink>().0.lock().unwrap() = Some(page),
    }
}

/// Opens a link that arrived before the main window existed. Called once the window is up.
pub(crate) fn open_pending(app: &AppHandle) {
    let pending = app.state::<PendingLink>().0.lock().unwrap().take();
    if let (Some(page), Some(window)) = (pending, app.get_webview_window(MAIN_WINDOW_LABEL)) {
        if let Ok(url) = Url::parse(&page) {
            let _ = window.navigate(url);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const CODE: &str = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO-_";

    fn page(configured: &str, link: &str) -> Option<String> {
        handoff_page(configured, &link.parse().unwrap())
    }

    #[test]
    fn opens_the_handoff_page_on_the_links_site() {
        let link = format!("ilovelawyer://handoff?code={CODE}&site=http%3A%2F%2Fuk.localhost%3A3002&next=%2Fhomepage%2Fcase-portfolio");
        assert_eq!(
            page("http://localhost:3002", &link).as_deref(),
            Some(format!("http://uk.localhost:3002/handoff?code={CODE}&next=%2Fhomepage%2Fcase-portfolio").as_str())
        );
    }

    #[test]
    fn never_opens_a_site_that_isnt_ours() {
        for site in ["https%3A%2F%2Fevil.example", "http%3A%2F%2Fuk.localhost.evil.example%3A3002", "http%3A%2F%2Fuk.localhost%3A4000"] {
            let link = format!("ilovelawyer://handoff?code={CODE}&site={site}");
            assert_eq!(page("http://localhost:3002", &link), None, "{site}");
        }
    }

    #[test]
    fn rejects_malformed_links() {
        assert_eq!(page("http://localhost:3002", "ilovelawyer://handoff?site=http%3A%2F%2Fuk.localhost%3A3002"), None);
        assert_eq!(page("http://localhost:3002", "ilovelawyer://handoff?code=short&site=http%3A%2F%2Fuk.localhost%3A3002"), None);
        let other = format!("ilovelawyer://settings?code={CODE}&site=http%3A%2F%2Fuk.localhost%3A3002");
        assert_eq!(page("http://localhost:3002", &other), None);
    }
}
