import type { Dispatch, DragEvent, RefObject, SetStateAction } from "react"
import { HIDDEN_PANELS, cascadeRect, clamp, columnsOf, GRID_SNAP_STEP, leastFullColumn, snapValue, type PaneDragPreview } from "@/components/terminal/terminal-canvas"
import { arrangementForScreen, autoTileLayout } from "@/lib/terminal/multi-screen"
import type { ArrangementValue, PanelId, PanelLayout, WorkspaceLayout } from "@/lib/terminal/types"

// How many panes a single column can stack before it's "full" and adding another pane
// requires replacing one instead.
export const MAX_PANES_PER_COLUMN = 3
// Hard ceiling on visible panes regardless of arrangement mode — Free/Tabs/Focus had no cap
// at all before this, letting the board cascade into an unusable stack of overlapping panes
// (see #297). Applies on top of (not instead of) Columns' own per-column cap above.
export const MAX_PANES = 10

export interface PanelPlacementParams {
  layout: WorkspaceLayout | null
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>
  arrangement: ArrangementValue
  visiblePanels: PanelLayout[]
  stageRef: RefObject<HTMLDivElement | null>
  dragPreview: PaneDragPreview | null
  setDragPreview: Dispatch<SetStateAction<PaneDragPreview | null>>
  setReplaceTarget: Dispatch<SetStateAction<PanelId | null>>
  // Which screen a panel belongs to — legal-terminal.tsx reads the panel's own `screen` field
  // (defaulting to 0, the primary); the layout builder defaults a brand-new panel to whichever
  // screen tab is currently open instead.
  resolveTargetScreen: (id: PanelId) => number
  // Hides the outgoing panel during a Columns-mode replace — the caller's own hidePanel (it
  // isn't extracted here since it's tangled up with maximizedId/pane-exit-animation state that's
  // legitimately different per consumer).
  onHide: (id: PanelId) => void
  // Pane enter/exit flourishes (Flip animations) — primary Terminal only, the builder skips them.
  animate?: {
    capturePaneState: () => void
    queuePaneEntry: (id: PanelId, sourceRect: DOMRect | null) => void
  }
}

export interface PanelPlacementActions {
  showPanelAt: (id: PanelId, extra?: Partial<PanelLayout>, sourceRect?: DOMRect | null) => void
  dropPanelAtRect: (id: PanelId, rect: { x: number; y: number; width: number; height: number }, sourceRect: DOMRect) => void
  patchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
  setColumnCount: (count: number) => void
  setColumnWidths: (widths: number[]) => void
  setTabsSplit: (value: number) => void
  setTabsActiveA: (id: PanelId) => void
  setTabsActiveB: (id: PanelId) => void
  blockIfOverPaneLimit: (id: PanelId) => boolean
  requestAddPanel: (id: PanelId) => void
  beginPanelDrag: (id: PanelId) => void
  updateDragPreview: (event: DragEvent) => void
  replacePaneInColumns: (oldId: PanelId, newId: PanelId) => void
  bringToFront: (panelId: PanelId) => void
}

/** The panel placement engine shared by the primary Terminal (legal-terminal.tsx) and the layout
 * builder (layout-builder-modal.tsx) — cascade/auto-tile placement, Columns-mode replace, drag
 * preview math. Lifted out of legal-terminal.tsx so the builder doesn't hand-copy this logic for
 * a second `WorkspaceLayout` in flight; both callers get byte-identical placement behavior. */
export function createPanelPlacementActions(params: PanelPlacementParams): PanelPlacementActions {
  const { layout, setLayout, arrangement, visiblePanels, stageRef, dragPreview, setDragPreview, setReplaceTarget, resolveTargetScreen, onHide, animate } = params

  const panelLibraryRect = (id: PanelId) =>
    document.querySelector<HTMLElement>(`[data-panel-library-id="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? null

  const dragPreviewRect = (id: PanelId) => {
    if (dragPreview?.panelId !== id || !stageRef.current) return null
    const bounds = stageRef.current.getBoundingClientRect()
    return new DOMRect(
      bounds.left + dragPreview.x * bounds.width,
      bounds.top + dragPreview.y * bounds.height,
      dragPreview.width * bounds.width,
      dragPreview.height * bounds.height,
    )
  }

  // `extra` is the Free canvas's drop rect, or a Columns-mode columnIndex; omitted for the Panel
  // Library's plain click fallback, which keeps today's cascade placement (harmless in modes
  // that don't use x/y/width/height).
  const showPanelAt = (id: PanelId, extra?: Partial<PanelLayout>, sourceRect?: DOMRect | null) => {
    animate?.capturePaneState()
    animate?.queuePaneEntry(id, sourceRect ?? dragPreviewRect(id) ?? panelLibraryRect(id))
    setDragPreview(null)
    setLayout((prev) => {
      if (!prev) return prev
      // A panel re-shown from the Panel Library (e.g. after being hidden from inside a canvas
      // window, where there's no library to re-add it from directly) can still belong to a
      // secondary screen — its `screen` field survives a hide. Re-tiling must target THAT screen,
      // not always screen 0, or the panel reappears with a generic cascade rect no auto-tile ever
      // corrects because autoTileLayout(..., 0) filters it straight out.
      const targetScreen = resolveTargetScreen(id)
      const screenPanels = prev.panels.filter((p) => (p.screen ?? 0) === targetScreen)
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      // Explicitly stamp the screen a brand-new panel lands on — in the primary Terminal
      // targetScreen is always 0 so this was a no-op there, but the layout builder adds panels
      // from scratch on whichever tab is open, and without this a new panel's `screen` field
      // stayed at its previous value (undefined, i.e. screen 0) no matter which tab it was
      // dropped on.
      const next = { id, visible: true, order: maxOrder + 1, screen: targetScreen || undefined, ...cascadeRect(screenPanels), ...extra }
      const panels = prev.panels.some((panel) => panel.id === id)
        ? prev.panels.map((panel) => (panel.id === id ? { ...panel, ...next } : panel))
        : [...prev.panels, next]
      const added = { ...prev, panels }
      // Free canvas: a plain add (the library's click) tiles the board so the first pane fills it
      // and each further pane splits the space, instead of floating a cascaded window on top of
      // the others. A drop rect from an actual drag is a deliberate position, so it's respected —
      // except for the very first pane, where "where" has no meaning and a full canvas is the
      // sensible start.
      const isFree = arrangementForScreen(prev, targetScreen) === "free"
      const explicitRect = extra?.x !== undefined || extra?.y !== undefined
      const onlyPane = panels.filter((p) => p.visible && !HIDDEN_PANELS.has(p.id) && (p.screen ?? 0) === targetScreen).length === 1
      return isFree && (!explicitRect || onlyPane) ? autoTileLayout(added, id, targetScreen) : added
    })
  }

  // Every entry point that can bring a NEW pane onto the board (sidebar add/drag, or a drop
  // onto the Free canvas / a Tabs or Focus slot) must check this first — showPanelAt itself
  // can't own the check since replacePaneInColumns also calls it to finish a swap, where the
  // outgoing pane's hidePanel() hasn't flushed to `visiblePanels` yet and would look like it's
  // still occupying a slot. Opens the same replace picker Columns mode already uses instead of
  // silently doing nothing, so hitting the cap always gives the user a way forward. Returns
  // true when the add was blocked.
  const blockIfOverPaneLimit = (id: PanelId): boolean => {
    const alreadyVisible = visiblePanels.some((p) => p.id === id)
    if (!alreadyVisible && visiblePanels.length >= MAX_PANES) {
      setReplaceTarget(id)
      return true
    }
    return false
  }

  // Free canvas's drop target — TerminalCanvas computes the drop rect itself (it owns the
  // pointer coordinates) and hands it back here, same cap-check + placement as before extraction.
  const dropPanelAtRect = (id: PanelId, rect: { x: number; y: number; width: number; height: number }, sourceRect: DOMRect) => {
    if (blockIfOverPaneLimit(id)) return
    showPanelAt(id, rect, sourceRect)
  }

  const patchPanel = (id: PanelId, patch: Partial<PanelLayout>) => {
    setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, ...patch } : panel)) } : prev))
  }

  const setColumnCount = (count: number) => setLayout((prev) => (prev ? { ...prev, columnCount: count } : prev))
  const setColumnWidths = (widths: number[]) => setLayout((prev) => (prev ? { ...prev, columnWidths: widths } : prev))
  const setTabsSplit = (value: number) => setLayout((prev) => (prev ? { ...prev, tabsSplit: value } : prev))
  const setTabsActiveA = (id: PanelId) => setLayout((prev) => (prev ? { ...prev, tabsActiveA: id } : prev))
  const setTabsActiveB = (id: PanelId) => setLayout((prev) => (prev ? { ...prev, tabsActiveB: id } : prev))

  // Adding a pane goes through the ordinary cascade placement in every mode except Columns,
  // where it either auto-joins the least-full column or — if every column is already at
  // MAX_PANES_PER_COLUMN — opens the replace picker instead of silently growing past the grid.
  const requestAddPanel = (id: PanelId) => {
    if (!layout) return
    if (blockIfOverPaneLimit(id)) return
    if (arrangement !== "columns") {
      showPanelAt(id)
      return
    }
    const count = layout.columnCount ?? 3
    const columns = columnsOf(visiblePanels, count)
    const alreadyVisible = visiblePanels.some((p) => p.id === id)
    if (!alreadyVisible && visiblePanels.length >= count * MAX_PANES_PER_COLUMN) {
      setReplaceTarget(id)
      return
    }
    showPanelAt(id, { columnIndex: leastFullColumn(columns) })
  }

  const beginPanelDrag = (id: PanelId) => {
    setDragPreview({ panelId: id, x: 0.34, y: 0.28, width: 0.32, height: 0.32 })
  }

  const updateDragPreview = (event: DragEvent) => {
    const id = event.dataTransfer.getData("text/x-panel-id") as PanelId
    const bounds = stageRef.current?.getBoundingClientRect()
    if (!id || !bounds) return
    const width = 0.32
    const height = 0.32
    const x = clamp(snapValue(clamp((event.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
    const y = clamp(snapValue(clamp((event.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
    setDragPreview({ panelId: id, x, y, width, height })
  }

  const replacePaneInColumns = (oldId: PanelId, newId: PanelId) => {
    const oldPanel = layout?.panels.find((p) => p.id === oldId)
    if (!oldPanel) return
    onHide(oldId)
    showPanelAt(newId, { columnIndex: oldPanel.columnIndex, order: oldPanel.order, height: oldPanel.height })
    setReplaceTarget(null)
  }

  const bringToFront = (panelId: PanelId) => {
    setLayout((prev) => {
      if (!prev) return prev
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      const current = prev.panels.find((p) => p.id === panelId)
      if (!current || current.order >= maxOrder) return prev
      return {
        ...prev,
        panels: prev.panels.map((panel) => (panel.id === panelId ? { ...panel, order: maxOrder + 1 } : panel)),
      }
    })
  }

  return {
    showPanelAt,
    dropPanelAtRect,
    patchPanel,
    setColumnCount,
    setColumnWidths,
    setTabsSplit,
    setTabsActiveA,
    setTabsActiveB,
    blockIfOverPaneLimit,
    requestAddPanel,
    beginPanelDrag,
    updateDragPreview,
    replacePaneInColumns,
    bringToFront,
  }
}

// Reassigns a panel to a different screen (the layout builder's "move to screen" control) and
// re-tiles the destination screen if it's Free — the same "screen changed, auto-tile if free"
// shape showPanelAt already uses for a panel landing on a new screen.
export function moveToScreen(layout: WorkspaceLayout, id: PanelId, screen: number): WorkspaceLayout {
  const moved: WorkspaceLayout = {
    ...layout,
    panels: layout.panels.map((p) => (p.id === id ? { ...p, screen: screen || undefined, x: undefined, y: undefined, columnIndex: undefined } : p)),
  }
  return arrangementForScreen(layout, screen) === "free" ? autoTileLayout(moved, id, screen) : moved
}
