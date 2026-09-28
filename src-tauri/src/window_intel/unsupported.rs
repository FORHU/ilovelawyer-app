//! Stand-ins for non-Windows builds (macOS, Linux). Docking beside other apps is Windows-only for
//! now, so these do nothing: no dock target ever appears, and the web app simply never shows the
//! "Dock beside" button.

use super::{DockGeometry, DockTarget};
use tauri::AppHandle;

pub fn start(_app: AppHandle) {}

pub fn current() -> Option<DockTarget> {
    None
}

pub fn target_geometry(_runtime_id: u64) -> Result<DockGeometry, String> {
    Err("docking beside other windows is only supported on Windows".into())
}
