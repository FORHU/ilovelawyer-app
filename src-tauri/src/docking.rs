//! "Dock beside": placing a popped-out panel right next to another app's window (say, Chrome on
//! a court site).
//!
//! This file is the bridge between two others:
//! - `window_intel/` knows about *other* apps' windows — which one the user was last in, and
//!   where it is.
//! - `panels.rs` opens *our* panel windows.
//!
//! Here we take the first's measurements and move the second's window. Everything is in
//! **physical pixels** (real screen pixels, after display scaling), because that's what Windows
//! reports; mixing in logical pixels is how positions go wrong on a 150% display.

use tauri::{PhysicalPosition, PhysicalSize, WebviewWindow};

use crate::panels::{PANEL_HEIGHT, PANEL_WIDTH};
use crate::window_intel::{self, DockGeometry, DockTarget, Rect};

/// The other app's window a panel can be docked beside right now, if any — for pages that mount
/// after the last `window_intel::DOCK_TARGET_CHANGED_EVENT`.
#[tauri::command]
pub(crate) fn current_dock_target() -> Option<DockTarget> {
    window_intel::current()
}

/// Where the window the page asked to dock beside is right now, or None if it can't be docked
/// to any more (closed, minimized, or no longer the target). None is not an error: the panel
/// then just opens in its usual place.
pub(crate) fn resolve_dock(runtime_id: u64) -> Option<DockGeometry> {
    match window_intel::target_geometry(runtime_id) {
        Ok(geometry) => Some(geometry),
        Err(err) => {
            eprintln!("docking skipped, using default placement: {err}");
            None
        }
    }
}

/// Moves and sizes `panel` beside the dock target, in physical pixels on the target's monitor.
pub(crate) fn dock_panel(panel: &WebviewWindow, dock: &DockGeometry) -> tauri::Result<()> {
    let width = (PANEL_WIDTH * dock.scale).round() as i32;
    let min_height = (PANEL_HEIGHT * dock.scale).round() as i32;
    // `rect` is where the panel's *visible* frame should go. Tauri positions and sizes the whole
    // window, which on Windows 10/11 includes invisible resize borders around that frame (15px
    // each side at 300%) — grow the rect by them, or the panel sits that far from the target.
    let visible = window_intel::place_beside(dock.target, dock.work_area, width, min_height);
    let borders = invisible_borders(panel);
    let rect = Rect {
        left: visible.left - borders.left,
        top: visible.top - borders.top,
        right: visible.right + borders.right,
        bottom: visible.bottom + borders.bottom,
    };

    // Position first: crossing to a monitor with a different scale makes the window resize
    // itself, and the size set afterwards has to win.
    panel.set_position(PhysicalPosition::new(rect.left, rect.top))?;
    // `set_size` sets the inner (web content) size. Subtract this window's own title bar and
    // borders so its outer frame lines up with the target's.
    let outer = panel.outer_size()?;
    let inner = panel.inner_size()?;
    let frame_width = outer.width.saturating_sub(inner.width);
    let frame_height = outer.height.saturating_sub(inner.height);
    panel.set_size(PhysicalSize::new(
        (rect.width().max(0) as u32).saturating_sub(frame_width),
        (rect.height().max(0) as u32).saturating_sub(frame_height),
    ))
}

/// Our own window's invisible resize borders (Windows only; zero elsewhere).
#[cfg(windows)]
fn invisible_borders(window: &WebviewWindow) -> Rect {
    window.hwnd().map(|hwnd| window_intel::invisible_borders(hwnd.0 as isize)).unwrap_or_default()
}

#[cfg(not(windows))]
fn invisible_borders(_window: &WebviewWindow) -> Rect {
    Rect::default()
}
