//! The Case Terminal window: one per case, opened when the web app asks for it.
//!
//! This file holds a *command*: a Rust function the web page can call. `#[tauri::command]` turns
//! it into one, and it must also be listed in three places or the page can't reach it — see
//! `docs/desktop/adding-features.md` §3. The web side calls it through
//! `apps/web/lib/desktop/index.ts`, never directly from a component.

use tauri::{AppHandle, State, WebviewWindow, WebviewWindowBuilder};

use crate::monitors::{maximized_on, same_monitor, sorted_monitors};
use crate::shell::{caller_base_url, external_url, focus_existing, site_title, titled_by_page, validate_id, web_window, Shell};

const CASE_TERMINAL_LABEL_PREFIX: &str = "case-terminal-";

/// Opens the Case Terminal for `case_id`, or focuses it if it's already open — one window per
/// case, labeled `case-terminal-{case_id}`, so later calls target that exact window.
///
/// Placed on the first monitor (left to right) that isn't the calling window's, so opening a
/// case from the dashboard puts its Terminal beside it; with a single monitor it opens on top.
/// Async because creating a window from a synchronous command deadlocks on Windows.
///
/// Tauri fills in `app`, `window` (the window whose page made the call) and `shell` itself; only
/// `case_id` comes from the page, as `caseId` (Tauri converts the name to camelCase).
#[tauri::command]
pub(crate) async fn open_case_terminal(
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

    let base_url = caller_base_url(&window, &shell);
    let url = external_url(&base_url, &format!("/homepage/terminal/{case_id}"));
    let builder = web_window(titled_by_page(
        WebviewWindowBuilder::new(&app, label, url),
        &base_url,
        site_title(&shell, &base_url),
    ));
    let built = match target {
        Some(monitor) => maximized_on(builder, monitor).build(),
        None => builder.inner_size(1280.0, 800.0).build(),
    };
    built.map_err(|e| e.to_string())?;
    Ok(())
}
