import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react"
import type { PanelId, WorkspaceLayout } from "@/lib/terminal/types"
import {
  applyScreenClosedFallback,
  movePanelToScreen,
  nextScreenIndex,
  openCanvasWindow,
  screenIsEmpty,
  sortedSecondaryScreens,
} from "@/lib/terminal/multi-screen"
import { announceWindowClosing } from "@/lib/terminal/layout-sync-channel"

// window.screen.isExtended is cheap and permission-free, but still only readable client-side —
// gates every multi-screen affordance (round-robin button, reopen banner) in both the primary
// window and every canvas window. Firefox/Safari (no Window Management API) simply never flip
// this true, so they see zero change.
export function useIsExtendedScreen(): boolean {
  const [isExtendedScreen, setIsExtendedScreen] = useState(false)
  useEffect(() => {
    setIsExtendedScreen(!!window.screen.isExtended)
  }, [])
  return isExtendedScreen
}

// Only reliable cross-window signal a canvas window gives its opener without any cooperation from
// the popped-out page itself (no postMessage/BroadcastChannel wiring needed either side). Reaps
// secondary-screen canvas windows (canvasWindowsRef, keyed by screen index — every panel that was
// on that screen falls back to `screen: undefined`) every 500ms. Shared by legal-terminal.tsx and
// every canvas window — same poll, same fallback mechanic.
//
// `unloadingRef` (from useCloseCanvasWindowsOnUnload, primary window only) skips the fallback
// while this window is itself going down — see that hook's doc comment for why: reassigning
// panels back to screen 0 there means resuming as a scattered single-screen mess instead of a
// clean reopen-banner restore.
export function useCanvasWindowReaper(
  canvasWindowsRef: React.RefObject<Map<number, Window>>,
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>,
  unloadingRef?: React.RefObject<boolean>,
): void {
  useEffect(() => {
    const interval = setInterval(() => {
      if (unloadingRef?.current) return
      for (const [screenIndex, win] of canvasWindowsRef.current) {
        if (!win.closed) continue
        canvasWindowsRef.current.delete(screenIndex)
        setLayout((prev) => (prev ? applyScreenClosedFallback(prev, screenIndex) : prev))
      }
    }, 500)
    return () => clearInterval(interval)
  }, [canvasWindowsRef, setLayout, unloadingRef])
}

// The primary window owns every canvas window it opened — when it goes away (tab close, refresh,
// or navigating off this case's terminal route in the SPA), every tracked canvas window closes
// with it rather than being left orphaned. `pagehide` and refresh fire the same signal (no
// reliable way to tell them apart beforehand), so a refresh closes pop-outs too — same "just
// reopen via a preset" expectation the reopenScreensBanner already relies on.
//
// Closing a canvas window this way makes IT fire its own pagehide, which broadcasts
// "screen-closing" back over the same channel the primary listens on (layout-sync-channel.ts) —
// and that message can land before the primary is fully torn down. Left unguarded, the primary's
// own handler would reassign those panels back to screen 0 (applyScreenClosedFallback, which
// doesn't retile) using rects that were computed for the secondary's own canvas — exactly the
// "scattered on reopen" bug this ref exists to prevent. The returned ref flips true before any
// window closes, so the primary's other multi-screen effects (the reaper above, and
// useLayoutSyncChannel's "screen-closing" handler) can check it and skip their fallback,
// leaving the persisted layout's screen assignments untouched for the next reopen-banner restore.
//
// Also broadcasts "terminal-closing" so canvas windows opened by OTHER canvas windows (screen 2+
// in a 3+ monitor setup — not in this ref) close too; each canvas listens in useLayoutSyncChannel.
export function useCloseCanvasWindowsOnUnload(caseId: string, canvasWindowsRef: React.RefObject<Map<number, Window>>): React.RefObject<boolean> {
  const unloadingRef = useRef(false)
  useEffect(() => {
    unloadingRef.current = false // re-armed on remount (Strict Mode runs cleanup right after mount)
    const closeAll = () => {
      unloadingRef.current = true
      announceWindowClosing(caseId, { type: "terminal-closing" })
      for (const win of canvasWindowsRef.current.values()) win.close()
      canvasWindowsRef.current.clear()
    }
    window.addEventListener("pagehide", closeAll)
    return () => {
      window.removeEventListener("pagehide", closeAll)
      closeAll()
    }
  }, [caseId, canvasWindowsRef])
  return unloadingRef
}

// Pop-out: advances a pane to the next physical screen in sequence (primary -> 1 -> 2 -> ... -> N
// -> primary) and opens/reuses that screen's canvas window — the ONLY pop-out mechanism now (the
// old single-panel same-screen popup was removed; see the terminal multi-screen plan). Gated on
// isExtendedScreen by the caller so it only ever renders on Chrome/Edge with more than one
// physical screen. getScreenDetails() is the Window Management API's permission-gated call — only
// ever invoked from inside the real click handler this returns, never on mount/effect.
//
// `ownScreenIndex` is this window's own screen index — 0 for the primary window, the canvas
// route's own `screenIndex` for a canvas window — and is what makes the auto-close branch below
// correct for both: when the panel's OLD screen turns out to be empty AND that old screen IS this
// window's own screen (the common case for a canvas window: its last panel pops out onward), this
// window closes itself directly rather than looking itself up in its own canvasWindowsRef (which
// never holds a reference to itself — it only tracks windows it opened further out). When the old
// screen is a DIFFERENT screen than this one (e.g. the primary window popping out a panel that was
// on screen 2), the existing canvasWindowsRef lookup+close+delete behavior is unchanged.
export function usePopOutToNextScreen({
  caseId,
  ownScreenIndex,
  layout,
  setLayout,
  canvasWindowsRef,
}: {
  caseId: string
  ownScreenIndex: number
  layout: WorkspaceLayout | null
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>
  canvasWindowsRef: React.RefObject<Map<number, Window>>
}): (id: PanelId) => Promise<void> {
  return async (id: PanelId) => {
    if (!layout || !window.getScreenDetails) return
    let details: { screens: ScreenDetailed[] }
    try {
      details = await window.getScreenDetails()
    } catch {
      // Permission denied/dismissed — no-op, same as a Firefox/Safari user never seeing the
      // button at all.
      return
    }
    const secondary = sortedSecondaryScreens(details)
    const panel = layout.panels.find((p) => p.id === id)
    const oldScreen = panel?.screen ?? 0
    const next = nextScreenIndex(oldScreen, secondary.length)

    // A tracked handle whose window was closed counts as missing (the reaper may not have run yet).
    const tracked = canvasWindowsRef.current.get(next)
    if (next > 0 && next !== ownScreenIndex && (!tracked || tracked.closed)) {
      const screen = secondary[next - 1]
      if (screen) openCanvasWindow(caseId, next, screen, canvasWindowsRef)
    }

    setLayout((prev) => (prev ? movePanelToScreen(prev, id, next) : prev))

    // Auto-close: the panel's OLD screen (if a secondary one) may now be empty. Checked against
    // the layout as it stood before this move (oldScreen only ever had this one panel removed
    // from it just now), not a re-read after setLayout — same "don't misread a deliberate empty
    // moment mid-edit" reasoning the plan calls out.
    if (oldScreen > 0) {
      const remaining = layout.panels.filter((p) => p.id !== id)
      if (screenIsEmpty(remaining, oldScreen)) {
        if (oldScreen === ownScreenIndex) {
          // This window just sent away its own last panel — close itself directly, since a
          // canvas window's own canvasWindowsRef never holds a reference to itself.
          window.close()
        } else {
          canvasWindowsRef.current.get(oldScreen)?.close()
          canvasWindowsRef.current.delete(oldScreen)
        }
      }
    }
  }
}
