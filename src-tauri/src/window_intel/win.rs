//! The Windows implementation of Window Intelligence: watching which *other* app the user is in,
//! and measuring where its window is.
//!
//! Beginner notes on what you'll see here:
//! - `unsafe` — every Win32 function is a raw C call that Rust can't check for memory safety, so
//!   Rust makes us mark those calls `unsafe`. It means "I've checked this by hand", not "this is
//!   dangerous". Keep the `unsafe` blocks small and only around the Win32 calls.
//! - `HWND` — Windows' handle (an ID number) for a window. We never send it to the web app; see
//!   the rules in `mod.rs`.
//! - `static ... Mutex` — one shared piece of state for the whole program. The `Mutex` makes sure
//!   only one thread touches it at a time (the watcher thread writes it, commands read it).
//! - A "WinEvent hook" is how Windows tells us "the user switched to another window". We register
//!   `on_event` as the function Windows should call.

use super::{DockGeometry, DockTarget, Rect, DOCK_TARGET_CHANGED_EVENT};
use std::ffi::c_void;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter};
use windows::core::PWSTR;
use windows::Win32::Foundation::{CloseHandle, HWND, RECT};
use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_EXTENDED_FRAME_BOUNDS};
use windows::Win32::Graphics::Gdi::{
    GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::HiDpi::GetDpiForWindow;
use windows::Win32::UI::WindowsAndMessaging::{
    DispatchMessageW, GetAncestor, GetClassNameW, GetForegroundWindow, GetMessageW,
    GetWindowLongPtrW, GetWindowRect, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
    IsWindowVisible, CHILDID_SELF, EVENT_OBJECT_DESTROY, EVENT_SYSTEM_FOREGROUND, GA_ROOT,
    GWL_EXSTYLE, MSG, OBJID_WINDOW, WINEVENT_OUTOFCONTEXT, WINEVENT_SKIPOWNPROCESS,
    WS_EX_TOOLWINDOW,
};

/// Shell surfaces that take the foreground but aren't somewhere a user works: the taskbar,
/// desktop, Start/search, Alt+Tab and Task View. Focusing one keeps the previous target.
const SHELL_CLASSES: &[&str] = &[
    "Shell_TrayWnd",
    "Shell_SecondaryTrayWnd",
    "Progman",
    "WorkerW",
    "Windows.UI.Core.CoreWindow",
    "XamlExplorerHostIslandWindow",
    "ForegroundStaging",
    "MultitaskingViewFrame",
    "TaskListThumbnailWnd",
];

struct Tracked {
    /// The HWND as an integer: `HWND` wraps a raw pointer and isn't `Send`.
    hwnd: isize,
    target: DockTarget,
}

struct Tracker {
    current: Option<Tracked>,
    next_id: u64,
}

static APP: OnceLock<AppHandle> = OnceLock::new();
static TRACKER: Mutex<Tracker> = Mutex::new(Tracker { current: None, next_id: 1 });

/// Starts tracking on its own thread. WinEvent callbacks for an out-of-context hook are
/// delivered through the installing thread's message queue, so that thread must pump
/// messages forever — which is why it can never be Tauri's UI thread.
pub fn start(app: AppHandle) {
    if APP.set(app).is_err() {
        return;
    }
    let spawned = std::thread::Builder::new().name("window-intel".into()).spawn(|| unsafe {
        // Seed with whatever is in front at launch, so docking works before the user has
        // switched apps once.
        track(GetForegroundWindow());

        let flags = WINEVENT_OUTOFCONTEXT | WINEVENT_SKIPOWNPROCESS;
        let foreground = SetWinEventHook(
            EVENT_SYSTEM_FOREGROUND,
            EVENT_SYSTEM_FOREGROUND,
            None,
            Some(on_event),
            0,
            0,
            flags,
        );
        let destroy =
            SetWinEventHook(EVENT_OBJECT_DESTROY, EVENT_OBJECT_DESTROY, None, Some(on_event), 0, 0, flags);
        if foreground.is_invalid() {
            eprintln!("window intelligence: could not install the foreground hook");
            return;
        }

        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            DispatchMessageW(&msg);
        }

        let _ = UnhookWinEvent(foreground);
        if !destroy.is_invalid() {
            let _ = UnhookWinEvent(destroy);
        }
    });
    if let Err(err) = spawned {
        eprintln!("window intelligence: could not start its thread: {err}");
    }
}

pub fn current() -> Option<DockTarget> {
    TRACKER.lock().unwrap().current.as_ref().map(|t| t.target.clone())
}

/// Where the window behind `runtime_id` is now. Fails if it's no longer the dock target, has
/// closed, or is minimized — callers fall back to normal placement.
pub fn target_geometry(runtime_id: u64) -> Result<DockGeometry, String> {
    let raw = match &TRACKER.lock().unwrap().current {
        Some(t) if t.target.runtime_id == runtime_id => t.hwnd,
        _ => return Err("that window is no longer the dock target".into()),
    };
    let hwnd = HWND(raw as *mut c_void);

    unsafe {
        if !IsWindow(Some(hwnd)).as_bool() {
            forget(hwnd);
            return Err("the dock target has closed".into());
        }
        if IsIconic(hwnd).as_bool() {
            return Err("the dock target is minimized".into());
        }

        // The visible frame. GetWindowRect would include Windows 10/11's invisible resize
        // borders and leave a gap between the panel and the window it's docked to.
        let mut frame = RECT::default();
        DwmGetWindowAttribute(
            hwnd,
            DWMWA_EXTENDED_FRAME_BOUNDS,
            &mut frame as *mut RECT as *mut c_void,
            std::mem::size_of::<RECT>() as u32,
        )
        .map_err(|e| format!("could not read the dock target's bounds: {e}"))?;

        let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
        let mut info =
            MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        if !GetMonitorInfoW(monitor, &mut info).as_bool() {
            return Err("could not read the dock target's monitor".into());
        }

        let dpi = GetDpiForWindow(hwnd);
        let scale = if dpi == 0 { 1.0 } else { dpi as f64 / 96.0 };

        Ok(DockGeometry { target: rect(frame), work_area: rect(info.rcWork), scale })
    }
}

/// How far one of *our* windows extends past its visible frame on each edge: the invisible
/// resize borders Windows 10/11 adds. Zero when unknown (e.g. DWM can't say yet).
pub fn invisible_borders(window: isize) -> Rect {
    let hwnd = HWND(window as *mut c_void);
    let mut outer = RECT::default();
    let mut frame = RECT::default();
    unsafe {
        if GetWindowRect(hwnd, &mut outer).is_err()
            || DwmGetWindowAttribute(
                hwnd,
                DWMWA_EXTENDED_FRAME_BOUNDS,
                &mut frame as *mut RECT as *mut c_void,
                std::mem::size_of::<RECT>() as u32,
            )
            .is_err()
        {
            return Rect::default();
        }
    }
    Rect {
        left: (frame.left - outer.left).max(0),
        top: (frame.top - outer.top).max(0),
        right: (outer.right - frame.right).max(0),
        bottom: (outer.bottom - frame.bottom).max(0),
    }
}

unsafe extern "system" fn on_event(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    id_child: i32,
    _thread: u32,
    _time: u32,
) {
    if hwnd.is_invalid() || id_object != OBJID_WINDOW.0 || id_child != CHILDID_SELF as i32 {
        return;
    }
    match event {
        EVENT_SYSTEM_FOREGROUND => track(hwnd),
        // Fires for every window destroyed system-wide; `forget` is a cheap compare.
        EVENT_OBJECT_DESTROY => forget(hwnd),
        _ => {}
    }
}

/// Makes `hwnd` the dock target if it's an ordinary window of another app. Anything else —
/// this app's own windows included, so docking a panel can't retarget itself — is ignored and
/// the previous target stands.
unsafe fn track(hwnd: HWND) {
    // Track the top-level window: that's what `forget` sees destroyed and what gets docked to.
    let root = GetAncestor(hwnd, GA_ROOT);
    let Some((app_name, title)) = describe(root) else { return };
    let raw = root.0 as isize;

    let changed = {
        let mut tracker = TRACKER.lock().unwrap();
        match &mut tracker.current {
            // Same window again (e.g. back from this app): keep its id, refresh the title.
            Some(t) if t.hwnd == raw => {
                let changed = t.target.title != title;
                t.target.title = title;
                changed.then(|| t.target.clone())
            }
            _ => {
                let runtime_id = tracker.next_id;
                tracker.next_id += 1;
                let target = DockTarget { runtime_id, app_name, title };
                tracker.current = Some(Tracked { hwnd: raw, target: target.clone() });
                Some(target)
            }
        }
    };
    if let Some(target) = changed {
        emit(Some(target));
    }
}

fn forget(hwnd: HWND) {
    let cleared = {
        let mut tracker = TRACKER.lock().unwrap();
        let matches = tracker.current.as_ref().is_some_and(|t| t.hwnd == hwnd.0 as isize);
        if matches {
            tracker.current = None;
        }
        matches
    };
    if cleared {
        emit(None);
    }
}

fn emit(target: Option<DockTarget>) {
    if let Some(app) = APP.get() {
        let _ = app.emit(DOCK_TARGET_CHANGED_EVENT, target);
    }
}

/// `(app name, title)` for a window worth docking beside, or None.
unsafe fn describe(hwnd: HWND) -> Option<(Option<String>, String)> {
    let root = GetAncestor(hwnd, GA_ROOT);
    if root.is_invalid() || !IsWindowVisible(root).as_bool() {
        return None;
    }

    let mut pid = 0u32;
    GetWindowThreadProcessId(root, Some(&mut pid));
    if pid == 0 || pid == std::process::id() {
        return None;
    }
    if GetWindowLongPtrW(root, GWL_EXSTYLE) as u32 & WS_EX_TOOLWINDOW.0 != 0 {
        return None;
    }

    let mut class = [0u16; 256];
    let len = GetClassNameW(root, &mut class);
    let class = String::from_utf16_lossy(&class[..len.max(0) as usize]);
    if SHELL_CLASSES.contains(&class.as_str()) {
        return None;
    }

    // Untitled top-level windows are transient surfaces (splashes, menus), not documents.
    let mut title = [0u16; 512];
    let len = GetWindowTextW(root, &mut title);
    if len <= 0 {
        return None;
    }
    let title = String::from_utf16_lossy(&title[..len as usize]);

    Some((process_name(pid), title))
}

unsafe fn process_name(pid: u32) -> Option<String> {
    let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
    let mut buf = [0u16; 1024];
    let mut len = buf.len() as u32;
    let queried =
        QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len);
    let _ = CloseHandle(process);
    queried.ok()?;

    let path = String::from_utf16_lossy(&buf[..len as usize]);
    std::path::Path::new(&path).file_stem().map(|s| s.to_string_lossy().into_owned())
}

fn rect(r: RECT) -> Rect {
    Rect { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
}
