//! Window Intelligence: knows which *other* application's window the user was last in, so a
//! Terminal panel can be docked beside it — e.g. next to the Chrome window showing a court site.
//!
//! Tracer-bullet scope: one tracked window (the last external one to take the foreground), a
//! dock-target event for the web app, and geometry for placing a panel beside it. Nothing here
//! guesses which case a window belongs to; docking is always the user's explicit click.
//!
//! Rules this module must keep:
//! - **Titles are sensitive** (client names, medical records). They may cross to the renderer for
//!   live display — the user can already see that window — but are never logged, persisted, or
//!   sent to the API. Error strings here must never include one.
//! - **HWNDs never leave this module.** The web app gets an opaque, session-scoped `runtime_id`;
//!   an HWND is a runtime handle the OS reuses, not an identity.
//! - All coordinates are **physical pixels**. tao makes the process per-monitor-v2 DPI aware at
//!   startup, so Win32 and Tauri's `Physical*` types agree without conversion.

//!
//! ## How this folder is split
//!
//! - `mod.rs` (this file) — the shared types the rest of the app sees, and the public functions.
//! - `geometry.rs` — pure maths for "where should the panel go?". No Windows calls, so it runs
//!   and is unit-tested on any OS.
//! - `win.rs` — the real Windows implementation (Win32 API calls). Only compiled on Windows.
//! - `unsupported.rs` — stand-ins for macOS/Linux that do nothing, so the app still builds there.
//!
//! `#[cfg(windows)]` / `#[cfg(not(windows))]` below are *compile-time* switches: on Windows only
//! `win.rs` is built, everywhere else only `unsupported.rs` is. Both export functions with the same
//! names, so callers never need to care which one they got.

mod geometry;
#[cfg(windows)]
mod win;
#[cfg(not(windows))]
mod unsupported;

pub use geometry::{place_beside, DockGeometry, Rect};

#[cfg(windows)]
pub use win::{current, invisible_borders, start, target_geometry};

#[cfg(not(windows))]
pub use unsupported::{current, start, target_geometry};

use serde::Serialize;

/// Sent to every window whenever the dock target changes. Payload: `Option<DockTarget>`.
pub const DOCK_TARGET_CHANGED_EVENT: &str = "dock-target-changed";

/// The external window a panel can currently be docked beside.
#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DockTarget {
    pub runtime_id: u64,
    /// Executable name without extension (`chrome`, `WINWORD`). None when the process can't be
    /// inspected, e.g. it runs elevated.
    pub app_name: Option<String>,
    pub title: String,
}
