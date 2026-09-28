//! Which site (UK or PH) the app opens on.
//!
//! The desktop app itself is neither UK nor PH: it loads `FRONTEND_URL`, and the web app decides.
//! A user's organization is saved as UK or PH, and if the address doesn't match, the web app
//! redirects to the right one — `uk.` ↔ `ph.` (see apps/web/app/(protected)/layout.tsx). The two
//! addresses don't share a login, so a PH user in an app pointed at a `uk.` address logged in,
//! got redirected, and had to log in again — every launch.
//!
//! So the app remembers the site the main window last ended up on and starts there next time.
//! Only a *sibling* of the configured address counts — the same address with just the `uk.` /
//! `ph.` part changed — so a page can never make the app start somewhere else entirely.
//!
//! Examples, for `FRONTEND_URL=https://uk-dev.ilovelawyer.com`:
//! - `https://ph-dev.ilovelawyer.com` — sibling, remembered.
//! - `https://ph.ilovelawyer.com` — not (different environment: dev vs live).
//! - `https://evil.example` — not.

use std::path::PathBuf;
use tauri::{AppHandle, Manager, Url};

/// Where the remembered site is kept, inside the app's own config folder.
const REMEMBERED_SITE_FILE: &str = "last-site.txt";

/// The part of a host that says which site it is: `uk.`, `ph.`, `uk-dev.` or `ph-dev.`.
const TENANT_LABELS: &[&str] = &["uk", "ph", "uk-dev", "ph-dev"];

/// Splits a host into (tenant label, rest): `uk-dev.ilovelawyer.com` → (`Some("uk-dev")`,
/// `ilovelawyer.com`); a host without one, like `localhost`, → (`None`, `localhost`).
fn split_host(host: &str) -> (Option<&str>, &str) {
    match host.split_once('.') {
        Some((label, rest)) if TENANT_LABELS.contains(&label) => (Some(label), rest),
        _ => (None, host),
    }
}

/// Whether `candidate` is the configured address with only its UK/PH part changed.
fn is_sibling(configured: &Url, candidate: &Url) -> bool {
    let (Some(configured_host), Some(candidate_host)) = (configured.host_str(), candidate.host_str()) else {
        return false;
    };
    let (configured_label, configured_rest) = split_host(configured_host);
    let (candidate_label, candidate_rest) = split_host(candidate_host);
    let is_dev = |label: Option<&str>| label.is_some_and(|l| l.ends_with("-dev"));

    candidate_label.is_some() // it must name a site — that's all we ever remember
        && candidate_rest == configured_rest
        && is_dev(candidate_label) == is_dev(configured_label)
        && candidate.scheme() == configured.scheme()
        && candidate.port_or_known_default() == configured.port_or_known_default()
}

/// The page the dashboard window opens on. An address that already names a site (`uk.` / `ph.`)
/// goes straight to the dashboard; a neutral one (plain `localhost:3002`, the bare apex) opens the
/// web app's home page, which on a neutral address is its UK/PH chooser — so the user picks a
/// site *before* logging in, and logs in once, on the right one. `remember` then saves the
/// choice, so later launches skip the chooser.
pub(crate) fn start_path(start_url: &str) -> &'static str {
    let names_a_site = Url::parse(start_url)
        .ok()
        .and_then(|url| url.host_str().map(|host| split_host(host).0.is_some()))
        .unwrap_or(false);
    if names_a_site { "/homepage" } else { "/" }
}

/// The window title for a page on `url`: which site it is, then `base`, so it's always visible
/// whether you're on UK or PH (and on dev) — e.g. "UK I Love Lawyer Terminal!".
/// Just `base` on a neutral address (the UK/PH chooser), where no site is chosen yet.
pub(crate) fn window_title(base: &str, url: &Url) -> String {
    let Some(host) = url.host_str() else { return base.to_string() };
    let (label, _) = split_host(host);
    let Some(label) = label else { return base.to_string() };
    let site = if label.starts_with("uk") { "UK" } else { "PH" };
    let environment = if label.ends_with("-dev") { " (dev)" } else { "" };
    format!("{site}{environment} {base}")
}

/// Whether `candidate` is on the configured address itself or one of its UK/PH siblings — the
/// only sites the app will ever point its windows at (used to vet `ilovelawyer://` links).
pub(crate) fn is_app_site(configured: &str, candidate: &Url) -> bool {
    let Ok(configured_url) = Url::parse(configured) else { return false };
    let same = candidate.scheme() == configured_url.scheme()
        && candidate.host_str() == configured_url.host_str()
        && candidate.port_or_known_default() == configured_url.port_or_known_default();
    same || is_sibling(&configured_url, candidate)
}

/// `https://ph-dev.ilovelawyer.com` from any URL on that site (path and query dropped).
pub(crate) fn origin(url: &Url) -> String {
    url.origin().ascii_serialization()
}

fn remembered_site_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_config_dir().ok().map(|dir| dir.join(REMEMBERED_SITE_FILE))
}

/// The address to open the app on: the remembered site if it's a sibling of the configured one,
/// otherwise the configured address itself.
pub(crate) fn start_url(app: &AppHandle, configured: &str) -> String {
    let remembered = remembered_site_path(app)
        .and_then(|path| std::fs::read_to_string(path).ok())
        .and_then(|text| Url::parse(text.trim()).ok());
    match (Url::parse(configured), remembered) {
        (Ok(configured_url), Some(site)) if is_sibling(&configured_url, &site) => origin(&site),
        _ => configured.to_string(),
    }
}

/// Called whenever the main window navigates: if it's now on a sibling site, remember it for
/// next launch. Best-effort — failing to save only means one extra redirect next time.
pub(crate) fn remember(app: &AppHandle, configured: &str, url: &Url) {
    let Ok(configured_url) = Url::parse(configured) else { return };
    if !is_sibling(&configured_url, url) {
        return;
    }
    let Some(path) = remembered_site_path(app) else { return };
    let site = origin(url);
    if std::fs::read_to_string(&path).is_ok_and(|saved| saved.trim() == site) {
        return;
    }
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let _ = std::fs::write(&path, site);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sibling(configured: &str, candidate: &str) -> bool {
        is_sibling(&configured.parse().unwrap(), &candidate.parse().unwrap())
    }

    #[test]
    fn swaps_between_uk_and_ph() {
        assert!(sibling("https://uk-dev.ilovelawyer.com", "https://ph-dev.ilovelawyer.com/homepage"));
        assert!(sibling("https://uk.ilovelawyer.com", "https://ph.ilovelawyer.com/login"));
        assert!(sibling("http://uk.localhost:3002", "http://ph.localhost:3002/homepage"));
    }

    /// A configured address with no UK/PH part (plain localhost) still has UK and PH siblings.
    #[test]
    fn finds_sites_from_a_neutral_address() {
        assert!(sibling("http://localhost:3002", "http://uk.localhost:3002/"));
        assert!(!sibling("http://localhost:3002", "http://localhost:3002/"));
    }

    #[test]
    fn a_neutral_address_opens_the_site_chooser() {
        // The FRONTEND_URL values used locally (src-tauri/.env).
        assert_eq!(start_path("http://localhost:3002"), "/");
        assert_eq!(start_path("http://uk.localhost:3002"), "/homepage");
        assert_eq!(start_path("http://ph.localhost:3002"), "/homepage");
    }

    #[test]
    fn the_title_says_which_site() {
        let title = |url: &str| window_title("I Love Lawyer Terminal!", &url.parse().unwrap());
        assert_eq!(title("http://uk.localhost:3002/homepage"), "UK I Love Lawyer Terminal!");
        assert_eq!(title("http://ph.localhost:3002/login"), "PH I Love Lawyer Terminal!");
        assert_eq!(title("https://uk-dev.ilovelawyer.com/"), "UK (dev) I Love Lawyer Terminal!");
        assert_eq!(title("https://ph.ilovelawyer.com/"), "PH I Love Lawyer Terminal!");
        assert_eq!(title("http://localhost:3002/"), "I Love Lawyer Terminal!");
    }

    #[test]
    fn never_crosses_dev_and_live() {
        assert!(!sibling("https://uk-dev.ilovelawyer.com", "https://ph.ilovelawyer.com"));
        assert!(!sibling("https://uk.ilovelawyer.com", "https://ph-dev.ilovelawyer.com"));
    }

    #[test]
    fn rejects_anything_else() {
        assert!(!sibling("https://uk.ilovelawyer.com", "https://evil.example"));
        assert!(!sibling("https://uk.ilovelawyer.com", "https://uk.ilovelawyer.com.evil.example"));
        assert!(!sibling("https://uk.ilovelawyer.com", "http://ph.ilovelawyer.com"));
        assert!(!sibling("http://uk.localhost:3002", "http://ph.localhost:4000"));
        assert!(!sibling("https://uk.ilovelawyer.com", "https://sg.ilovelawyer.com"));
    }
}
