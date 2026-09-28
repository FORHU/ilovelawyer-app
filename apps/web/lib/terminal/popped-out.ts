import type { PanelId, WorkspaceLayout } from "@/lib/terminal/types"

/**
 * The layout as it should be *saved*: every popped-out pane shown on the grid again.
 *
 * Popping a pane out hides it from the grid while its own window is open, and the window
 * closing brings it back (legal-terminal.tsx's onPanelWindowClosed effect). If that close event
 * never arrives — the app restarts, crashes, or a dev rebuild relaunches it — the pane would stay
 * hidden in the saved workspace with no window left to bring it back: it just vanished. So "popped
 * out" lives only in memory, and what gets saved always has the pane on the grid, where it was.
 *
 * Returns `layout` itself (same object) when nothing is popped out.
 */
export function layoutToPersist(layout: WorkspaceLayout, poppedOut: ReadonlySet<PanelId>): WorkspaceLayout {
  if (poppedOut.size === 0) return layout
  return {
    ...layout,
    panels: layout.panels.map((panel) => (poppedOut.has(panel.id) ? { ...panel, visible: true } : panel)),
  }
}
