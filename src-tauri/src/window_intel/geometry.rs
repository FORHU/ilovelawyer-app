//! Pure placement maths: given where the other app's window is and how big the screen is, work
//! out where the docked panel should go.
//!
//! Nothing here talks to Windows — it's plain numbers in, numbers out. That's deliberate: it keeps
//! the tricky arithmetic testable with ordinary unit tests (see the bottom of this file), on any
//! machine, without opening a single window.

/// A rectangle in physical pixels, edges exclusive on the right/bottom like Win32's `RECT`.
/// Also used for per-edge insets (see `invisible_borders`).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl Rect {
    pub fn width(&self) -> i32 {
        self.right - self.left
    }
    pub fn height(&self) -> i32 {
        self.bottom - self.top
    }
}

/// Where the dock target is right now: its visible frame, its monitor's work area, and that
/// monitor's scale factor (for sizing the panel in the same physical pixels).
#[derive(Clone, Copy, Debug)]
pub struct DockGeometry {
    pub target: Rect,
    pub work_area: Rect,
    pub scale: f64,
}

/// Places a `width`-wide panel against `target` inside `work_area`: to its right if there's room,
/// else to its left, else overlapping the work area's right edge (a maximized target leaves no
/// room on either side). Matches the target's height, but never shorter than `min_height`.
pub fn place_beside(target: Rect, work_area: Rect, width: i32, min_height: i32) -> Rect {
    let width = width.min(work_area.width());
    let left = if work_area.right - target.right >= width {
        target.right
    } else if target.left - work_area.left >= width {
        target.left - width
    } else {
        work_area.right - width
    };

    let min_height = min_height.min(work_area.height());
    let mut top = target.top.max(work_area.top);
    let mut bottom = target.bottom.min(work_area.bottom);
    if bottom - top < min_height {
        bottom = (top + min_height).min(work_area.bottom);
        top = bottom - min_height;
    }

    Rect { left, top, right: left + width, bottom }
}

#[cfg(test)]
mod tests {
    use super::*;

    const WORK: Rect = Rect { left: 0, top: 0, right: 1920, bottom: 1040 };

    #[test]
    fn docks_to_the_right_when_there_is_room() {
        let target = Rect { left: 100, top: 50, right: 1200, bottom: 900 };
        assert_eq!(
            place_beside(target, WORK, 560, 680),
            Rect { left: 1200, top: 50, right: 1760, bottom: 900 }
        );
    }

    #[test]
    fn docks_to_the_left_when_only_the_left_has_room() {
        let target = Rect { left: 700, top: 0, right: 1800, bottom: 1040 };
        assert_eq!(place_beside(target, WORK, 560, 680).left, 140);
    }

    #[test]
    fn overlaps_the_right_edge_beside_a_maximized_window() {
        assert_eq!(
            place_beside(WORK, WORK, 560, 680),
            Rect { left: 1360, top: 0, right: 1920, bottom: 1040 }
        );
    }

    #[test]
    fn a_short_target_still_gets_a_usable_panel_inside_the_work_area() {
        let target = Rect { left: 100, top: 900, right: 800, bottom: 1000 };
        let placed = place_beside(target, WORK, 560, 680);
        assert_eq!(placed.height(), 680);
        assert_eq!(placed.bottom, 1040);
    }

    #[test]
    fn clips_to_a_secondary_monitor_work_area() {
        // A monitor to the left of the primary, with negative coordinates.
        let work = Rect { left: -2560, top: 0, right: 0, bottom: 1400 };
        let target = Rect { left: -2600, top: -20, right: -1000, bottom: 1500 };
        assert_eq!(
            place_beside(target, work, 840, 1020),
            Rect { left: -1000, top: 0, right: -160, bottom: 1400 }
        );
    }
}
