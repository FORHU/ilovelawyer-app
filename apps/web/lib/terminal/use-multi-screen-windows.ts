import { useEffect, useState, type Dispatch, type SetStateAction } from "react"
import type { PanelId, WorkspaceLayout } from "@/lib/terminal/types"
import {
  applyScreenClosedFallback,
  arrangementForScreen,
  autoTileLayout,
  nextScreenIndex,
  openCanvasWindow,
  screenIsEmpty,
  sortedSecondaryScreens,
} from "@/lib/terminal/multi-screen"

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
export function useCanvasWindowReaper(
  canvasWindowsRef: React.RefObject<Map<number, Window>>,
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>,
): void {
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [screenIndex, win] of canvasWindowsRef.current) {
        if (!win.closed) continue
        canvasWindowsRef.current.delete(screenIndex)
        setLayout((prev) => (prev ? applyScreenClosedFallback(prev, screenIndex) : prev))
      }
    }, 500)
    return () => clearInterval(interval)
  }, [canvasWindowsRef, setLayout])
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

    if (next > 0 && next !== ownScreenIndex && !canvasWindowsRef.current.has(next)) {
      const screen = secondary[next - 1]
      if (screen) openCanvasWindow(caseId, next, screen, canvasWindowsRef)
    }

    setLayout((prev) => {
      if (!prev) return prev
      let moved: WorkspaceLayout = { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, screen: next || undefined } : p)) }
      // Mirror hidePanel/requestAddPanel: a Free-arrangement screen always re-tiles when its
      // panel set changes, on both ends of the move — otherwise the screen the pane left keeps a
      // gap where it used to be, and the screen it lands on keeps whatever rect that pane had on
      // its PREVIOUS screen, which is usually meaningless there (e.g. half-width on a 3-pane
      // primary grid, now the only pane in an empty canvas window).
      if (arrangementForScreen(prev, oldScreen) === "free") moved = autoTileLayout(moved, undefined, oldScreen)
      if (arrangementForScreen(prev, next) === "free") moved = autoTileLayout(moved, id, next)
      return moved
    })

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
