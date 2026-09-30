"use client"

import {
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type DragEvent,
} from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Monitor,
  PanelLeft,
  Settings,
  Trash2,
} from "lucide-react"
import { FatalRiskBanner } from "@/components/terminal/terminal-panels"
import { PaneActivityContext, useDamagesActivity } from "@/components/terminal/pane-activity"
import {
  HIDDEN_PANELS,
  ModalOverlay,
  TerminalCanvas,
  cascadeRect,
  clamp,
  columnsOf,
  leastFullColumn,
  snapValue,
  GRID_SNAP_STEP,
  type PaneDragPreview,
} from "@/components/terminal/terminal-canvas"
import {
  arrangementForScreen,
  autoTileLayout,
  computeFocusStackSummaries,
  computePanelBadges,
  openCanvasWindow,
  screenIndicesInUse,
  sortedSecondaryScreens,
} from "@/lib/terminal/multi-screen"
import { useCanvasWindowReaper, useCloseCanvasWindowsOnUnload, useIsExtendedScreen, usePopOutToNextScreen } from "@/lib/terminal/use-multi-screen-windows"
import { useLayoutSyncChannel } from "@/lib/terminal/layout-sync-channel"
import { ScreenPresetsModal } from "@/components/terminal/screen-presets-modal"
import { applyScreenPreset, type ScreenPresetDef } from "@/lib/terminal/screen-presets"
import { CaseBriefContent } from "@/components/case-brief/case-brief-content"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import {
  useAiJobStatus,
  useApplyWorkspaceMutation,
  useCaseSnapshotQuery,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useTerminalCatalogQuery,
  useTerminalWorkspacesQuery,
  useUpdateWorkspaceMutation,
  useRenameWorkspaceMutation,
} from "@/lib/terminal/mutations"
import type {
  ArrangementValue,
  PanelId,
  PanelLayout,
  PresetValue,
  WorkspaceLayout,
} from "@/lib/terminal/types"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import { apiFetch } from "@/lib/fetch"
import { shouldShowUpdatingAnalysis } from "@/lib/terminal/refresh-status"
import { useCaseRoom } from "@/lib/cases/case-room"
import { useTerminalPaneAnimations } from "@/lib/terminal/use-terminal-pane-animations"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import TerminalSettingsSidebar from "@/components/terminal/terminal-settings-sidebar"
import { ArrangementSwitcher } from "@/components/terminal/arrangement-switcher"
import LayoutTabStrip from "@/components/terminal/layout-tab-strip"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"

export { PANEL_TITLES }

// How many panes a single column can stack before it's "full" and adding another pane
// requires replacing one instead.
const MAX_PANES_PER_COLUMN = 3
// Hard ceiling on visible panes regardless of arrangement mode — Free/Tabs/Focus had no cap
// at all before this, letting the board cascade into an unusable stack of overlapping panes
// (see #297). Applies on top of (not instead of) Columns' own per-column cap above.
const MAX_PANES = 10

// Local z-index scale for this file's own stacking context (the terminal-grid stage and its
// overlays) — deliberately ordered, not arbitrary. Below `z-10`: nothing, panes sit in normal
// flow order. Kept as plain Tailwind literals (z-10/z-20/z-30/z-[90]/z-[95] below, plus the
// inline `zIndex: 80/panel.order+1` on a Free-canvas pane) rather than named constants, since
// Tailwind can't resolve an interpolated class at build time — this comment is the scale's
// documentation instead:
//   z-10  Columns/Tabs resize dividers (column border, in-column stack, tabs group split)
//   z-20  Free canvas edge resize handles
//   z-30  Free canvas corner resize handles
//   80    a Free-canvas pane actively being dragged (inline zIndex, momentarily above every
//         other pane's own order-based z-index, which otherwise grows unbounded via
//         bringToFront — see z-(--z-canvas-overlay) below for why the Settings popover can't
//         just sit at a fixed value under that ceiling)
//   z-[90]  the maximized-pane overlay
//   z-[95]  the Columns replace-picker overlay
// The Settings popover is a special case: it's portaled inside this same stacking context (see
// PopoverContent's `container` doc comment) but needs to sit above every possible pane z-index,
// so it uses the global `z-(--z-canvas-overlay)` token (globals.css) instead of a number in this
// scale — see its call site below.

function asLayout(value: unknown, fallback: WorkspaceLayout): WorkspaceLayout {
  if (!value || typeof value !== "object") return fallback
  const raw = value as Partial<WorkspaceLayout>
  if (!Array.isArray(raw.panels)) return fallback
  // Pre-rework saves used "columns" to mean today's freeform canvas — a genuinely new
  // Columns-mode save always carries columnCount, so its absence is what marks a legacy save.
  // This only ever fires once per legacy workspace: once it's re-saved (still "columns", now
  // with columnCount set), it reads as the new mode from then on.
  const arrangement =
    raw.arrangement === "columns" && raw.columnCount === undefined
      ? "free"
      : (raw.arrangement ?? fallback.arrangement ?? "free")
  return {
    preset: raw.preset ?? fallback.preset,
    arrangement,
    panels: raw.panels as PanelLayout[],
    columnCount: raw.columnCount,
    columnWidths: raw.columnWidths,
    tabsSplit: raw.tabsSplit,
    tabsActiveA: raw.tabsActiveA,
    tabsActiveB: raw.tabsActiveB,
    screenLayouts: raw.screenLayouts,
  }
}

function mergeCatalogPanels(layout: WorkspaceLayout, catalogIds: PanelId[]): WorkspaceLayout {
  const have = new Set(layout.panels.map((panel) => panel.id))
  const extras: PanelLayout[] = catalogIds
    .filter((id) => !have.has(id) && !HIDDEN_PANELS.has(id))
    .map((id, index) => ({ id, visible: false, order: 100 + index, width: 1, height: 1 }))
  return extras.length ? { ...layout, panels: [...layout.panels, ...extras] } : layout
}

export default function LegalTerminal({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  // Joined once here, at the Terminal's root — every useAiJobStatus(caseId, kind) call below
  // (and any panel that adds one later) shares this single case:<caseId> room membership rather
  // than each subscribing independently. See useCaseRoom's doc comment for why AI generation
  // jobs need a case-wide room instead of the per-user one the socket already joins on connect.
  useCaseRoom(caseId)
  const catalog = useTerminalCatalogQuery()
  const workspaces = useTerminalWorkspacesQuery(caseId)
  const snapshot = useCaseSnapshotQuery(caseId)
  const createWorkspace = useCreateWorkspaceMutation()
  const updateWorkspace = useUpdateWorkspaceMutation()
  const renameWorkspace = useRenameWorkspaceMutation()
  const applyWorkspace = useApplyWorkspaceMutation()
  const deleteWorkspace = useDeleteWorkspaceMutation()
  // No manual "Refresh analysis" trigger — the Legal Terminal relies entirely on the automatic
  // caseRefresh pipeline (corpus-change triggered) now. This poll is what drives the
  // "Updating analysis…" indicator below while that background job is running.
  const refreshJob = useAiJobStatus(caseId, "caseRefresh")
  // The damages extraction runs alongside caseRefresh after an upload; "Updating analysis" covers
  // both (see shouldShowUpdatingAnalysis). Same query as useDamagesActivity's, so no extra request.
  const damagesJob = useAiJobStatus(caseId, "damagesExtract")

  const [layout, setLayout] = useState<WorkspaceLayout | null>(null)
  const [dragPreview, setDragPreview] = useState<PaneDragPreview | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
  const [draggingId, setDraggingId] = useState<PanelId | null>(null)
  // A maximized pane covers the whole stage on top of whatever arrangement is active; its
  // committed rect/grouping is left untouched, so clearing this just removes the overlay.
  const [maximizedId, setMaximizedId] = useState<PanelId | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  // Lifted out of TerminalSettingsSidebar (mirrors ConsultationSidebar's sidebarMobileOpen) so
  // the mobile trigger can render inline in the Case Row instead of as a floating circle that
  // overlapped the "Back to Case" link below `lg`.
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  // Focus's "which one is showing" state is intentionally ephemeral (not saved with the
  // workspace) — it resets to the first pane in the stack on reload, same spirit as the
  // freeform canvas not remembering scroll position. Tabs mode persists its active tab in
  // layout.tabsActiveA/B instead (see TabsArrangement).
  const [focusedId, setFocusedId] = useState<PanelId | null>(null)
  // Set while Columns mode is full and the user just tried to add this pane — opens the
  // "replace which pane?" picker. Null the rest of the time.
  const [replaceTarget, setReplaceTarget] = useState<PanelId | null>(null)
  const [briefPreviewOpen, setBriefPreviewOpen] = useState(false)
  const [presetsModalOpen, setPresetsModalOpen] = useState(false)
  // "apply" (toolbar Workflows button, rearranges the current tab) or "create" (+ New Layout,
  // creates a new tab) — same ScreenPresetsModal component, see openPresetsModal below.
  const [presetsModalMode, setPresetsModalMode] = useState<"apply" | "create">("apply")
  // True auto-open on load isn't possible — window.open() with no fresh click is silently eaten
  // by the popup blocker in every major browser. This is the closest thing: a modal in front of
  // the user immediately on load (not a dismissible banner easy to miss) asking to resume, one
  // click opens every missing screen under that click's gesture. Dismissing it just hides it for
  // this mount — it isn't a "never ask again" preference, since a fresh load is a fresh chance to
  // resume cleanly.
  const [resumePromptDismissed, setResumePromptDismissed] = useState(false)
  // Populated by handlePresetModalOpen and handed to the modal as a prop — getScreenDetails() is
  // permission-gated and must be called synchronously from the click handler itself (Chromium's
  // transient-activation rule, same as usePopOutToNextScreen), not from an effect reacting to
  // presetsModalOpen flipping true. The modal is fully parent-controlled (no DialogTrigger), so
  // its own onOpenChange never fires on that transition — detection has to happen here instead.
  // The modal's own "DETECT" button re-detects internally (its click is its own fresh gesture).
  const [detectedScreenCount, setDetectedScreenCount] = useState<number | null>(null)
  const panelLabels = useTerminalDisplayStore((state) => state.panelLabels)
  const setPanelLabels = useTerminalDisplayStore((state) => state.setPanelLabels)
  const highDensity = useTerminalDisplayStore((state) => state.highDensity)
  const setHighDensity = useTerminalDisplayStore((state) => state.setHighDensity)
  // Popover content portals outside this component's DOM subtree by default — keeping it
  // inside `rootRef` (the `dark`-scoped root below) is what makes it pick up the terminal's
  // forced near-black palette instead of the page's actual light/dark theme.
  const rootRef = useRef<HTMLDivElement>(null)
  // Drag/resize (rAF-throttled DOM writes, grid-snapping) now lives inside TerminalCanvas — see
  // components/terminal/terminal-canvas.tsx.
  const lastSavedLayoutRef = useRef("")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ workspaceId: string; layoutJson: WorkspaceLayout } | null>(null)
  const inFlightSaveRef = useRef<Promise<unknown> | null>(null)
  // Tracks the chrome-less canvas windows this tab opened via pop-out/the reopen banner, keyed by
  // secondary screen index (1-5). A ref, not state — nothing here needs to re-render. See
  // app/(protected)/homepage/terminal/[caseId]/canvas/[screenIndex]/page.tsx.
  const canvasWindowsRef = useRef<Map<number, Window>>(new Map())
  // window.screen.isExtended is cheap and permission-free, but still only readable client-side —
  // gates every multi-screen affordance (pop-out button, reopen banner). Firefox/Safari (no
  // Window Management API) simply never flips this true, so they see zero change.
  const isExtendedScreen = useIsExtendedScreen()

  // The reverse direction: this window owns every canvas window it opened, so it closes them too
  // when it goes away. unloadingRef flips true right before that happens, so the reaper and the
  // sync channel below can skip reacting to the close-echo it causes — see the hook's own doc
  // comment for why that echo is otherwise destructive.
  const unloadingRef = useCloseCanvasWindowsOnUnload(canvasWindowsRef)

  // Only reliable cross-window signal a canvas window gives its opener without any cooperation
  // from the popped-out page itself (no postMessage/BroadcastChannel wiring needed either side).
  useCanvasWindowReaper(canvasWindowsRef, setLayout, unloadingRef)

  // Instant cross-window layout sync + close notifications, additive to the poll above — see
  // lib/terminal/layout-sync-channel.ts.
  const { broadcastLayout } = useLayoutSyncChannel({
    caseId,
    workspaceId: selectedWorkspaceId,
    layout,
    setLayout,
    lastSavedLayoutRef,
    canvasWindowsRef,
    unloadingRef,
  })

  useEffect(() => {
    if (!catalog.data || catalog.isLoading || workspaces.isLoading || layout) return
    const lastUsed = workspaces.data?.find((w) => w.isLastUsed)
    const fallback: WorkspaceLayout = {
      preset: catalog.data.defaultPreset,
      arrangement: "free",
      panels: catalog.data.panels.map((panel, index) => ({
        id: panel.id,
        visible: false,
        order: index,
        width: 1,
        height: 1,
      })),
    }
    if (lastUsed) {
      const hydrated = hydrateFreeform(mergeCatalogPanels(asLayout(lastUsed.layoutJson, fallback), catalog.data.panels.map((p) => p.id)))
      lastSavedLayoutRef.current = JSON.stringify(hydrated)
      setLayout(hydrated)
      setSelectedWorkspaceId(lastUsed.id)
      return
    }
    // No saved workspace means the user intentionally has an empty terminal. Keep every pane
    // hidden so a refresh does not recreate the default preset after the final layout was deleted.
    lastSavedLayoutRef.current = JSON.stringify(fallback)
    setLayout(fallback)
  }, [catalog.data, catalog.isLoading, workspaces.data, workspaces.isLoading, layout])

  useEffect(() => {
    if (!layout || !selectedWorkspaceId) return
    const serialized = JSON.stringify(layout)
    if (serialized === lastSavedLayoutRef.current) return

    // Broadcast the optimistic local state immediately — every other open window (a canvas window
    // that just got a panel sent to it, say) should reflect this right away, not wait out the
    // debounce below, which exists only to reduce backend PATCH traffic. Guarded by the same
    // lastSavedLayoutRef comparison above, so adopting a REMOTE broadcast (which sets
    // lastSavedLayoutRef before setLayout) never bounces straight back out as a new one.
    broadcastLayout(layout)

    pendingSaveRef.current = { workspaceId: selectedWorkspaceId, layoutJson: layout }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      const pending = pendingSaveRef.current
      if (!pending) return
      // NOT cleared here — a normal (non-keepalive) fetch is cancelled if the tab closes while
      // it's still in flight, which used to silently drop the save (e.g. a just-made screen
      // assignment never reaching the backend, so reopening found nothing to restore). Leaving
      // `pending` in place until the save actually confirms means flushOnHide below can still
      // catch and resend it with keepalive if that happens.
      const save = updateWorkspace.mutateAsync({
        id: pending.workspaceId,
        preset: pending.layoutJson.preset,
        layoutJson: pending.layoutJson,
      })
      inFlightSaveRef.current = save
      save.then(() => {
        lastSavedLayoutRef.current = JSON.stringify(pending.layoutJson)
        // Only clear if nothing newer has been queued since this save started — a later edit
        // already replaced `pending` with fresher content that still needs its own save.
        if (pendingSaveRef.current === pending) pendingSaveRef.current = null
      }).finally(() => {
        if (inFlightSaveRef.current === save) inFlightSaveRef.current = null
      })
    }, 1200)

    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [layout, selectedWorkspaceId, updateWorkspace, broadcastLayout])

  // The autosave above waits 1.2s after the last edit, so a refresh/close inside that window used
  // to drop the change. On page hide, send whatever is still pending with `keepalive` so the
  // request outlives the page (a normal fetch is cancelled by the unload).
  useEffect(() => {
    const flushOnHide = () => {
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      apiFetch(`/api/terminal/workspaces/${pending.workspaceId}`, {
        method: "PATCH",
        keepalive: true,
        body: JSON.stringify({ preset: pending.layoutJson.preset, layoutJson: pending.layoutJson }),
      }).catch(() => {})
    }
    window.addEventListener("pagehide", flushOnHide)
    return () => window.removeEventListener("pagehide", flushOnHide)
  }, [])

  // Panes can be added from the library while no layout exists yet (the "No layouts yet" state),
  // but the autosave above only writes to a selected workspace — so they used to vanish on
  // refresh. Persist them by creating a workspace from the current board the first time one
  // becomes visible. The ref (not createWorkspace.isPending) guards against a second create
  // firing on the render between mutate() and the pending flag flipping.
  const autoCreatingWorkspaceRef = useRef(false)
  useEffect(() => {
    if (!layout || selectedWorkspaceId || !catalog.data || autoCreatingWorkspaceRef.current) return
    if (!layout.panels.some((panel) => panel.visible)) return
    autoCreatingWorkspaceRef.current = true
    const layoutJson = layout
    createWorkspace.mutate(
      { caseId, name: t("untitledLayout"), preset: layoutJson.preset, layoutJson },
      {
        onSuccess: (workspace) => {
          // Panes added while the create was in flight differ from what was sent, so the save
          // effect picks them up as a normal edit once the workspace is selected.
          lastSavedLayoutRef.current = JSON.stringify(layoutJson)
          setSelectedWorkspaceId(workspace.id)
          applyWorkspace.mutate(workspace.id)
          autoCreatingWorkspaceRef.current = false
        },
        // Deliberately not reset on error: the mutation objects in the deps change identity as
        // their state changes, so clearing the guard here would retry in a tight loop while the
        // API is failing. A failed create just stays unsaved until the next reload.
      },
    )
  }, [layout, selectedWorkspaceId, catalog.data, caseId, createWorkspace, applyWorkspace, t])

  const arrangement: ArrangementValue = layout?.arrangement ?? "free"
  const arrangementStageRef = useRef<HTMLDivElement>(null)
  const paneAnimations = useTerminalPaneAnimations({ stageRef: arrangementStageRef, layoutKey: layout })

  // Free/Columns/Tabs/Focus are 4 structurally different layout engines (absolute canvas vs.
  // flex columns vs. a 2-group tab strip vs. a big-pane-plus-rail grid) — switching between them
  // used to be a hard cut, every pane unmounting and a totally different tree mounting in its
  // place. Every mode marks its own per-panel box with the same `data-flip-id={panel.id}` (see
  // the Free-canvas pane, ColumnStack's box, Tabs' active-tab container, Focus's big-pane box),
  // so Flip can carry a panel smoothly from wherever it sat in the old layout to wherever it
  // lands in the new one even though the actual DOM nodes are completely different elements.
  // Panels with no rendered box in one of the two modes (e.g. every Tabs tab that isn't the
  // active one) simply aren't in the `Flip.getState` snapshot and fade in/out normally instead.
  const setArrangement = (next: ArrangementValue) => {
    paneAnimations.capturePaneState()
    // Columns must always be saved with an explicit columnCount: asLayout reads a "columns" save
    // without one as a pre-rework legacy Free layout, so leaving it unset here (it only used to
    // be written once the user clicked a column-count button) made every Columns layout reload
    // as Free, with panes back at their old x/y.
    setLayout((prev) =>
      prev ? { ...prev, arrangement: next, columnCount: next === "columns" ? (prev.columnCount ?? 3) : prev.columnCount } : prev,
    )
  }

  const visiblePanels = useMemo(() => {
    if (!layout) return []
    return [...layout.panels]
      .filter((p) => p.visible && (p.screen ?? 0) === 0 && !HIDDEN_PANELS.has(p.id))
      .sort((a, b) => a.order - b.order)
  }, [layout])

  const availablePanels = useMemo(
    () => catalog.data?.panels.filter((panel) => panel.available && !HIDDEN_PANELS.has(panel.id)) ?? [],
    [catalog.data],
  )

  // Damages & Remedies fills in from a background job (DamagesExtractSvc) that runs after an
  // upload, alongside caseRefresh. Tracked here, at the root, so the pane's name shows it
  // everywhere (header, tab, Focus card, library) even while the pane is closed; the top bar folds
  // it into "Updating analysis".
  const damagesPaneVisible = layout?.panels.some((p) => p.id === "damages" && p.visible) ?? false
  const damagesActivity = useDamagesActivity(caseId, snapshot.data, snapshot.dataUpdatedAt, damagesPaneVisible)
  const paneActivity = useMemo(
    (): Partial<Record<PanelId, "busy" | "fresh">> => (damagesActivity ? { damages: damagesActivity } : {}),
    [damagesActivity],
  )

  // Real, non-fabricated per-pane status text for the Pane Library rows ("3 docs", "2 found",
  // "Ready" — never an invented figure; a pane with nothing to report simply has no entry,
  // which the library renders as an em dash, same spirit as ADR 0013's stance against
  // fabricated stat chips). Computed for every catalog panel, not just hidden ones, so a pane
  // already on the grid still shows its status in the library list.
  // Shared badge computation (computePanelBadges) covers everything identically to a canvas
  // window; damages alone gets an extra layer here for the live busy/fresh activity indicator
  // (useDamagesActivity, primary-window-only context) on top of the shared headline count.
  const panelBadges = useMemo((): Partial<Record<PanelId, string>> => {
    const data = snapshot.data
    if (!data) return {}
    const base = computePanelBadges(data, t)
    return {
      ...base,
      // damagesSummary is typed as always present, but a snapshot from before this case's
      // damages computation last ran can still come back without it.
      damages:
        damagesActivity === "busy"
          ? t("badgeUpdating")
          : damagesActivity === "fresh"
            ? t("badgeNew")
            : (data.damagesSummary?.headCount ?? 0) > 0
              ? t("badgeHeads", { count: data.damagesSummary!.headCount })
              : undefined,
    }
  }, [snapshot.data, t, damagesActivity])

  // Richer, still real-data-only summaries for Focus mode's stack cards — composites of 2-3
  // facts per pane (vs panelBadges' single metric), for the handful of pane types the redesign
  // mock shows worked examples for. Every other pane type falls back to its plain panelBadges
  // entry in FocusArrangement below, rather than inventing a composite the mock never specified.
  // Not memoized — it reads Date.now() (relative "updated Xm ago" text), same as
  // studio-panel.tsx's formatUpdatedAt: recomputing on every render is fine for something this
  // cheap, and keeps it honestly "live" instead of caching a timestamp that goes stale.
  const focusStackSummaries = snapshot.data ? computeFocusStackSummaries(snapshot.data, t) : {}

  const hidePanel = (id: PanelId) => {
    paneAnimations.animatePaneOut(id, panelLibraryRect(id))
    paneAnimations.capturePaneState()
    setMaximizedId((cur) => (cur === id ? null : cur))
    setLayout((prev) => {
      if (!prev) return prev
      const hidden = { ...prev, panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, visible: false } : panel)) }
      // Free canvas: close the gap so the remaining panes re-fill the board (mirror of adding).
      return (prev.arrangement ?? "free") === "free" ? autoTileLayout(hidden, undefined, 0) : hidden
    })
  }

  const toggleMaximize = (id: PanelId) => {
    setMaximizedId((cur) => (cur === id ? null : id))
    bringToFront(id)
  }

  const panelLibraryRect = (id: PanelId) =>
    document.querySelector<HTMLElement>(`[data-panel-library-id="${CSS.escape(id)}"]`)?.getBoundingClientRect() ?? null

  const dragPreviewRect = (id: PanelId) => {
    if (dragPreview?.panelId !== id || !arrangementStageRef.current) return null
    const bounds = arrangementStageRef.current.getBoundingClientRect()
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
    paneAnimations.capturePaneState()
    paneAnimations.queuePaneEntry(id, sourceRect ?? dragPreviewRect(id) ?? panelLibraryRect(id))
    setDragPreview(null)
    setLayout((prev) => {
      if (!prev) return prev
      // A panel re-shown from the Panel Library (e.g. after being hidden from inside a canvas
      // window, where there's no library to re-add it from directly) can still belong to a
      // secondary screen — its `screen` field survives a hide. Re-tiling must target THAT screen,
      // not always screen 0, or the panel reappears with a generic cascade rect no auto-tile ever
      // corrects because autoTileLayout(..., 0) filters it straight out.
      const targetScreen = prev.panels.find((p) => p.id === id)?.screen ?? 0
      const screenPanels = prev.panels.filter((p) => (p.screen ?? 0) === targetScreen)
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      const next = { id, visible: true, order: maxOrder + 1, ...cascadeRect(screenPanels), ...extra }
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
    const bounds = arrangementStageRef.current?.getBoundingClientRect()
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
    hidePanel(oldId)
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

  // Pop-out (per-pane header button, gated on isExtendedScreen so it only ever renders on
  // Chrome/Edge with more than one physical screen) — advances the pane to the next physical
  // screen and opens/reuses that screen's canvas window. ownScreenIndex is 0 here — the primary
  // window is always screen 0.
  const sendToNextScreen = usePopOutToNextScreen({ caseId, ownScreenIndex: 0, layout, setLayout, canvasWindowsRef })
  const popOutPanel = isExtendedScreen ? sendToNextScreen : undefined

  // Bumped after reopenAllScreens mutates canvasWindowsRef (a ref, so it doesn't itself trigger
  // a re-render) so the banner's "still missing" check below re-runs and the banner disappears.
  const [, bumpCanvasWindowsVersion] = useReducer((n: number) => n + 1, 0)

  // window.open needs a genuine user gesture, so canvas windows can't silently reopen after a
  // page reload — this is that gesture. One combined banner (not per-screen), click opens every
  // secondary screen this workspace's panels are still assigned to but this tab hasn't tracked a
  // window for, all inside this single click's gesture (satisfies the popup-blocker requirement
  // even for several windows at once).
  const reopenAllScreens = async () => {
    if (!layout || !window.getScreenDetails) return
    let details: { screens: ScreenDetailed[] }
    try {
      details = await window.getScreenDetails()
    } catch {
      return
    }
    const secondary = sortedSecondaryScreens(details)
    for (const screenIndex of screenIndicesInUse(layout.panels)) {
      if (canvasWindowsRef.current.has(screenIndex)) continue
      const screen = secondary[screenIndex - 1]
      if (screen) openCanvasWindow(caseId, screenIndex, screen, canvasWindowsRef)
    }
    bumpCanvasWindowsVersion()
  }

  // Backs the AI Assistant panel's "jump to panel" link (see ChatPanel/ConsultationChat) — makes
  // whatever panel the AI's reply named actually visible, in whichever arrangement is active,
  // without repositioning a panel that's already on the grid (showPanelAt would re-cascade it).
  const jumpToPanel = (id: PanelId) => {
    const isVisible = layout?.panels.some((panel) => panel.id === id && panel.visible) ?? false
    if (!isVisible) requestAddPanel(id)
    bringToFront(id)
    setMaximizedId(null)
    setFocusedId(id)
    // Harmless if `id` isn't actually a member of Tabs' group A or B — TabsArrangement only
    // treats an active-tab id as real when it finds it in that group's own panel list.
    setTabsActiveA(id)
    setTabsActiveB(id)
  }

  const flushPendingSave = async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
      const pending = pendingSaveRef.current
      pendingSaveRef.current = null
      if (pending) {
        const save = updateWorkspace.mutateAsync({
          id: pending.workspaceId,
          preset: pending.layoutJson.preset,
          layoutJson: pending.layoutJson,
        })
        inFlightSaveRef.current = save
        save.finally(() => {
          if (inFlightSaveRef.current === save) inFlightSaveRef.current = null
        })
      }
    }
    await inFlightSaveRef.current
  }

  const selectWorkspace = async (id: string) => {
    await flushPendingSave()
    paneAnimations.capturePaneState()
    setSelectedWorkspaceId(id)
    setMaximizedId(null)
    const workspace = workspaces.data?.find((w) => w.id === id)
    if (!workspace || !layout) return
    const hydrated = hydrateFreeform(mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? []))
    lastSavedLayoutRef.current = JSON.stringify(hydrated)
    setLayout(hydrated)
    applyWorkspace.mutate(id)
  }

  // The ScreenPresetsModal's onCreate callback (mode="create") — builds the new tab's layout from
  // the CHOSEN preset (applyScreenPreset, the same function Workflows' apply mode uses) instead of
  // cloning whatever arrangement happens to be on screen, which is what this used to do before the
  // preset picker existed.
  const handleCreateLayout = (name: string, preset: ScreenPresetDef) => {
    if (!catalog.data || !name) return
    const fallback: WorkspaceLayout = {
      preset: catalog.data.defaultPreset,
      arrangement: "free",
      panels: catalog.data.panels.map((panel, index) => ({ id: panel.id, visible: false, order: index, width: 1, height: 1 })),
    }
    const layoutJson = applyScreenPreset(fallback, preset)
    createWorkspace.mutate(
      { caseId, name, layoutJson },
      {
        onSuccess: (workspace) => {
          lastSavedLayoutRef.current = JSON.stringify(layoutJson)
          setSelectedWorkspaceId(workspace.id)
          setLayout(layoutJson)
          applyWorkspace.mutate(workspace.id)
        },
      },
    )
  }

  // Resets the CURRENT tab's contents back to empty, in place — previously this called the
  // backend's /workspaces/reset endpoint, which always *creates* a new "Default {preset}" row,
  // so every click piled up another duplicate tab instead of resetting the one you were
  // looking at. Resets to an EMPTY board rather than re-applying catalog.data.defaultPreset
  // (see #303) — the user picks what to add back via the panel library, same as a brand-new
  // workspace with no saved layout yet.
  const resetCurrentWorkspace = () => {
    if (!catalog.data || !selectedWorkspaceId) return
    setMaximizedId(null)
    const preset = catalog.data.defaultPreset
    const emptyLayout: WorkspaceLayout = {
      preset,
      arrangement: "free",
      panels: catalog.data.panels.map((panel, index) => ({
        id: panel.id,
        visible: false,
        order: index,
        width: 1,
        height: 1,
      })),
    }
    lastSavedLayoutRef.current = JSON.stringify(emptyLayout)
    setLayout(emptyLayout)
    updateWorkspace.mutate({ id: selectedWorkspaceId, preset, layoutJson: emptyLayout })
  }

  // Deleting the active tab falls back to the first remaining layout. Deleting the final layout
  // is allowed and leaves the terminal in an empty state until the user creates a new one.
  // The tab strip's × asks first (see the delete-layout dialog below): closing a layout tab
  // deletes that saved workspace outright, with no undo.
  const [layoutPendingDelete, setLayoutPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const closeWorkspaceTab = (id: string) => {
    const [fallback] = (workspaces.data ?? []).filter((w) => w.id !== id)
    deleteWorkspace.mutate(id, {
      onSuccess: () => {
        if (id !== selectedWorkspaceId) return
        if (fallback) {
          selectWorkspace(fallback.id)
          return
        }
        setSelectedWorkspaceId("")
        lastSavedLayoutRef.current = ""
        setLayout((prev) =>
          prev
            ? { ...prev, panels: prev.panels.map((panel) => ({ ...panel, visible: false })) }
            : prev,
        )
      },
    })
  }

  // `layout` isn't set until the effect above sees both catalog and workspaces resolved, so the
  // loading gate has to track workspaces too — otherwise a workspaces fetch that outlasts
  // catalog/snapshot closes this gate one render early and falls through to the error state below
  // (`!layout` still true, effect hasn't committed yet) even though nothing has actually failed.
  if (snapshot.isLoading || catalog.isLoading || workspaces.isLoading || (!layout && !snapshot.isError && !catalog.isError)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-background font-['Inter'] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    )
  }

  if (snapshot.isError || catalog.isError || !snapshot.data || !layout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="text-destructive">{t("loadError")}</p>
        <button type="button" onClick={() => snapshot.refetch()} className="text-xs font-semibold uppercase tracking-wider text-brand-gold hover:underline">
          {t("retry")}
        </button>
      </div>
    )
  }

  const nextLabel =
    snapshot.data.nextDate && "dateTime" in snapshot.data.nextDate
      ? new Date(snapshot.data.nextDate.dateTime).toLocaleDateString()
      : snapshot.data.nextDate && "occurredOn" in snapshot.data.nextDate && snapshot.data.nextDate.occurredOn
        ? new Date(snapshot.data.nextDate.occurredOn).toLocaleDateString()
        : t("noNextDate")

  const labelFor = (panel: PanelLayout | { id: PanelId }) =>
    PANEL_TITLES[panel.id] ?? catalog.data?.panels.find((p) => p.id === panel.id)?.label ?? panel.id


  // Shared opener for both the toolbar "Workflows" button (apply mode) and "+ New Layout" (create
  // mode) — same screen-detection flow either way. Workflows is available on any screen count now,
  // not just multi-monitor setups — a single-screen lawyer just never sees more than the
  // screenCount:1 presets. Detection failing (no Window Management API, or permission denied)
  // used to mean "give up" when this button was multi-screen-only; now it just means "assume the
  // one screen this page is already on."
  const openPresetsModal = (mode: "apply" | "create") => {
    setPresetsModalMode(mode)
    setDetectedScreenCount(null)
    setPresetsModalOpen(true)
    if (!window.getScreenDetails) {
      setDetectedScreenCount(1)
      return
    }
    window
      .getScreenDetails()
      .then((details) => setDetectedScreenCount(1 + sortedSecondaryScreens(details).length))
      .catch(() => setDetectedScreenCount(1))
  }

  return (
    <PaneActivityContext.Provider value={paneActivity}>
    <div ref={rootRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background font-['Inter'] text-foreground">
        {/* Case row */}
        <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-card px-4">
          {/* Inline with the row instead of TerminalSettingsSidebar's own floating trigger —
              see mobileLibraryOpen above. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setMobileLibraryOpen(true)}
                aria-label={t("sidebarOpen")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover lg:hidden"
              >
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("sidebarOpen")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/homepage/case-portfolio/${caseId}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {t("backToCases")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>{t("backToCases")}</TooltipContent>
          </Tooltip>
          <span className="hidden h-4 w-px shrink-0 bg-border sm:block" aria-hidden="true" />
          <h1 className="min-w-0 shrink truncate font-['Libre_Caslon_Text'] text-sm font-normal text-foreground md:text-base">
            {snapshot.data.case.caseName}
          </h1>
          <span className="hidden shrink-0 rounded-md border border-riskmed/30 bg-riskmed/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-riskmed sm:inline">
            {t("next")}: <span className="font-mono normal-case tracking-normal">{nextLabel}</span>
          </span>
          {shouldShowUpdatingAnalysis(refreshJob.data?.status, damagesJob.data?.status) && (
            <span className="hidden shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground sm:inline-flex">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t("updatingAnalysis")}
            </span>
          )}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setBriefPreviewOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("downloadCaseBrief")}
            </button>
          </div>
        </div>
        <ScreenPresetsModal
          open={presetsModalOpen}
          onOpenChange={setPresetsModalOpen}
          detectedCount={detectedScreenCount}
          caseId={caseId}
          layout={layout}
          setLayout={setLayout}
          canvasWindowsRef={canvasWindowsRef}
          mode={presetsModalMode}
          onCreate={handleCreateLayout}
        />
        <Sheet open={briefPreviewOpen} onOpenChange={setBriefPreviewOpen}>
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <SheetHeader>
              <SheetTitle>{t("downloadCaseBrief")}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1">
              <CaseBriefContent caseId={caseId} />
            </div>
          </SheetContent>
        </Sheet>

        {/* Terminal bar: layout tabs, arrangement switch, pane count, and settings */}
        <div className="flex h-12 shrink-0 items-stretch gap-4 overflow-x-auto border-b border-border bg-card px-4">
          <LayoutTabStrip
            tabs={workspaces.data ?? []}
            activeId={selectedWorkspaceId}
            onSelect={selectWorkspace}
            onClose={(id) => {
              const tab = workspaces.data?.find((w) => w.id === id)
              if (tab) setLayoutPendingDelete({ id: tab.id, name: tab.name })
            }}
            onNew={() => openPresetsModal("create")}
            onRename={(id, name) => renameWorkspace.mutate({ id, name })}
            labels={{
              close: t("closeLayout"),
              newLayout: t("newLayout"),
              scrollLeft: t("layoutTabsScrollLeft"),
              scrollRight: t("layoutTabsScrollRight"),
              rename: t("renameLayout"),
              renameHint: t("renameLayoutHint"),
              renameKeys: t("renameLayoutKeys"),
            }}
          />
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="flex shrink-0 items-center rounded-full border border-border p-0.5">
              <button
                type="button"
                onClick={() => openPresetsModal("apply")}
                title={t("workflowsAvailable")}
                className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
              >
                <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                {t("workflows")}
              </button>
            </div>
            <ArrangementSwitcher
              arrangement={arrangement}
              onSetArrangement={setArrangement}
              columnCount={layout.columnCount ?? 3}
              onSetColumnCount={setColumnCount}
              t={t}
            />
            <span className="hidden text-[10px] uppercase tracking-[1px] text-muted-foreground sm:inline">
              {t("paneCount", { count: visiblePanels.length, total: availablePanels.length })}
            </span>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("settingsTab")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>{t("settingsTab")}</TooltipContent>
              </Tooltip>
              {/* Portaled inside rootRef (same stacking context as the Free-canvas panes, see
                  PopoverContent's own container doc comment), so it needs a z-index above the
                  pane ceiling (bringToFront grows panel.order past Radix's default z-50 during
                  ordinary use) rather than Radix's default. */}
              <PopoverContent container={rootRef.current} className="z-(--z-canvas-overlay)">
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">
                      {t("displayPreferences")}
                    </p>
                    <div className="flex flex-col gap-1">
                      <PreferenceToggle label={t("highDensityMode")} checked={highDensity} onChange={setHighDensity} />
                      <PreferenceToggle label={t("panelLabels")} checked={panelLabels} onChange={setPanelLabels} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">
                      {t("loadWorkspace")}
                    </p>
                    <button
                      type="button"
                      onClick={resetCurrentWorkspace}
                      className="h-8 w-full rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                    >
                      {t("reset")}
                    </button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

      {/* Pane Library sits below the Case Row/Terminal Bar, not beside them — it only spans the
          stage's height, not the full pane height up to the case title. */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <TerminalSettingsSidebar
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
          isMobileOpen={mobileLibraryOpen}
          onMobileOpenChange={setMobileLibraryOpen}
          allPanels={availablePanels}
          visiblePanelIds={visiblePanels.map((p) => p.id)}
          panelBadges={panelBadges}
          onAddPanel={requestAddPanel}
          onPanelDragStart={beginPanelDrag}
          onPanelDragEnd={() => setDragPreview(null)}
        />
        <div
          className={`relative flex min-h-0 flex-1 flex-col overflow-hidden transition-[padding-left] duration-200 lg:pl-16 ${
            sidebarExpanded ? "lg:pl-72" : ""
          }`}
        >
        {snapshot.data.fatalRisks.length > 0 && (
          <div className="px-3 pt-3">
            <FatalRiskBanner risks={snapshot.data.fatalRisks} />
          </div>
        )}

        {isExtendedScreen && !resumePromptDismissed && (() => {
          const missingScreens = screenIndicesInUse(layout.panels).filter((idx) => !canvasWindowsRef.current.has(idx))
          if (missingScreens.length === 0) return null
          const panelCount = layout.panels.filter((p) => missingScreens.includes(p.screen ?? 0)).length
          return (
            <Dialog open onOpenChange={(open) => !open && setResumePromptDismissed(true)}>
              <DialogContent className="max-w-sm gap-0 overflow-hidden p-0">
                <div className="px-6 py-5">
                  <DialogTitle asChild>
                    <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("resumeScreensTitle")}</h2>
                  </DialogTitle>
                  <DialogDescription asChild>
                    <p className="mt-1 text-xs text-muted-foreground">{t("reopenScreensBanner", { count: panelCount })}</p>
                  </DialogDescription>
                </div>
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/40">
                  <button
                    type="button"
                    onClick={() => setResumePromptDismissed(true)}
                    className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors"
                  >
                    {t("cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResumePromptDismissed(true)
                      reopenAllScreens()
                    }}
                    className="bg-brand-gold text-brand-navy-950 text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
                  >
                    {t("reopenScreensAction")}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          )
        })()}

        <TerminalCanvas
          caseId={caseId}
          stageRef={arrangementStageRef}
          snapshot={snapshot.data}
          visiblePanels={visiblePanels}
          labelFor={labelFor}
          panelBadges={panelBadges}
          focusStackSummaries={focusStackSummaries}
          panelLabels={panelLabels}
          t={t}
          arrangement={arrangement}
          columnCount={layout.columnCount ?? 3}
          columnWidths={layout.columnWidths ?? []}
          tabsSplit={layout.tabsSplit ?? 0.5}
          tabsActiveA={layout.tabsActiveA ?? null}
          tabsActiveB={layout.tabsActiveB ?? null}
          onSetColumnWidths={setColumnWidths}
          onSetTabsSplit={setTabsSplit}
          onSetTabsActiveA={setTabsActiveA}
          onSetTabsActiveB={setTabsActiveB}
          onPatchPanel={patchPanel}
          onHide={hidePanel}
          onPopOut={popOutPanel}
          onJumpToPanel={jumpToPanel}
          onBringToFront={bringToFront}
          maximizedId={maximizedId}
          onToggleMaximize={toggleMaximize}
          focusedId={focusedId}
          onFocus={setFocusedId}
          dragPreview={dragPreview}
          onDragPreviewChange={setDragPreview}
          draggingId={draggingId}
          onDraggingIdChange={setDraggingId}
          onDropNew={requestAddPanel}
          onDropAtRect={dropPanelAtRect}
          onDragPreviewUpdate={updateDragPreview}
          emptyStateAction={{ label: t("addNewLayout"), onClick: () => openPresetsModal("create") }}
        >
          {layoutPendingDelete && (
            <ModalOverlay
              onClose={() => setLayoutPendingDelete(null)}
              labelledBy="delete-layout-title"
              aria-describedby="delete-layout-body"
              role="alertdialog"
              backdropClassName="absolute inset-0 z-[95] flex items-center justify-center bg-black/50"
              className="w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-2xl focus:outline-none"
            >
              {(close) => (
                <>
                  <div className="mb-3 flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p id="delete-layout-title" className="text-xs font-semibold uppercase tracking-[1.2px] text-foreground">
                        {t("deleteLayoutTitle")}
                      </p>
                      <p id="delete-layout-body" className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {t("deleteLayoutBody", { name: layoutPendingDelete.name })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      type="button"
                      autoFocus
                      onClick={close}
                      className="h-8 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        closeWorkspaceTab(layoutPendingDelete.id)
                        close()
                      }}
                      className="h-8 rounded-md bg-danger px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-danger/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                    >
                      {t("deleteLayoutConfirm")}
                    </button>
                  </div>
                </>
              )}
            </ModalOverlay>
          )}
          {replaceTarget && layout && (
            <ModalOverlay
              onClose={() => setReplaceTarget(null)}
              labelledBy="replace-pane-prompt"
              backdropClassName="absolute inset-0 z-[95] flex items-center justify-center bg-background/50"
              className="w-72 rounded-lg border border-border bg-card p-3 shadow-2xl focus:outline-none"
            >
              {(close) => (
                <>
                  <p id="replace-pane-prompt" className="mb-2 text-xs text-foreground">
                    {t("replacePanePrompt")}
                  </p>
                  {(() => {
                    const replaceable = visiblePanels.filter((p) => !p.pinned)
                    if (replaceable.length === 0) {
                      return <p className="text-xs text-muted-foreground">{t("noUnpinnedPanes")}</p>
                    }
                    return (
                      <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
                        {replaceable.map((panel) => (
                          <li key={panel.id}>
                            <button
                              type="button"
                              onClick={() => replacePaneInColumns(panel.id, replaceTarget)}
                              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover"
                            >
                              <span className="min-w-0 flex-1 truncate">{labelFor(panel)}</span>
                              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-brand-gold">{t("replacePane")}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  })()}
                  <button
                    type="button"
                    onClick={close}
                    className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t("cancel")}
                  </button>
                </>
              )}
            </ModalOverlay>
          )}
        </TerminalCanvas>
        </div>
      </div>
    </div>
    </PaneActivityContext.Provider>
  )
}

function PreferenceToggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-1 py-1.5 hover:bg-muted dark:hover:bg-overlay-hover">
      <span className="text-[13px] text-foreground">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-brand-gold" : "bg-muted-foreground/30"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background dark:bg-foreground shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  )
}

function columnCount(preset: PresetValue, n: number) {
  if (n <= 1) return 1
  if (preset === "PANE_6" || n >= 5) return 3
  if (preset === "PANE_1") return 1
  return 2
}

// Scoped to screen 0 (primary) only — a secondary screen's own panels are a different canvas
// with their own independent tiling (multi-screen.ts's autoTileLayout), and mixing them into
// this pass would squeeze the primary's own panels into a grid sized for both screens combined.
function tileLayout(layout: WorkspaceLayout): WorkspaceLayout {
  const visible = [...layout.panels]
    .filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id) && (panel.screen ?? 0) === 0)
    .sort((a, b) => a.order - b.order)
  const cols = columnCount(layout.preset, visible.length)
  const rows = Math.max(1, Math.ceil(visible.length / cols))
  const width = 1 / cols
  const height = 1 / rows
  const byId = new Map(
    visible.map((panel, index) => [
      panel.id,
      {
        x: (index % cols) * width,
        y: Math.floor(index / cols) * height,
        width,
        height,
      },
    ]),
  )
  return {
    ...layout,
    panels: layout.panels.map((panel) => {
      const rect = byId.get(panel.id)
      return rect ? { ...panel, ...rect } : panel
    }),
  }
}

// ponytail: tileLayout also rewrites every visible panel's `height`, which Columns mode
// reinterprets as "fraction of its column" rather than Free's "fraction of the canvas" — if
// this ever fires on a Columns-mode layout (only possible if a visible panel is somehow still
// missing x/y, which showPanelAt/applyPreset always set) it'll reset that layout's in-column
// stack proportions too. Give Columns its own height-like field if that turns out to matter.
function hydrateFreeform(layout: WorkspaceLayout): WorkspaceLayout {
  // Screen 0 only — a secondary screen's panel legitimately has no x/y when that screen's own
  // arrangement is Tabs/Columns (neither reads x/y), and that must never be read as "the primary
  // needs retiling" and bulldoze whatever Free-canvas arrangement it already has.
  const visible = layout.panels.filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id) && (panel.screen ?? 0) === 0)
  if (visible.some((panel) => !Number.isFinite(panel.x) || !Number.isFinite(panel.y))) {
    return tileLayout(layout)
  }
  return layout
}

