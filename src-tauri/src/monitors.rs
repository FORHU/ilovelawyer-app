//! Small helpers for choosing which screen a window opens on.
//!
//! A `Monitor` is Tauri's description of one connected screen: where it sits in the combined
//! desktop (`position`), how big it is (`size`), and its display scaling (`scale_factor`, e.g.
//! 1.5 for 150%).

use tauri::{AppHandle, Manager, Monitor, Runtime, WebviewWindowBuilder};

/// Connected monitors sorted by physical position (x, then y for stacked monitors) rather than
/// raw OS enumeration order, which isn't documented as stable or spatially meaningful.
/// Detected on each call, so a monitor plugged in mid-session is picked up by the next window.
pub(crate) fn sorted_monitors(app: &AppHandle) -> tauri::Result<Vec<Monitor>> {
    let mut monitors = app.available_monitors()?;
    monitors.sort_by_key(|m| (m.position().x, m.position().y));
    Ok(monitors)
}

/// Two `Monitor` values describe the same screen when they cover the same area.
pub(crate) fn same_monitor(a: &Monitor, b: &Monitor) -> bool {
    a.position() == b.position() && a.size() == b.size()
}

/// Maximized, not fullscreen: fills the monitor's actual work area and respects the taskbar,
/// while keeping normal window chrome (title bar, controls).
///
/// Takes a window *builder* (a window that hasn't been created yet) and returns it with the
/// position set, so the window appears in the right place instead of jumping there.
pub(crate) fn maximized_on<'a, R: Runtime, M: Manager<R>>(
    builder: WebviewWindowBuilder<'a, R, M>,
    monitor: &Monitor,
) -> WebviewWindowBuilder<'a, R, M> {
    let position = monitor.position().to_logical::<f64>(monitor.scale_factor());
    builder.position(position.x, position.y).maximized(true)
}
