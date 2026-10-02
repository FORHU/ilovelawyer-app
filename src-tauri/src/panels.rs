//! Popped-out panels: a single Terminal panel (Notes, Timeline…) opened in its own window, so it
//! can be dragged to another screen.
//!
//! The lifecycle, start to finish:
//! 1. The page calls `open_panel_window`. We remember the panel in `PanelWindows` and open it.
//! 2. The user closes the panel window → `handle_panel_windows_on_destroy` sends
//!    `PANEL_WINDOW_CLOSED_EVENT`, and the Terminal puts the pane back on its grid.
//! 3. If instead the Terminal that popped it out closes, its panels close with it.
//!
//! Docking beside another app's window (the `beside_window` option) is in `docking.rs`.

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow, WebviewWindowBuilder};

use crate::docking::{dock_panel, resolve_dock};
use crate::shell::{caller_base_url, external_url, focus_existing, site_title, titled_by_page, validate_id, web_window, Shell};

const PANEL_LABEL_PREFIX: &str = "panel-";
/// Separates the two ids in a panel's label. Must be a character Tauri allows in a window label
/// (alphanumeric, `-`, `/`, `:`, `_`) but `validate_id` rejects, so the split is unambiguous:
/// with a `-` separator, `("case-1", "notes")` and `("case", "1-notes")` produce the same label,
/// and the second pop-out would focus the first's window and report the wrong ids on close.
const PANEL_ID_SEPARATOR: char = ':';
/// A panel window's size in *logical* pixels (before display scaling is applied).
pub(crate) const PANEL_WIDTH: f64 = 560.0;
pub(crate) const PANEL_HEIGHT: f64 = 680.0;
/// Event sent to every window when a popped-out panel window closes, so the Terminal that
/// popped it out can put the pane back on its grid (see ilovelawyer-app's lib/desktop).
const PANEL_WINDOW_CLOSED_EVENT: &str = "panel-window-closed";

/// One popped-out panel window: which window popped it out (closing that window closes the
/// panel) and which case/panel it shows (sent back in `PANEL_WINDOW_CLOSED_EVENT`).
struct PanelWindow {
    owner_label: String,
    case_id: String,
    panel_id: String,
}

/// Popped-out panel windows, keyed by their window label.
///
/// Wrapped in a `Mutex` because commands can run at the same time on different threads; the
/// lock makes them take turns. Keep each lock short — never hold it while opening or closing a
/// window (see `handle_panel_windows_on_destroy` for why).
#[derive(Default)]
pub(crate) struct PanelWindows(Mutex<HashMap<String, PanelWindow>>);

/// The payload of `PANEL_WINDOW_CLOSED_EVENT`. `Serialize` turns it into JSON for the page, with
/// field names in camelCase (`caseId`) to match JavaScript.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct PanelWindowClosed {
    case_id: String,
    panel_id: String,
}

/// Pops a Terminal panel out into its own window (`panel-{case_id}-{panel_id}`), or focuses it
/// if it's already out. The calling window becomes the panel's owner: when the owner closes,
/// the panel closes with it (see `handle_panel_windows_on_destroy`).
///
/// Placed near the right edge of the calling window's monitor, cascading when several are out —
/// or, given `beside_window` (a `DockTarget::runtime_id`), docked beside that other app's window.
/// Docking is best-effort: if that window has since closed or been minimized, the panel still
/// opens, in its normal place.
#[tauri::command]
pub(crate) async fn open_panel_window(
    app: AppHandle,
    window: WebviewWindow,
    shell: State<'_, Shell>,
    panels: State<'_, PanelWindows>,
    case_id: String,
    panel_id: String,
    beside_window: Option<u64>,
) -> Result<(), String> {
    validate_id("caseId", &case_id)?;
    validate_id("panelId", &panel_id)?;
    let label = panel_label(&case_id, &panel_id);
    let dock = beside_window.and_then(resolve_dock);
    if focus_existing(&app, &label) {
        if let (Some(dock), Some(panel)) = (dock, app.get_webview_window(&label)) {
            dock_panel(&panel, &dock).map_err(|e| e.to_string())?;
        }
        return Ok(());
    }

    // Resolve everything fallible up front, so the only thing that can fail after this panel's
    // slot is reserved below is the window build itself (which rolls the slot back).
    let base_url = caller_base_url(&window, &shell);
    let url = external_url(&base_url, &format!("/homepage/terminal/{case_id}/panel/{panel_id}"));
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

    let mut builder = web_window(titled_by_page(
        WebviewWindowBuilder::new(&app, label.clone(), url),
        &base_url,
        site_title(&shell, &base_url),
    ))
        .inner_size(PANEL_WIDTH, PANEL_HEIGHT)
        // A docked panel is built hidden and shown once it's in place, so it never flashes at
        // the default position first.
        .visible(dock.is_none());

    if dock.is_some() {
        // Placed by `dock_panel` below.
    } else if let Some(monitor) = current_monitor {
        // Near the monitor's right edge; each extra open panel shifts 32px down-left (wrapping
        // after 8) so they don't sit exactly on top of each other.
        let scale = monitor.scale_factor();
        let origin = monitor.position().to_logical::<f64>(scale);
        let size = monitor.size().to_logical::<f64>(scale);
        let cascade = (open_count % 8.0) * 32.0;
        let x = origin.x + (size.width - PANEL_WIDTH - 48.0 - cascade).max(0.0);
        let y = origin.y + 80.0 + cascade;
        builder = builder.position(x, y);
    }

    let panel = match builder.build() {
        Ok(panel) => panel,
        Err(err) => {
            panels.0.lock().unwrap().remove(&label);
            return Err(err.to_string());
        }
    };
    if let Some(dock) = dock {
        // Whatever happens while docking, show the window: a built-but-hidden panel would leave
        // its pane missing from the grid with no window to bring it back from.
        let docked = dock_panel(&panel, &dock);
        let _ = panel.show();
        let _ = panel.set_focus();
        docked.map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Runs whenever any window is destroyed (wired up in `lib.rs`):
/// - A panel closing tells every window, so its Terminal can put the pane back on the grid.
/// - Any other window closing closes the panels it popped out, so none are left orphaned.
pub(crate) fn handle_panel_windows_on_destroy(app: &AppHandle, label: &str) {
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

#[cfg(test)]
mod tests {
    use super::*;

    /// `-` is a legal id character, so a `-` separator would collide these two labels: the
    /// second pop-out would focus the first's window instead of opening its own.
    #[test]
    fn panel_labels_are_unambiguous() {
        assert_ne!(panel_label("case-1", "notes"), panel_label("case", "1-notes"));
    }
}
