"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import {
  AppWindow,
  ArrowLeft,
  ArrowLeftRight,
  Columns3,
  Download,
  Grip,
  LayoutPanelLeft,
  Loader2,
  AlertCircle,
  Move,
  Pin,
  Plus,
  PanelLeft,
  PanelTop,
  Maximize2,
  Minimize2,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react"
import { FatalRiskBanner, TerminalPanelBody } from "@/components/terminal/terminal-panels"
import { CaseBriefContent } from "@/components/case-brief/case-brief-content"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import {
  useAiJobStatus,
  useApplyWorkspaceMutation,
  useCaseSnapshotQuery,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useTerminalCatalogQuery,
  useTerminalWorkspacesQuery,
  useUpdateWorkspaceMutation,
} from "@/lib/terminal/mutations"
import type {
  ArrangementValue,
  CaseSnapshot,
  FindingCategory,
  PanelId,
  PanelLayout,
  PresetValue,
  WorkspaceLayout,
} from "@/lib/terminal/types"
import { shouldShowUpdatingAnalysis } from "@/lib/terminal/refresh-status"
import { useTerminalPaneAnimations } from "@/lib/terminal/use-terminal-pane-animations"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import TerminalSettingsSidebar from "@/components/terminal/terminal-settings-sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"

// "dates" is permanently folded into Evidence & Timeline (TerminalPanelBody renders it as
// null) — redTeam is a real, addable panel now, not force-hidden the way it used to be.
const HIDDEN_PANELS = new Set<PanelId>(["dates"])

export const PANEL_TITLES: Record<PanelId, string> = {
  command: "Case Summary",
  evidence: "Evidence & Timeline",
  law: "Law & Precedent",
  dates: "Timeline",
  chat: "AI Legal Assistant",
  mindMap: "Visual Strategy Map",
  citationMap: "Citation Map",
  redTeam: "Red Team",
  procedure: "Case Strategy",
  teamAudit: "Team & Audit",
  contradictions: "Contradictions",
  legalIssues: "Legal Issues",
  weaknesses: "Weaknesses",
  strengths: "Strengths",
  attackStrategy: "Attack Strategies",
  defenseStrategy: "Defense Strategies",
  witnesses: "Witnesses",
  damages: "Damages & Remedies",
  caseReconstruction: "Case Reconstruction",
  audioOverview: "Audio Overview",
  decisions: "Decisions",
  theories: "Theories",
}

const ARRANGEMENTS: { id: ArrangementValue; labelKey: string; icon: LucideIcon }[] = [
  { id: "free", labelKey: "arrangementFree", icon: Move },
  { id: "columns", labelKey: "arrangementColumns", icon: Columns3 },
  { id: "tabs", labelKey: "arrangementTabs", icon: PanelTop },
  { id: "focus", labelKey: "arrangementFocus", icon: LayoutPanelLeft },
]

// Drives the New Layout dialog's preset picker — labels already exist in every locale (see
// terminal.json's preset1/preset2/preset4/preset6), just never rendered anywhere until now.
const PRESET_LABEL_KEYS: Record<PresetValue, string> = {
  PANE_1: "preset1",
  PANE_2: "preset2",
  PANE_4: "preset4",
  PANE_6: "preset6",
}

const COLUMN_COUNT_OPTIONS = [2, 3, 4]
// How many panes a single column can stack before it's "full" and adding another pane
// requires replacing one instead.
const MAX_PANES_PER_COLUMN = 3

const MIN_FR = 0.18
const PANE_GAP_PX = 6
// 1/24 gives a 24-column/row grid — fine enough not to feel restrictive at
// MIN_FR-sized panes (~4.3 cells) but still a real snap, not a cosmetic one.
const GRID_SNAP_STEP = 1 / 24
// Minimum width/height fraction a Columns-mode column or stacked pane can be resized down to —
// same neighbor-trade + floor model as the Free canvas's MIN_FR, just a separate constant since
// this grid's minimum can be roomier (fewer, larger panes than the freeform canvas).
const MIN_COLUMN_FR = 0.12
// Fraction nudged per arrow-key press on any resize divider/handle — the keyboard alternative
// to pointer-drag resize (WCAG 2.5.7). Deliberately coarser than GRID_SNAP_STEP (~0.042) so a
// keyboard user can reach a meaningfully different size in a handful of presses.
const RESIZE_KEY_STEP = 0.02
// What ModalOverlay below treats as a tab stop when trapping focus inside itself.
const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

// Shared by every pointer-drag in this file (pane move/resize, column/stack/tab-split
// dividers): setPointerCapture alone doesn't stop the browser from starting a native text
// selection under the initial pointerdown (e.g. a header title), which then keeps extending
// as the pointer moves and makes the drag look like it's fighting itself. Module-scoped
// (not per-component) since body.style is global and only one drag runs at a time. Mirrors
// use-resizable-width.ts's cursor/selection lock.
let prevBodyUserSelect: string | null = null
function lockSelection() {
  if (prevBodyUserSelect !== null) return
  prevBodyUserSelect = document.body.style.userSelect
  document.body.style.userSelect = "none"
}
function unlockSelection() {
  if (prevBodyUserSelect === null) return
  document.body.style.userSelect = prevBodyUserSelect
  prevBodyUserSelect = null
}

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
type PaneRect = { x: number; y: number; width: number; height: number }
type ResizeEdge = { n?: boolean; s?: boolean; e?: boolean; w?: boolean }
type ResizeDrag = PaneRect & {
  panelId: PanelId
  edges: ResizeEdge
  startX: number
  startY: number
  // Set on every live pointermove, read back on pointer-up to compute the one snapped commit —
  // see the live-drag comment near resizeRef/moveRef below.
  lastDx?: number
  lastDy?: number
}
type MoveDrag = PaneRect & {
  panelId: PanelId
  startX: number
  startY: number
  armed: boolean
  lastDx?: number
  lastDy?: number
}
type PaneDragPreview = PaneRect & { panelId: PanelId }

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
  const catalog = useTerminalCatalogQuery()
  const workspaces = useTerminalWorkspacesQuery(caseId)
  const snapshot = useCaseSnapshotQuery(caseId)
  const createWorkspace = useCreateWorkspaceMutation()
  const updateWorkspace = useUpdateWorkspaceMutation()
  const applyWorkspace = useApplyWorkspaceMutation()
  const deleteWorkspace = useDeleteWorkspaceMutation()
  // No manual "Refresh analysis" trigger — the Legal Terminal relies entirely on the automatic
  // caseRefresh pipeline (corpus-change triggered) now. This poll is what drives the
  // "Updating analysis…" indicator below while that background job is running.
  const refreshJob = useAiJobStatus(caseId, "caseRefresh")

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
  const [newLayoutOpen, setNewLayoutOpen] = useState(false)
  const [newLayoutPreset, setNewLayoutPreset] = useState<PresetValue>("PANE_4")
  const [newLayoutName, setNewLayoutName] = useState("")
  const [briefPreviewOpen, setBriefPreviewOpen] = useState(false)
  const panelLabels = useTerminalDisplayStore((state) => state.panelLabels)
  const setPanelLabels = useTerminalDisplayStore((state) => state.setPanelLabels)
  const highDensity = useTerminalDisplayStore((state) => state.highDensity)
  const setHighDensity = useTerminalDisplayStore((state) => state.setHighDensity)
  // Popover content portals outside this component's DOM subtree by default — keeping it
  // inside `rootRef` (the `dark`-scoped root below) is what makes it pick up the terminal's
  // forced near-black palette instead of the page's actual light/dark theme.
  const rootRef = useRef<HTMLDivElement>(null)
  const resizeRef = useRef<ResizeDrag | null>(null)
  const moveRef = useRef<MoveDrag | null>(null)
  // Drag/resize used to call setLayout() (a full state update, re-rendering every visible pane's
  // contents) on every raw pointermove — a measured cause of visible lag. Now both are throttled
  // to one DOM write per animation frame (scheduleFrame below), since pointer devices fire move
  // events far more often than the screen repaints, and grid-snapping is applied only once, on
  // pointer-up (via the dx/dy stashed on resizeRef/moveRef), not on every live frame — snapping
  // mid-drag is what made the pane appear to teleport between grid cells instead of tracking the
  // cursor. Move's live frames use a compositor-only `transform` (applyLiveMoveTransform) since
  // translating a whole box doesn't distort it; resize writes real left/top/width/height
  // (applyLiveResizeStyle) because a scale()-transform experiment made content visibly stretch
  // while dragging, which looked worse than the reflow cost it was meant to avoid — contain-layout
  // on the pane (see its className) keeps that reflow scoped and affordable instead.
  const liveStyleRafRef = useRef<number | null>(null)
  const lastSavedLayoutRef = useRef("")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ workspaceId: string; layoutJson: WorkspaceLayout } | null>(null)
  const inFlightSaveRef = useRef<Promise<unknown> | null>(null)
  // Tracks pop-out windows this tab opened, so the polling effect below can flip a pane back to
  // visible the moment its popup closes. A ref, not state — nothing here needs to re-render.
  const popupWindowsRef = useRef<Map<PanelId, Window>>(new Map())

  // Only reliable cross-window signal a popup gives its opener without any cooperation from the
  // popped-out page itself (no postMessage/BroadcastChannel wiring needed either side).
  useEffect(() => {
    const interval = setInterval(() => {
      for (const [id, win] of popupWindowsRef.current) {
        if (!win.closed) continue
        popupWindowsRef.current.delete(id)
        setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: true } : p)) } : prev))
      }
    }, 500)
    return () => clearInterval(interval)
  }, [])

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

    pendingSaveRef.current = { workspaceId: selectedWorkspaceId, layoutJson: layout }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      const pending = pendingSaveRef.current
      pendingSaveRef.current = null
      if (!pending) return
      const save = updateWorkspace.mutateAsync({
        id: pending.workspaceId,
        preset: pending.layoutJson.preset,
        layoutJson: pending.layoutJson,
      })
      inFlightSaveRef.current = save
      save.then(() => {
        if (lastSavedLayoutRef.current === JSON.stringify(pending.layoutJson)) return
        lastSavedLayoutRef.current = JSON.stringify(pending.layoutJson)
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
  }, [layout, selectedWorkspaceId, updateWorkspace])

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
    setLayout((prev) => (prev ? { ...prev, arrangement: next } : prev))
  }

  const visiblePanels = useMemo(() => {
    if (!layout) return []
    return [...layout.panels].filter((p) => p.visible && !HIDDEN_PANELS.has(p.id)).sort((a, b) => a.order - b.order)
  }, [layout])

  const availablePanels = useMemo(
    () => catalog.data?.panels.filter((panel) => panel.available && !HIDDEN_PANELS.has(panel.id)) ?? [],
    [catalog.data],
  )

  // Real, non-fabricated per-pane status text for the Pane Library rows ("3 docs", "2 found",
  // "Ready" — never an invented figure; a pane with nothing to report simply has no entry,
  // which the library renders as an em dash, same spirit as ADR 0013's stance against
  // fabricated stat chips). Computed for every catalog panel, not just hidden ones, so a pane
  // already on the grid still shows its status in the library list.
  const panelBadges = useMemo((): Partial<Record<PanelId, string>> => {
    const data = snapshot.data
    if (!data) return {}
    const found = (n: number) => (n > 0 ? t("badgeFound", { count: n }) : undefined)
    const byCategory = (category: FindingCategory) => found(data.findings.filter((f) => f.category === category).length)
    const badges: Partial<Record<PanelId, string>> = {
      command: data.case.parties.length > 0 ? t("badgeParties", { count: data.case.parties.length }) : undefined,
      evidence: data.documents.length > 0 ? t("badgeDocs", { count: data.documents.length }) : undefined,
      law: data.law.citations.length > 0 ? t("badgeCited", { count: data.law.citations.length }) : undefined,
      citationMap: (() => {
        const mapped = data.law.citations.filter((c) => c.resolvedAuthority).length
        return mapped > 0 ? t("badgeMapped", { count: mapped }) : undefined
      })(),
      mindMap: data.mindMap.lastGeneratedAt ? (data.mindMap.isStale ? t("badgeStale") : t("badgeReady")) : undefined,
      redTeam: data.redTeamAssessment ? t("badgeReady") : undefined,
      procedure: (() => {
        const open = data.procedure.items.filter((i) => !i.done).length
        return open > 0 ? t("badgeToDos", { count: open }) : undefined
      })(),
      teamAudit: data.teamAudit.audit.length > 0 ? t("badgeEvents", { count: data.teamAudit.audit.length }) : undefined,
      contradictions: found(data.evidence.contradictions.length),
      legalIssues: byCategory("LEGAL_ISSUE"),
      weaknesses: byCategory("WEAKNESS"),
      strengths: byCategory("STRENGTH"),
      attackStrategy: byCategory("ATTACK_STRATEGY"),
      defenseStrategy: byCategory("DEFENSE_STRATEGY"),
      witnesses: data.witnesses.length > 0 ? t("badgeWitnesses", { count: data.witnesses.length }) : undefined,
      damages: data.damages.length > 0 ? t("badgeClaims", { count: data.damages.length }) : undefined,
      caseReconstruction: data.reconstruction ? t("badgeReady") : undefined,
      audioOverview: data.reconstruction?.audioFileId ? t("badgeReady") : undefined,
      decisions: data.decisions.length > 0 ? t("badgeDecisions", { count: data.decisions.length }) : undefined,
      theories: data.theories.length > 0 ? t("badgeTheories", { count: data.theories.length }) : undefined,
    }
    return badges
  }, [snapshot.data, t])

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
      return { ...prev, panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, visible: false } : panel)) }
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
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      const next = { id, visible: true, order: maxOrder + 1, ...cascadeRect(prev.panels), ...extra }
      if (prev.panels.some((panel) => panel.id === id)) {
        return {
          ...prev,
          panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, ...next } : panel)),
        }
      }
      return { ...prev, panels: [...prev.panels, next] }
    })
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

  // Opens the panel in its own window (see app/(protected)/homepage/terminal/[caseId]/panel/
  // [panelId]/page.tsx — a minimal, independent page hitting the same API, no cross-window sync).
  // The pane hides from the main grid — same mechanism as hidePanel, just without touching
  // maximizedId's "is this the maximized one" semantics beyond clearing it if it matches — while
  // the popup is open (see the polling effect below for how it comes back once closed).
  const popOutPanel = (id: PanelId) => {
    const win = window.open(
      `/homepage/terminal/${caseId}/panel/${id}`,
      `terminal-panel-${caseId}-${id}`,
      "width=560,height=680",
    )
    if (!win) return
    popupWindowsRef.current.set(id, win)
    setMaximizedId((cur) => (cur === id ? null : cur))
    setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: false } : p)) } : prev))
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

  // Coalesces live-drag DOM writes to once per animation frame — pointer devices can fire many
  // more raw pointermove events than the display can repaint, so writing on every raw event was
  // doing far more work than frames actually rendered.
  const scheduleFrame = (fn: () => void) => {
    if (liveStyleRafRef.current != null) cancelAnimationFrame(liveStyleRafRef.current)
    liveStyleRafRef.current = requestAnimationFrame(() => {
      liveStyleRafRef.current = null
      fn()
    })
  }
  const cancelFrame = () => {
    if (liveStyleRafRef.current != null) {
      cancelAnimationFrame(liveStyleRafRef.current)
      liveStyleRafRef.current = null
    }
  }

  const patchPanelRect = (panelId: PanelId, rect: PaneRect) => {
    setLayout((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        panels: prev.panels.map((panel) => (panel.id === panelId ? { ...panel, ...rect } : panel)),
      }
    })
  }

  const onResizePointerDown = (panel: PanelLayout, edges: ResizeEdge, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    lockSelection()
    const rect = panelRect(panel)
    bringToFront(panel.id)
    resizeRef.current = { panelId: panel.id, edges, startX: event.clientX, startY: event.clientY, ...rect }
  }

  // Ends the resize started by onResizePointerDown, committing the final snapped rect. Called
  // from the normal pointerup/pointercancel/lostpointercapture paths, and also defensively from
  // onResizePointerMove itself — see the comment there for why capture can go missing mid-drag.
  const endResize = () => {
    const drag = resizeRef.current
    if (drag && drag.lastDx !== undefined && drag.lastDy !== undefined) {
      patchPanelRect(drag.panelId, clampResize(drag, drag.lastDx, drag.lastDy, true))
    }
    cancelFrame()
    resizeRef.current = null
    unlockSelection()
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current
    const grid = document.getElementById("terminal-grid")
    if (!drag || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    // Safety net: bringToFront (called on pointerdown, below) reorders the panel array that the
    // pane divs are mapped from, which can move this handle's ancestor pane in the DOM mid-drag —
    // browsers can silently drop pointer capture on that kind of mutation, with no pointerup or
    // pointercancel ever firing. Without this check, the next hover-only pointermove over the
    // handle (buttons === 0) would still resize using the stale drag ref. Treat "button already
    // released" as the release we missed.
    if ((event.buttons & 1) === 0) {
      endResize()
      return
    }
    const dx = (event.clientX - drag.startX) / grid.clientWidth
    const dy = (event.clientY - drag.startY) / grid.clientHeight
    drag.lastDx = dx
    drag.lastDy = dy
    const rect = clampResize(drag, dx, dy, false)
    scheduleFrame(() => applyLiveResizeStyle(drag.panelId, rect))
  }

  const onResizePointerUp = endResize

  // "Fit to content" for the plain N/S resize handles (see ResizeHandle's onFitToContent) — reads
  // the panel's actual rendered content height (data-panel-scroll's scrollHeight, set on every
  // panel's root by PanelBody) plus its header, and resizes to exactly that instead of a
  // user-dragged height. Reuses clampResize/patchPanelRect, the same commit path a normal drag
  // uses, by translating "grow/shrink to this height" into the dy that edge would need to move.
  const fitPaneHeightToContent = (panel: PanelLayout, edge: "n" | "s") => {
    const grid = document.getElementById("terminal-grid")
    const paneEl = document.querySelector<HTMLElement>(`[data-panel-id="${CSS.escape(panel.id)}"]`)
    const contentEl = paneEl?.querySelector<HTMLElement>("[data-panel-scroll]")
    const headerEl = paneEl?.querySelector<HTMLElement>(".terminal-pane-header")
    if (!grid || !paneEl || !contentEl || grid.clientHeight === 0) return
    const naturalHeightPx = contentEl.scrollHeight + (headerEl?.offsetHeight ?? 0) + 2 // +2 for the pane's 1px top/bottom border
    const rect = panelRect(panel)
    const naturalHeight = naturalHeightPx / grid.clientHeight
    const dy = edge === "s" ? naturalHeight - rect.height : rect.height - naturalHeight
    const drag: ResizeDrag = { panelId: panel.id, edges: { [edge]: true }, startX: 0, startY: 0, ...rect }
    patchPanelRect(panel.id, clampResize(drag, 0, dy, true))
  }

  const onHeaderPointerDown = (panel: PanelLayout, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    lockSelection()
    // Reordering here can replace the captured header DOM node and stop the drag before it
    // reaches the canvas edge. The active pane is raised by its drag z-index and promoted on up.
    moveRef.current = { panelId: panel.id, startX: event.clientX, startY: event.clientY, armed: false, ...panelRect(panel) }
    const el = document.querySelector<HTMLElement>(`[data-panel-id="${panel.id}"]`)
    if (el) el.style.willChange = "transform"
  }

  // Ends the move started by onHeaderPointerDown — see endResize's comment for why this also
  // needs to be reachable from a mid-drag safety-net check, not just pointerup/cancel.
  const endHeaderMove = () => {
    const move = moveRef.current
    if (move?.armed && move.lastDx !== undefined && move.lastDy !== undefined) {
      const x = snapPosition(move.x + move.lastDx, 1 - move.width, GRID_SNAP_STEP)
      const y = snapPosition(move.y + move.lastDy, 1 - move.height, GRID_SNAP_STEP)
      patchPanelRect(move.panelId, { x, y, width: move.width, height: move.height })
    }
    if (move) clearLiveMoveTransform(move.panelId)
    if (move?.armed) bringToFront(move.panelId)
    cancelFrame()
    moveRef.current = null
    setDraggingId(null)
    unlockSelection()
  }

  const onHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const move = moveRef.current
    const grid = document.getElementById("terminal-grid")
    if (!move || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    if ((event.buttons & 1) === 0) {
      endHeaderMove()
      return
    }
    const distance = Math.hypot(event.clientX - move.startX, event.clientY - move.startY)
    if (!move.armed && distance < 6) return
    move.armed = true
    setDraggingId(move.panelId)
    const dx = (event.clientX - move.startX) / grid.clientWidth
    const dy = (event.clientY - move.startY) / grid.clientHeight
    move.lastDx = dx
    move.lastDy = dy
    // Live frames are visualized via a compositor-only transform, offset in pixels from the
    // pane's committed rest position — no left/top writes, no layout. The real x/y are only ever
    // committed once, on release, in endHeaderMove.
    const clampedX = clamp(move.x + dx, 0, 1 - move.width)
    const clampedY = clamp(move.y + dy, 0, 1 - move.height)
    const dxPx = (clampedX - move.x) * grid.clientWidth
    const dyPx = (clampedY - move.y) * grid.clientHeight
    scheduleFrame(() => applyLiveMoveTransform(move.panelId, dxPx, dyPx))
  }

  const onHeaderPointerUp = endHeaderMove

  // Keyboard alternative to onResizePointerMove — a single discrete commit per arrow-key press
  // (no live-drag ref needed, unlike the pointer path) through the same clampResize the pointer
  // path uses, so both share identical math/floors. An axis a handle's `edges` don't cover is a
  // no-op inside clampResize, so all 4 arrow keys are safe to wire on every handle uniformly.
  const onResizeKeyDown = (panel: PanelLayout, edges: ResizeEdge, event: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    let dy = 0
    if (event.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (event.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else if (event.key === "ArrowUp") dy = -RESIZE_KEY_STEP
    else if (event.key === "ArrowDown") dy = RESIZE_KEY_STEP
    else return
    event.preventDefault()
    const drag: ResizeDrag = { panelId: panel.id, edges, startX: 0, startY: 0, ...panelRect(panel) }
    patchPanelRect(panel.id, clampResize(drag, dx, dy, true))
  }

  // Keyboard alternative to onHeaderPointerMove for moving a Free-canvas pane.
  const onHeaderKeyDown = (panel: PanelLayout, event: KeyboardEvent<HTMLDivElement>) => {
    const rect = panelRect(panel)
    let { x, y } = rect
    if (event.key === "ArrowLeft") x = snapPosition(x - GRID_SNAP_STEP, 1 - rect.width, GRID_SNAP_STEP)
    else if (event.key === "ArrowRight") x = snapPosition(x + GRID_SNAP_STEP, 1 - rect.width, GRID_SNAP_STEP)
    else if (event.key === "ArrowUp") y = snapPosition(y - GRID_SNAP_STEP, 1 - rect.height, GRID_SNAP_STEP)
    else if (event.key === "ArrowDown") y = snapPosition(y + GRID_SNAP_STEP, 1 - rect.height, GRID_SNAP_STEP)
    else return
    event.preventDefault()
    patchPanelRect(panel.id, { ...rect, x, y })
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

  // Opens the New Layout dialog defaulted to the account's own default preset, with the name
  // field pre-filled from that preset's label (selectPresetForNewLayout below keeps the name in
  // sync with the picker as long as the user hasn't typed their own).
  const openNewLayoutDialog = () => {
    const preset = catalog.data?.defaultPreset ?? "PANE_4"
    setNewLayoutPreset(preset)
    setNewLayoutName(t(PRESET_LABEL_KEYS[preset]))
    setNewLayoutOpen(true)
  }

  const selectPresetForNewLayout = (preset: PresetValue) => {
    setNewLayoutName((prev) => (prev === t(PRESET_LABEL_KEYS[newLayoutPreset]) ? t(PRESET_LABEL_KEYS[preset]) : prev))
    setNewLayoutPreset(preset)
  }

  // Builds the new layout from the CHOSEN preset (applyPreset — the same function Reset and
  // initial-load already use) instead of cloning whatever arrangement happens to be on screen,
  // which is what this used to do before the preset picker existed.
  const commitNewLayout = () => {
    if (!catalog.data) return
    const name = newLayoutName.trim() || t(PRESET_LABEL_KEYS[newLayoutPreset])
    const fallback: WorkspaceLayout = {
      preset: newLayoutPreset,
      arrangement: "free",
      panels: catalog.data.panels.map((panel, index) => ({ id: panel.id, visible: false, order: index, width: 1, height: 1 })),
    }
    const availableIds = catalog.data.panels.filter((p) => p.available).map((p) => p.id)
    const layoutJson = applyPreset(fallback, newLayoutPreset, availableIds)
    createWorkspace.mutate(
      { caseId, name, preset: newLayoutPreset, layoutJson },
      {
        onSuccess: (workspace) => {
          lastSavedLayoutRef.current = JSON.stringify(layoutJson)
          setSelectedWorkspaceId(workspace.id)
          setLayout(layoutJson)
          applyWorkspace.mutate(workspace.id)
        },
      },
    )
    setNewLayoutName("")
  }

  // Resets the CURRENT tab's contents back to the default arrangement, in place — previously
  // this called the backend's /workspaces/reset endpoint, which always *creates* a new
  // "Default {preset}" row, so every click piled up another duplicate tab instead of resetting
  // the one you were looking at.
  const resetCurrentWorkspace = () => {
    if (!catalog.data || !selectedWorkspaceId) return
    setMaximizedId(null)
    const preset = catalog.data.defaultPreset
    const fallback: WorkspaceLayout = {
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
    const defaultLayout = applyPreset(fallback, preset, catalog.data.panels.filter((p) => p.available).map((p) => p.id))
    lastSavedLayoutRef.current = JSON.stringify(defaultLayout)
    setLayout(defaultLayout)
    updateWorkspace.mutate({ id: selectedWorkspaceId, preset, layoutJson: defaultLayout })
  }

  // Deleting the active tab falls back to the first remaining layout. Deleting the final layout
  // is allowed and leaves the terminal in an empty state until the user creates a new one.
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

  const maximizedPanel = maximizedId ? layout.panels.find((p) => p.id === maximizedId) : undefined

  return (
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
          {shouldShowUpdatingAnalysis(refreshJob.data?.status) && (
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
          <div className="flex min-w-0 flex-1 items-stretch gap-5 overflow-x-auto">
            {(workspaces.data ?? []).map((workspace) => {
              const active = workspace.id === selectedWorkspaceId
              return (
                <span key={workspace.id} className="group/tab flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => selectWorkspace(workspace.id)}
                    className={`whitespace-nowrap border-b-2 py-1 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
                      active ? "border-brand-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {workspace.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => closeWorkspaceTab(workspace.id)}
                    aria-label={t("closeLayout")}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 dark:hover:bg-overlay-hover"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              )
            })}
            <button
              type="button"
              onClick={openNewLayoutDialog}
              className="flex shrink-0 items-center gap-1.5 self-center text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="h-3 w-3" aria-hidden="true" />
              {t("newLayout")}
            </button>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
              {ARRANGEMENTS.map(({ id, labelKey, icon: Icon }) => {
                const active = arrangement === id
                return (
                  <Tooltip key={id}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setArrangement(id)}
                        aria-label={t(labelKey)}
                        aria-pressed={active}
                        className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
                          active ? "bg-brand-gold text-brand-navy-950" : "text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t(labelKey)}</TooltipContent>
                  </Tooltip>
                )
              })}
            </div>
            {arrangement === "columns" && (
              <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
                {COLUMN_COUNT_OPTIONS.map((count) => {
                  const active = (layout.columnCount ?? 3) === count
                  return (
                    <Tooltip key={count}>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setColumnCount(count)}
                          aria-pressed={active}
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                            active ? "bg-brand-gold text-brand-navy-950" : "text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                          }`}
                        >
                          {count}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("columnCount", { count })}</TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            )}
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

        <div ref={arrangementStageRef} className="relative min-h-0 flex-1 overflow-hidden p-3">
          {visiblePanels.length === 0 && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
              <div className="flex w-full max-w-md flex-col items-center rounded-xl border border-dashed border-border/80 bg-card/70 px-6 py-10 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-brand-gold/30 bg-brand-gold/10 text-brand-gold">
                  <LayoutPanelLeft className="h-5 w-5" aria-hidden="true" />
                </div>
                <h2 className="text-sm font-semibold uppercase tracking-[1.4px] text-foreground">{t("emptyLayoutTitle")}</h2>
                <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{t("emptyLayoutDescription")}</p>
                <button
                  type="button"
                  onClick={openNewLayoutDialog}
                  className="pointer-events-auto mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-brand-gold px-3.5 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("addNewLayout")}
                </button>
              </div>
            </div>
          )}
          {arrangement !== "free" && dragPreview && (
            <PaneDragGhost
              label={labelFor({ id: dragPreview.panelId })}
              badge={panelBadges[dragPreview.panelId]}
              rect={dragPreview}
            />
          )}

          {arrangement === "free" && (
            <div
              id="terminal-grid"
              className="terminal-grid-texture relative h-full min-h-0"
              onDragOver={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
                if (!id) return
                const bounds = e.currentTarget.getBoundingClientRect()
                const width = 0.32
                const height = 0.32
                const x = clamp(snapValue(clamp((e.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
                const y = clamp(snapValue(clamp((e.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
                setDragPreview({ panelId: id, x, y, width, height })
              }}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
                if (!id) return
                const bounds = e.currentTarget.getBoundingClientRect()
                const width = 0.32
                const height = 0.32
                const x = clamp(snapValue(clamp((e.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
                const y = clamp(snapValue(clamp((e.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
                const preview = dragPreview?.panelId === id ? dragPreview : { x, y, width, height }
                const sourceRect = new DOMRect(
                  bounds.left + preview.x * bounds.width,
                  bounds.top + preview.y * bounds.height,
                  preview.width * bounds.width,
                  preview.height * bounds.height,
                )
                showPanelAt(id, { x, y, width, height }, sourceRect)
                setDragPreview(null)
              }}
            >
              {dragPreview && (
                <PaneDragGhost
                  label={labelFor({ id: dragPreview.panelId })}
                  badge={panelBadges[dragPreview.panelId]}
                  rect={dragPreview}
                />
              )}
              {visiblePanels.map((panel) => {
                const rect = panelRect(panel)
                const label = labelFor(panel)
                const isDragging = draggingId === panel.id
                const isPinned = !!panel.pinned
                return (
                  <div
                    key={panel.id}
                    data-panel-id={panel.id}
                    data-flip-id={panel.id}
                    data-panel-labels={panelLabels ? "on" : "off"}
                    className={`terminal-pane absolute flex min-h-0 min-w-0 flex-col contain-layout rounded-lg border bg-card ${
                      isPinned ? "border-brand-gold/60" : "border-border"
                    } ${isDragging ? "shadow-lg ring-1 ring-brand-gold/50" : ""}`}
                    style={{
                      left: `calc(${rect.x * 100}% + ${PANE_GAP_PX}px)`,
                      top: `calc(${rect.y * 100}% + ${PANE_GAP_PX}px)`,
                      width: `calc(${rect.width * 100}% - ${PANE_GAP_PX * 2}px)`,
                      height: `calc(${rect.height * 100}% - ${PANE_GAP_PX * 2}px)`,
                      zIndex: isDragging ? 80 : panel.order + 1,
                    }}
                    onPointerDown={() => bringToFront(panel.id)}
                  >
                    <div
                      role={isPinned ? undefined : "button"}
                      tabIndex={isPinned ? undefined : 0}
                      aria-label={isPinned ? undefined : t("dragHint")}
                      onPointerDown={isPinned ? undefined : (e) => onHeaderPointerDown(panel, e)}
                      onPointerMove={isPinned ? undefined : onHeaderPointerMove}
                      onPointerUp={isPinned ? undefined : onHeaderPointerUp}
                      onPointerCancel={isPinned ? undefined : onHeaderPointerUp}
                      onLostPointerCapture={isPinned ? undefined : onHeaderPointerUp}
                      onKeyDown={isPinned ? undefined : (e) => onHeaderKeyDown(panel, e)}
                      className={`terminal-pane-header flex h-9 shrink-0 items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60 focus-visible:ring-inset ${
                        isPinned ? "" : "cursor-grab active:cursor-grabbing"
                      }`}
                      title={isPinned ? t("pinnedHint") : t("dragHint")}
                    >
                      <Grip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                        {label}
                      </span>
                      <PaneHeaderActions
                        t={t}
                        isMaximized={false}
                        onToggleMaximize={() => toggleMaximize(panel.id)}
                        onHide={() => hidePanel(panel.id)}
                        onPopOut={() => popOutPanel(panel.id)}
                        pinned={isPinned}
                        onTogglePin={() => patchPanel(panel.id, { pinned: !isPinned })}
                      />
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
                      <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot.data} onJumpToPanel={jumpToPanel} />
                    </div>
                    {!isPinned && (
                      <>
                        <ResizeHandle edge={{ n: true }} className="absolute -top-1 left-3 right-3 z-20 h-2 cursor-n-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} onFitToContent={() => fitPaneHeightToContent(panel, "n")} t={t} />
                        <ResizeHandle edge={{ s: true }} className="absolute -bottom-1 left-3 right-3 z-20 h-2 cursor-s-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} onFitToContent={() => fitPaneHeightToContent(panel, "s")} t={t} />
                        <ResizeHandle edge={{ e: true }} className="absolute -right-1 top-3 bottom-3 z-20 w-2 cursor-e-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                        <ResizeHandle edge={{ w: true }} className="absolute -left-1 top-3 bottom-3 z-20 w-2 cursor-w-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                        <ResizeHandle edge={{ n: true, w: true }} className="absolute -left-1 -top-1 z-30 h-3 w-3 cursor-nw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                        <ResizeHandle edge={{ n: true, e: true }} className="absolute -right-1 -top-1 z-30 h-3 w-3 cursor-ne-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                        <ResizeHandle edge={{ s: true, w: true }} className="absolute -bottom-1 -left-1 z-30 h-3 w-3 cursor-sw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} onKeyDown={onResizeKeyDown} t={t} />
                        <ResizeHandle
                          edge={{ s: true, e: true }}
                          className="absolute -bottom-0.5 -right-0.5 z-30 flex h-4 w-4 cursor-se-resize items-end justify-end p-0.5"
                          panel={panel}
                          onDown={onResizePointerDown}
                          onMove={onResizePointerMove}
                          onUp={onResizePointerUp}
                          onKeyDown={onResizeKeyDown}
                          t={t}
                        >
                          <span className="h-2 w-2 rounded-sm border-b-2 border-r-2 border-muted-foreground/70" aria-hidden="true" />
                        </ResizeHandle>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {arrangement === "columns" && visiblePanels.length > 0 && (
            <ColumnsArrangement
              panels={visiblePanels}
              caseId={caseId}
              snapshot={snapshot.data}
              labelFor={labelFor}
              columnCount={layout.columnCount ?? 3}
              columnWidths={layout.columnWidths ?? []}
              onSetColumnWidths={setColumnWidths}
              onPatchPanel={patchPanel}
              onToggleMaximize={toggleMaximize}
              onHide={hidePanel}
              onPopOut={popOutPanel}
              onJumpToPanel={jumpToPanel}
              t={t}
              onDrop={requestAddPanel}
              onDragPreview={updateDragPreview}
            />
          )}

          {arrangement === "tabs" && visiblePanels.length > 0 && (
            <TabsArrangement
              panels={visiblePanels}
              caseId={caseId}
              snapshot={snapshot.data}
              labelFor={labelFor}
              activeA={layout.tabsActiveA ?? null}
              activeB={layout.tabsActiveB ?? null}
              onSetActiveA={setTabsActiveA}
              onSetActiveB={setTabsActiveB}
              split={layout.tabsSplit ?? 0.5}
              onSetSplit={setTabsSplit}
              onPatchPanel={patchPanel}
              onToggleMaximize={toggleMaximize}
              onHide={hidePanel}
              onPopOut={popOutPanel}
              onJumpToPanel={jumpToPanel}
              t={t}
              onDrop={(id) => showPanelAt(id)}
              onDragPreview={updateDragPreview}
            />
          )}

          {arrangement === "focus" && visiblePanels.length > 0 && (
            <FocusArrangement
              panels={visiblePanels}
              caseId={caseId}
              snapshot={snapshot.data}
              labelFor={labelFor}
              stackSummaries={focusStackSummaries}
              panelBadges={panelBadges}
              focusedId={focusedId}
              onFocus={setFocusedId}
              onToggleMaximize={toggleMaximize}
              onHide={hidePanel}
              onPopOut={popOutPanel}
              onJumpToPanel={jumpToPanel}
              t={t}
              onDrop={(id) => showPanelAt(id)}
              onDragPreview={updateDragPreview}
            />
          )}

          {newLayoutOpen && catalog.data && (
            <ModalOverlay
              onClose={() => setNewLayoutOpen(false)}
              labelledBy="new-layout-prompt"
              backdropClassName="absolute inset-0 z-[95] flex items-center justify-center bg-black/50"
              className="w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-border bg-card p-4 shadow-2xl focus:outline-none"
            >
              {(close) => (
                <>
                  <div className="mb-3 flex items-start gap-3">
                    <p id="new-layout-prompt" className="min-w-0 flex-1 pt-1 text-xs font-semibold uppercase tracking-[1.2px] text-foreground">
                      {t("newLayout")}
                    </p>
                    <button
                      type="button"
                      onClick={close}
                      aria-label={t("closeDialog")}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label htmlFor="new-layout-name" className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                    {t("workspaceName")}
                  </label>
                  <input
                    id="new-layout-name"
                    autoFocus
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        commitNewLayout()
                        close()
                      }
                    }}
                    className="mb-3 h-8 w-full rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-brand-gold/60"
                  />
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{t("preset")}</p>
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {catalog.data.presets.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => selectPresetForNewLayout(preset)}
                        aria-pressed={newLayoutPreset === preset}
                        className={`rounded-md border p-2 text-left transition-colors ${
                          newLayoutPreset === preset
                            ? "border-brand-gold bg-brand-gold/10 text-foreground"
                            : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        }`}
                      >
                        <span className="mb-1.5 block text-xs font-medium">{t(PRESET_LABEL_KEYS[preset])}</span>
                        <PresetLayoutPreview preset={preset} selected={newLayoutPreset === preset} />
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={close}
                      className="h-8 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        commitNewLayout()
                        close()
                      }}
                      className="h-8 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85"
                    >
                      {t("createLayout")}
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

          {maximizedPanel && (
            <ModalOverlay
              onClose={() => toggleMaximize(maximizedPanel.id)}
              labelledBy="maximized-pane-title"
              originPanelId={maximizedPanel.id}
              data-panel-id={maximizedPanel.id}
              className="terminal-pane absolute inset-3 z-[90] flex flex-col rounded-lg border border-brand-gold/40 bg-card shadow-2xl focus:outline-none"
            >
              {(close) => (
                <>
                  <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3">
                    <span id="maximized-pane-title" className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                      {labelFor(maximizedPanel)}
                    </span>
                    <PaneHeaderActions
                      t={t}
                      isMaximized
                      onToggleMaximize={close}
                      onHide={() => hidePanel(maximizedPanel.id)}
                      onPopOut={() => popOutPanel(maximizedPanel.id)}
                      pinned={!!maximizedPanel.pinned}
                      onTogglePin={() => patchPanel(maximizedPanel.id, { pinned: !maximizedPanel.pinned })}
                    />
                  </div>
                  <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
                    <TerminalPanelBody panelId={maximizedPanel.id} caseId={caseId} snapshot={snapshot.data} onJumpToPanel={jumpToPanel} />
                  </div>
                </>
              )}
            </ModalOverlay>
          )}
        </div>
        </div>
      </div>
    </div>
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

// Shared header icon cluster: Maximize/Hide (always available), Pop-out (always available —
// see popOutPanel), and Pin (rendered only when the caller passes onTogglePin — omitted where
// there's nothing for it to lock, e.g. Focus mode's own header — see call sites).
function PaneHeaderActions({
  t,
  isMaximized,
  onToggleMaximize,
  onHide,
  onPopOut,
  pinned,
  onTogglePin,
}: {
  t: (key: string) => string
  isMaximized: boolean
  onToggleMaximize: () => void
  onHide: () => void
  onPopOut: () => void
  pinned?: boolean
  onTogglePin?: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onTogglePin && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onTogglePin}
              aria-pressed={!!pinned}
              className={`rounded p-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${
                pinned ? "text-brand-gold" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label={pinned ? t("unpinPane") : t("pinPane")}
            >
              <Pin className="h-3.5 w-3.5" aria-hidden="true" fill={pinned ? "currentColor" : "none"} />
            </button>
          </TooltipTrigger>
          <TooltipContent>{pinned ? t("unpinPane") : t("pinPane")}</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onPopOut}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={t("popOutPane")}
          >
            <AppWindow className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("popOutPane")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onToggleMaximize}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={isMaximized ? t("restorePane") : t("maximizePane")}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>{isMaximized ? t("restorePane") : t("maximizePane")}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onHide}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={t("hidePane")}
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("hidePane")}</TooltipContent>
      </Tooltip>
    </div>
  )
}

// Minimal manual focus-trap dialog, local to this file rather than the shared Dialog component —
// the shared one always portals to document.body with no container override, which would drop
// the overlay out of the Terminal's forced-dark theme scope (see PopoverContent's own `container`
// doc comment for the same issue). Handles what a plain conditionally-rendered <div> didn't:
// focus moves in on mount, Tab wraps within the dialog instead of escaping it, Escape closes,
// and focus returns to whatever triggered it on unmount.
function ModalOverlay({
  onClose,
  labelledBy,
  className,
  children,
  backdropClassName,
  originPanelId,
  ...rest
}: {
  onClose: () => void
  labelledBy: string
  className?: string
  // A function child gets the animated closer, for any in-content control (a Cancel button, a
  // selection that should dismiss) that needs to play the exit tween before really closing —
  // same reason the backdrop and Escape key below don't just call `onClose` directly.
  children: ReactNode | ((close: () => void) => ReactNode)
  // Renders a click-to-close backdrop behind the dialog (the replace-pane picker wants one, the
  // maximize overlay doesn't — it already fills the canvas with no need to dim anything behind).
  backdropClassName?: string
  // Panel id to visually zoom from/to (its current on-canvas position, read straight off its
  // `data-panel-id` element) instead of a generic center fade — used for maximize/restore so it
  // reads as "this pane expanding," not a dialog appearing from nowhere.
  originPanelId?: PanelId
} & Omit<ComponentPropsWithoutRef<"div">, "onClose" | "className" | "children">) {
  const ref = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const closingRef = useRef(false)

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const container = ref.current
    const focusable = container?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
    ;(focusable ?? container)?.focus()
    return () => {
      previouslyFocused?.focus()
    }
  }, [])

  const originRect = () => {
    if (!originPanelId) return null
    const candidates = document.querySelectorAll<HTMLElement>(`[data-panel-id="${CSS.escape(originPanelId)}"]`)
    return Array.from(candidates).find((el) => el !== ref.current)?.getBoundingClientRect() ?? null
  }

  useGSAP(
    () => {
      const el = ref.current
      if (!el || reducedMotion) return
      if (backdropRef.current) gsap.from(backdropRef.current, { opacity: 0, duration: 0.18 })
      const origin = originRect()
      if (origin) {
        const target = el.getBoundingClientRect()
        gsap.fromTo(
          el,
          {
            opacity: 0,
            scaleX: origin.width / target.width,
            scaleY: origin.height / target.height,
            x: origin.left + origin.width / 2 - (target.left + target.width / 2),
            y: origin.top + origin.height / 2 - (target.top + target.height / 2),
          },
          { opacity: 1, scaleX: 1, scaleY: 1, x: 0, y: 0, duration: 0.22, ease: "power2.out" },
        )
      } else {
        gsap.from(el, { opacity: 0, scale: 0.95, y: 8, duration: 0.18, ease: "power2.out" })
      }
    },
    { scope: ref, dependencies: [] },
  )

  // Plays the exit tween, then runs the real onClose — every close path (Escape, backdrop click,
  // an in-content Cancel/selection) routes through this instead of calling onClose directly, so
  // none of them skip the animation.
  const handleClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    const el = ref.current
    if (!el || reducedMotion) {
      onClose()
      return
    }
    if (backdropRef.current) gsap.to(backdropRef.current, { opacity: 0, duration: 0.15 })
    const origin = originRect()
    if (origin) {
      const target = el.getBoundingClientRect()
      gsap.to(el, {
        opacity: 0,
        scaleX: origin.width / target.width,
        scaleY: origin.height / target.height,
        x: origin.left + origin.width / 2 - (target.left + target.width / 2),
        y: origin.top + origin.height / 2 - (target.top + target.height / 2),
        duration: 0.22,
        ease: "power2.in",
        onComplete: onClose,
      })
      return
    }
    gsap.to(el, { opacity: 0, scale: 0.97, duration: 0.14, ease: "power1.in", onComplete: onClose })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation()
      handleClose()
      return
    }
    if (event.key !== "Tab") return
    const container = ref.current
    if (!container) return
    const focusables = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    if (focusables.length === 0) return
    const first = focusables[0]!
    const last = focusables[focusables.length - 1]!
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const dialog = (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onClick={backdropClassName ? (e) => e.stopPropagation() : undefined}
      className={className}
      {...rest}
    >
      {typeof children === "function" ? children(handleClose) : children}
    </div>
  )

  if (!backdropClassName) return dialog
  return (
    <div ref={backdropRef} className={backdropClassName} onClick={handleClose}>
      {dialog}
    </div>
  )
}

// Crossfades between panel bodies when the active one changes — Tabs' per-group content and
// Focus mode's "big" pane both used to swap instantly via a plain conditional render. Renders one
// TerminalPanelBody at a time (not both mid-fade) to avoid double-mounting two panels' queries
// simultaneously: fade the outgoing one out, swap which panelId is actually rendered, fade the
// new one in. Skips animating on first mount (nothing to transition from yet).
function AnimatedPanelBody({
  panelId,
  caseId,
  snapshot,
  onJumpToPanel,
}: {
  panelId: PanelId
  caseId: string
  snapshot: CaseSnapshot
  onJumpToPanel: (id: PanelId) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [displayedId, setDisplayedId] = useState(panelId)
  const pendingIdRef = useRef(panelId)
  const mountedRef = useRef(false)

  useGSAP(
    () => {
      if (panelId === displayedId) return
      pendingIdRef.current = panelId
      const el = containerRef.current
      if (reducedMotion || !el) {
        setDisplayedId(panelId)
        return
      }
      gsap.killTweensOf(el)
      gsap.to(el, { opacity: 0, duration: 0.12, ease: "power1.in", onComplete: () => setDisplayedId(pendingIdRef.current) })
    },
    { dependencies: [panelId] },
  )

  useGSAP(
    () => {
      if (!mountedRef.current) {
        mountedRef.current = true
        return
      }
      if (reducedMotion) return
      const el = containerRef.current
      if (!el) return
      gsap.killTweensOf(el)
      gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: "power1.out" })
    },
    { dependencies: [displayedId] },
  )

  return (
    <div ref={containerRef} className="h-full min-h-0">
      <TerminalPanelBody panelId={displayedId} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
    </div>
  )
}

type ArrangementBodyProps = {
  panels: PanelLayout[]
  caseId: string
  snapshot: CaseSnapshot
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  onToggleMaximize: (id: PanelId) => void
  onHide: (id: PanelId) => void
  onPopOut: (id: PanelId) => void
  onJumpToPanel: (id: PanelId) => void
  t: (key: string, opts?: Record<string, unknown>) => string
  onDrop: (id: PanelId) => void
  onDragPreview?: (event: DragEvent) => void
}

function dropHandlers(onDrop: (id: PanelId) => void, onDragPreview?: (event: DragEvent) => void) {
  return {
    onDragOver: (e: DragEvent) => {
      e.preventDefault()
      onDragPreview?.(e)
    },
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
      if (id) onDrop(id)
    },
  }
}

// Fixed 2/3/4-column grid — strictly no floating. Each column stacks up to MAX_PANES_PER_COLUMN
// panes (columnsOf below decides membership: an explicit panel.columnIndex wins, anything else
// auto-joins whichever column currently has the fewest panes). Column borders and in-column
// stack dividers both resize with a neighbor-only trade + MIN_COLUMN_FR floor — dragging one
// border only ever moves width/height between the two panes/columns it sits between.
function ColumnsArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  columnCount,
  columnWidths,
  onSetColumnWidths,
  onPatchPanel,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
}: ArrangementBodyProps & {
  columnCount: number
  columnWidths: number[]
  onSetColumnWidths: (widths: number[]) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
}) {
  const gridRef = useRef<HTMLDivElement>(null)
  const columnDragRef = useRef<{ index: number; startX: number; widths: number[] } | null>(null)
  const columns = columnsOf(panels, columnCount)
  const widths = columnWidths.length === columnCount ? columnWidths : Array(columnCount).fill(1 / columnCount)

  const onColumnResizeDown = (index: number, e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    columnDragRef.current = { index, startX: e.clientX, widths: [...widths] }
  }
  const onColumnResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = columnDragRef.current
    const grid = gridRef.current
    if (!drag || !grid || grid.clientWidth === 0) return
    // Safety net for capture silently dropping mid-drag (browser quirk, or the pointer leaving
    // the window while the button is released outside it) — without this, the next hover-only
    // pointermove over the divider would keep resizing with no button held. See the matching
    // comment on Free mode's onResizePointerMove for the fuller explanation.
    if ((e.buttons & 1) === 0) {
      onColumnResizeUp()
      return
    }
    const dx = (e.clientX - drag.startX) / grid.clientWidth
    const a = drag.index
    const b = drag.index + 1
    const pairTotal = drag.widths[a]! + drag.widths[b]!
    const newA = clamp(drag.widths[a]! + dx, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    const next = [...drag.widths]
    next[a] = newA
    next[b] = pairTotal - newA
    onSetColumnWidths(next)
  }
  const onColumnResizeUp = () => {
    columnDragRef.current = null
    unlockSelection()
  }

  const onColumnResizeKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    if (e.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (e.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    const a = index
    const b = index + 1
    const pairTotal = widths[a]! + widths[b]!
    const newA = clamp(widths[a]! + dx, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    const next = [...widths]
    next[a] = newA
    next[b] = pairTotal - newA
    onSetColumnWidths(next)
  }

  return (
    <div ref={gridRef} className="flex h-full min-h-0" {...dropHandlers(onDrop, onDragPreview)}>
      {columns.map((columnPanels, columnIndex) => (
        <div key={columnIndex} className="relative flex min-h-0 min-w-0 flex-col" style={{ flex: `${widths[columnIndex]} 0 0%` }}>
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-1.5">
            <ColumnStack
              panels={columnPanels}
              caseId={caseId}
              snapshot={snapshot}
              labelFor={labelFor}
              onToggleMaximize={onToggleMaximize}
              onHide={onHide}
              onPopOut={onPopOut}
              onJumpToPanel={onJumpToPanel}
              onPatchPanel={onPatchPanel}
              t={t}
            />
          </div>
          {columnIndex < columnCount - 1 && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label={t("resizeColumns")}
              tabIndex={0}
              onPointerDown={(e) => onColumnResizeDown(columnIndex, e)}
              onPointerMove={onColumnResizeMove}
              onPointerUp={onColumnResizeUp}
              onPointerCancel={onColumnResizeUp}
              onLostPointerCapture={onColumnResizeUp}
              onKeyDown={(e) => onColumnResizeKeyDown(columnIndex, e)}
              className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// One column's vertical stack (up to MAX_PANES_PER_COLUMN panes). Height per pane comes from
// panel.height, reinterpreted here as "fraction of this column's height" rather than Free
// mode's "fraction of the whole canvas" — same field, different meaning per arrangement,
// consistent with how x/y/width/height already only mean something in Free mode today.
function ColumnStack({
  panels,
  caseId,
  snapshot,
  labelFor,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  onPatchPanel,
  t,
}: {
  panels: PanelLayout[]
  caseId: string
  snapshot: CaseSnapshot
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  onToggleMaximize: (id: PanelId) => void
  onHide: (id: PanelId) => void
  onPopOut: (id: PanelId) => void
  onJumpToPanel: (id: PanelId) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const stackRef = useRef<HTMLDivElement>(null)
  const stackDragRef = useRef<{ aboveId: PanelId; belowId: PanelId; startY: number; heightAbove: number; heightBelow: number } | null>(null)
  const rawHeights = panels.map((p) => (Number.isFinite(p.height) && p.height! > 0 ? p.height! : 1 / panels.length))
  const total = rawHeights.reduce((sum, h) => sum + h, 0) || 1
  const heights = rawHeights.map((h) => h / total)

  const onStackResizeDown = (index: number, e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    stackDragRef.current = {
      aboveId: panels[index]!.id,
      belowId: panels[index + 1]!.id,
      startY: e.clientY,
      heightAbove: heights[index]!,
      heightBelow: heights[index + 1]!,
    }
  }
  const onStackResizeMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = stackDragRef.current
    const stack = stackRef.current
    if (!drag || !stack || stack.clientHeight === 0) return
    if ((e.buttons & 1) === 0) {
      onStackResizeUp()
      return
    }
    const dy = (e.clientY - drag.startY) / stack.clientHeight
    const pairTotal = drag.heightAbove + drag.heightBelow
    const newAbove = clamp(drag.heightAbove + dy, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    onPatchPanel(drag.aboveId, { height: newAbove })
    onPatchPanel(drag.belowId, { height: pairTotal - newAbove })
  }
  const onStackResizeUp = () => {
    stackDragRef.current = null
    unlockSelection()
  }

  const onStackResizeKeyDown = (index: number, e: KeyboardEvent<HTMLDivElement>) => {
    let dy = 0
    if (e.key === "ArrowUp") dy = -RESIZE_KEY_STEP
    else if (e.key === "ArrowDown") dy = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    const pairTotal = heights[index]! + heights[index + 1]!
    const newAbove = clamp(heights[index]! + dy, MIN_COLUMN_FR, pairTotal - MIN_COLUMN_FR)
    onPatchPanel(panels[index]!.id, { height: newAbove })
    onPatchPanel(panels[index + 1]!.id, { height: pairTotal - newAbove })
  }

  return (
    <div ref={stackRef} className="flex min-h-0 flex-1 flex-col gap-1.5">
      {panels.map((panel, index) => (
        <div key={panel.id} className="relative flex min-h-0 min-w-0 flex-col" style={{ flex: `${heights[index]} 0 0%` }}>
          <div
            data-flip-id={panel.id}
            className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border bg-card ${panel.pinned ? "border-brand-gold/60" : "border-border"}`}
          >
            <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3">
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                {labelFor(panel)}
              </span>
              <PaneHeaderActions
                t={t}
                isMaximized={false}
                onToggleMaximize={() => onToggleMaximize(panel.id)}
                onHide={() => onHide(panel.id)}
                onPopOut={() => onPopOut(panel.id)}
                pinned={!!panel.pinned}
                onTogglePin={() => onPatchPanel(panel.id, { pinned: !panel.pinned })}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
              <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
            </div>
          </div>
          {index < panels.length - 1 && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label={t("resizeColumnStack")}
              tabIndex={0}
              onPointerDown={(e) => onStackResizeDown(index, e)}
              onPointerMove={onStackResizeMove}
              onPointerUp={onStackResizeUp}
              onPointerCancel={onStackResizeUp}
              onLostPointerCapture={onStackResizeUp}
              onKeyDown={(e) => onStackResizeKeyDown(index, e)}
              className="absolute -bottom-1 left-0 z-10 h-2 w-full cursor-row-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
            />
          )}
        </div>
      ))}
    </div>
  )
}

// Two independently drag-assignable, resizable, persisted tab groups. Group membership comes
// from panel.tabGroup (defaults to 0 until a tab is dragged into group 1), order within a group
// from panel.order, and the active tab per group is saved with the workspace via tabsActiveA/B.
function TabsArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  activeA,
  activeB,
  onSetActiveA,
  onSetActiveB,
  split,
  onSetSplit,
  onPatchPanel,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
}: ArrangementBodyProps & {
  activeA: PanelId | null
  activeB: PanelId | null
  onSetActiveA: (id: PanelId) => void
  onSetActiveB: (id: PanelId) => void
  split: number
  onSetSplit: (value: number) => void
  onPatchPanel: (id: PanelId, patch: Partial<PanelLayout>) => void
}) {
  const groupsRef = useRef<HTMLDivElement>(null)
  const splitDragRef = useRef<{ startX: number; split: number } | null>(null)
  const groups = [0, 1].map((groupIndex) => panels.filter((p) => (p.tabGroup ?? 0) === groupIndex).sort((a, b) => a.order - b.order))
  const actives = [activeA, activeB]
  const setActives = [onSetActiveA, onSetActiveB]
  const widths = [split, 1 - split]

  const onSplitDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    lockSelection()
    splitDragRef.current = { startX: e.clientX, split }
  }
  const onSplitMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = splitDragRef.current
    const container = groupsRef.current
    if (!drag || !container || container.clientWidth === 0) return
    if ((e.buttons & 1) === 0) {
      onSplitUp()
      return
    }
    const dx = (e.clientX - drag.startX) / container.clientWidth
    onSetSplit(clamp(drag.split + dx, MIN_COLUMN_FR, 1 - MIN_COLUMN_FR))
  }
  const onSplitUp = () => {
    splitDragRef.current = null
    unlockSelection()
  }

  const onSplitKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let dx = 0
    if (e.key === "ArrowLeft") dx = -RESIZE_KEY_STEP
    else if (e.key === "ArrowRight") dx = RESIZE_KEY_STEP
    else return
    e.preventDefault()
    onSetSplit(clamp(split + dx, MIN_COLUMN_FR, 1 - MIN_COLUMN_FR))
  }

  const moveToGroup = (panelId: PanelId, targetGroupIndex: number) => {
    const maxOrder = Math.max(0, ...groups[targetGroupIndex]!.map((p) => p.order))
    onPatchPanel(panelId, { tabGroup: targetGroupIndex, order: maxOrder + 1 })
  }

  const onGroupDrop = (groupIndex: number, e: DragEvent) => {
    e.preventDefault()
    const tabId = e.dataTransfer.getData("text/x-tab-id") as PanelId
    if (tabId) {
      moveToGroup(tabId, groupIndex)
      return
    }
    const newId = e.dataTransfer.getData("text/x-panel-id") as PanelId
    if (newId) onDrop(newId)
  }

  return (
    <div ref={groupsRef} className="flex h-full min-h-0">
      {groups.map((group, groupIndex) => {
        const activeId = actives[groupIndex] && group.some((p) => p.id === actives[groupIndex]) ? actives[groupIndex] : group[0]?.id
        const activePanel = group.find((p) => p.id === activeId)
        return (
          <div
            key={groupIndex}
            // Tabs has no single per-panel box the way Free/Columns/Focus do (the header is a
            // shared tab strip, only the active tab's body swaps) — this container stands in for
            // "the active panel's box" during an arrangement-switch Flip, closest available
            // analog. Inactive tabs in this group have no box at all and just fade in/out.
            data-flip-id={activePanel?.id}
            className="relative flex min-h-0 min-w-[200px] flex-col overflow-hidden rounded-lg border border-border bg-card"
            style={{ flex: `${widths[groupIndex]} 0 0%` }}
            onDragOver={(e) => {
              e.preventDefault()
              onDragPreview?.(e)
            }}
            onDrop={(e) => onGroupDrop(groupIndex, e)}
          >
            <div className="terminal-pane-header flex h-10 shrink-0 items-stretch gap-1 overflow-x-auto border-b border-border px-2">
              {group.map((panel) => {
                const active = panel.id === activePanel?.id
                const isPinned = !!panel.pinned
                return (
                  <div
                    key={panel.id}
                    draggable={!isPinned}
                    onDragStart={isPinned ? undefined : (e) => e.dataTransfer.setData("text/x-tab-id", panel.id)}
                    className={`flex items-center gap-0.5 whitespace-nowrap border-b-2 pl-2 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
                      active ? "border-brand-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <button type="button" onClick={() => setActives[groupIndex]?.(panel.id)}>
                      {labelFor(panel)}
                    </button>
                    <button
                      type="button"
                      onClick={() => onPatchPanel(panel.id, { pinned: !isPinned })}
                      aria-pressed={isPinned}
                      aria-label={isPinned ? t("unpinPane") : t("pinPane")}
                      className={`rounded p-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${
                        isPinned ? "text-brand-gold" : "text-muted-foreground/60 hover:text-foreground"
                      }`}
                    >
                      <Pin className="h-3 w-3" aria-hidden="true" fill={isPinned ? "currentColor" : "none"} />
                    </button>
                    {!isPinned && (
                      <button
                        type="button"
                        onClick={() => moveToGroup(panel.id, groupIndex === 0 ? 1 : 0)}
                        aria-label={t("moveToOtherGroup")}
                        className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                      >
                        <ArrowLeftRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onHide(panel.id)}
                      aria-label={t("hidePane")}
                      className="rounded p-1 text-muted-foreground/60 transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                )
              })}
              {activePanel && (
                <div className="ml-auto flex shrink-0 items-center gap-0.5 self-center">
                  <button
                    type="button"
                    onClick={() => onPopOut(activePanel.id)}
                    className="flex h-6 w-6 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    aria-label={t("popOutPane")}
                  >
                    <AppWindow className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMaximize(activePanel.id)}
                    className="flex h-6 w-6 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    aria-label={t("maximizePane")}
                  >
                    <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              {activePanel && (
                <AnimatedPanelBody panelId={activePanel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
              )}
            </div>
            {groupIndex === 0 && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t("resizeTabGroups")}
                tabIndex={0}
                onPointerDown={onSplitDown}
                onPointerMove={onSplitMove}
                onPointerUp={onSplitUp}
                onPointerCancel={onSplitUp}
                onLostPointerCapture={onSplitUp}
                onKeyDown={onSplitKeyDown}
                className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// One large focused pane plus a clickable stack of the rest — clicking a stack card swaps
// which pane is focused. Stack summaries are real data composites (stackSummaries, falling
// back to the single-metric panelBadges) — never an invented description of a pane's contents,
// same anti-fabrication stance as docs/adr/0013. The AI Legal Assistant is anchored: it's
// always the third column here, whether or not "chat" happens to be in the visible-pane list,
// and (unlike every other pane) isn't hideable from this mode — it's a permanent fixture.
function FocusArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  stackSummaries,
  panelBadges,
  focusedId,
  onFocus,
  onToggleMaximize,
  onHide,
  onPopOut,
  onJumpToPanel,
  t,
  onDrop,
  onDragPreview,
}: ArrangementBodyProps & {
  stackSummaries: Partial<Record<PanelId, string>>
  panelBadges: Partial<Record<PanelId, string>>
  focusedId: PanelId | null
  onFocus: (id: PanelId) => void
}) {
  const stackable = panels.filter((p) => p.id !== "chat")
  const focusId = focusedId && stackable.some((p) => p.id === focusedId) ? focusedId : stackable[0]?.id
  const focusPanel = stackable.find((p) => p.id === focusId)
  const stackRest = stackable.filter((p) => p.id !== focusId)

  return (
    <div
      className="grid h-full min-h-0 gap-3"
      style={{ gridTemplateColumns: "minmax(280px,1.4fr) 260px minmax(260px,1fr)" }}
      {...dropHandlers(onDrop, onDragPreview)}
    >
      <div data-flip-id={focusPanel?.id} className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {focusPanel && (
          <>
            <div className="terminal-pane-header flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
              <span className="min-w-0 flex-1 truncate font-['Libre_Caslon_Text'] text-sm text-foreground">{labelFor(focusPanel)}</span>
              <PaneHeaderActions
                t={t}
                isMaximized={false}
                onToggleMaximize={() => onToggleMaximize(focusPanel.id)}
                onHide={() => onHide(focusPanel.id)}
                onPopOut={() => onPopOut(focusPanel.id)}
              />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              <AnimatedPanelBody panelId={focusPanel.id} caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
            </div>
          </>
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {stackRest.map((panel) => {
          const summary = stackSummaries[panel.id] ?? panelBadges[panel.id]
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => onFocus(panel.id)}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-brand-gold/40"
            >
              <span className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[1.2px] text-foreground">{labelFor(panel)}</span>
              {summary && <span className="line-clamp-2 text-[11px] leading-4 text-muted-foreground">{summary}</span>}
            </button>
          )
        })}
      </div>
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-brand-gold/35 bg-card">
        <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">{labelFor({ id: "chat" })}</span>
          {/* No pop-out here either — anchored means a permanent fixture (see the file doc
              comment above): pop-out would hide it from the main grid, but this column ignores
              visibility and always renders "chat" regardless, so the panel would stay put while
              a redundant, confusing duplicate opened in a new window. */}
          <button
            type="button"
            onClick={() => onToggleMaximize("chat")}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
            aria-label={t("maximizePane")}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden bg-card">
          <TerminalPanelBody panelId="chat" caseId={caseId} snapshot={snapshot} onJumpToPanel={onJumpToPanel} />
        </div>
      </div>
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// Move is visualized live with a compositor-only `transform` (translate) instead of touching
// left/top (layout-triggering) — see the comment on scheduleFrame below. React never renders a
// `transform` for a pane (it's outside the style object in the JSX), so nothing clears it except
// clearLiveMoveTransform, called once the drag ends and the real, committed left/top are patched
// into state.
function applyLiveMoveTransform(panelId: PanelId, dxPx: number, dyPx: number) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.transform = `translate3d(${dxPx}px, ${dyPx}px, 0)`
}

function clearLiveMoveTransform(panelId: PanelId) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.transform = ""
  el.style.willChange = ""
}

// Resize deliberately writes real left/top/width/height (not a transform) — a scale() experiment
// made content visibly stretch while dragging, which read as worse than the reflow cost it was
// meant to avoid. rAF-throttling (scheduleFrame) plus contain-layout on the pane (see its
// className) keep this affordable without distorting anything.
function applyLiveResizeStyle(panelId: PanelId, rect: PaneRect) {
  const el = document.querySelector<HTMLElement>(`[data-panel-id="${panelId}"]`)
  if (!el) return
  el.style.left = `calc(${rect.x * 100}% + ${PANE_GAP_PX}px)`
  el.style.top = `calc(${rect.y * 100}% + ${PANE_GAP_PX}px)`
  el.style.width = `calc(${rect.width * 100}% - ${PANE_GAP_PX * 2}px)`
  el.style.height = `calc(${rect.height * 100}% - ${PANE_GAP_PX * 2}px)`
}

function panelRect(panel: PanelLayout): PaneRect {
  return {
    x: Number.isFinite(panel.x) ? Number(panel.x) : 0,
    y: Number.isFinite(panel.y) ? Number(panel.y) : 0,
    width: Math.max(MIN_FR, panel.width || MIN_FR),
    height: Math.max(MIN_FR, panel.height || MIN_FR),
  }
}

function snapValue(value: number, step: number): number {
  return Math.round(value / step) * step
}

function snapPosition(value: number, max: number, step: number): number {
  const clamped = clamp(value, 0, max)
  const snapped = snapValue(clamped, step)
  return Math.abs(max - snapped) < step / 2 ? max : clamp(snapped, 0, max)
}

function clampResize(drag: ResizeDrag, dx: number, dy: number, snap: boolean): PaneRect {
  const right = drag.x + drag.width
  const bottom = drag.y + drag.height
  let x = drag.x
  let y = drag.y
  let width = drag.width
  let height = drag.height

  if (drag.edges.w) {
    x = clamp(drag.x + dx, 0, right - MIN_FR)
    width = right - x
  } else if (drag.edges.e) {
    width = clamp(drag.width + dx, MIN_FR, 1 - drag.x)
  }

  if (drag.edges.n) {
    y = clamp(drag.y + dy, 0, bottom - MIN_FR)
    height = bottom - y
  } else if (drag.edges.s) {
    height = clamp(drag.height + dy, MIN_FR, 1 - drag.y)
  }

  // Snap after the normal clamp so the fixed (unmoved) edge stays exactly put —
  // re-clamping post-snap keeps the moved edge from crossing the fixed one.
  if (snap) {
    if (drag.edges.w) {
      x = clamp(snapValue(x, GRID_SNAP_STEP), 0, right - MIN_FR)
      width = right - x
    } else if (drag.edges.e) {
      width = clamp(snapValue(width, GRID_SNAP_STEP), MIN_FR, 1 - drag.x)
    }
    if (drag.edges.n) {
      y = clamp(snapValue(y, GRID_SNAP_STEP), 0, bottom - MIN_FR)
      height = bottom - y
    } else if (drag.edges.s) {
      height = clamp(snapValue(height, GRID_SNAP_STEP), MIN_FR, 1 - drag.y)
    }
  }

  return { x, y, width, height }
}

function cascadeRect(panels: PanelLayout[]): PaneRect {
  const visible = panels.filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id))
  const offset = (visible.length % 8) * 0.04
  const width = 0.48
  const height = 0.48
  return {
    x: clamp(0.08 + offset, 0, 1 - width),
    y: clamp(0.08 + offset, 0, 1 - height),
    width,
    height,
  }
}

// Columns mode's placement rule: an explicit, in-range panel.columnIndex wins (sorted within
// that column by `order`); anything else auto-joins whichever column currently has fewest
// panes. Recomputed fresh from `panels` on every render rather than written back to state for
// auto-placed panes — cheap, and simplest given how rarely the visible set actually changes;
// a shrunk columnCount's now-out-of-range indices are also just treated as unassigned here,
// so they don't need separate cleanup when the column count changes.
function columnsOf(panels: PanelLayout[], columnCount: number): PanelLayout[][] {
  const columns: PanelLayout[][] = Array.from({ length: columnCount }, () => [])
  const unassigned: PanelLayout[] = []
  for (const panel of panels) {
    if (panel.columnIndex !== undefined && panel.columnIndex >= 0 && panel.columnIndex < columnCount) {
      columns[panel.columnIndex]!.push(panel)
    } else {
      unassigned.push(panel)
    }
  }
  for (const panel of unassigned) {
    columns[leastFullColumn(columns)]!.push(panel)
  }
  for (const column of columns) column.sort((a, b) => a.order - b.order)
  return columns
}

function leastFullColumn(columns: PanelLayout[][]): number {
  let target = 0
  for (let i = 1; i < columns.length; i++) {
    if (columns[i]!.length < columns[target]!.length) target = i
  }
  return target
}

function columnCount(preset: PresetValue, n: number) {
  if (n <= 1) return 1
  if (preset === "PANE_6" || n >= 5) return 3
  if (preset === "PANE_1") return 1
  return 2
}

function tileLayout(layout: WorkspaceLayout): WorkspaceLayout {
  const visible = [...layout.panels]
    .filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id))
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
  const visible = layout.panels.filter((panel) => panel.visible && !HIDDEN_PANELS.has(panel.id))
  if (visible.some((panel) => !Number.isFinite(panel.x) || !Number.isFinite(panel.y))) {
    return tileLayout(layout)
  }
  return layout
}

function applyPreset(layout: WorkspaceLayout, preset: PresetValue, availableIds: PanelId[]): WorkspaceLayout {
  const merged = mergeCatalogPanels(layout, availableIds)
  const visibleIds = defaultIdsForPreset(preset).filter((id) => availableIds.includes(id) && !HIDDEN_PANELS.has(id))
  return tileLayout({
    ...layout,
    preset,
    panels: merged.panels.map((panel, index) => {
      const visibleIndex = visibleIds.indexOf(panel.id)
      const visible = visibleIndex !== -1
      return {
        ...panel,
        visible,
        order: visible ? visibleIndex : 100 + index,
      }
    }),
  })
}

// See focusStackSummaries' call site for why this isn't a useMemo.
function computeFocusStackSummaries(data: CaseSnapshot, t: (key: string, opts?: Record<string, unknown>) => string): Partial<Record<PanelId, string>> {
  const relativeUpdate = (iso: string | null): string | null => {
    if (!iso) return null
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
    if (minutes < 1) return t("updatedJustNow")
    if (minutes < 60) return t("updatedMinutesAgo", { count: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t("updatedHoursAgo", { count: hours })
    return t("updatedDaysAgo", { count: Math.floor(hours / 24) })
  }
  const nextDateLabel = ((): string | null => {
    const next = data.nextDate
    if (next && "dateTime" in next) return t("focusNext", { date: new Date(next.dateTime).toLocaleDateString() })
    if (next && "occurredOn" in next && next.occurredOn) return t("focusNext", { date: new Date(next.occurredOn).toLocaleDateString() })
    return null
  })()

  const summaries: Partial<Record<PanelId, string>> = {}

  const commandParts = [
    data.case.parties.length > 0 ? t("badgeParties", { count: data.case.parties.length }) : null,
    data.case.actionType || null,
    nextDateLabel,
  ].filter((part): part is string => Boolean(part))
  if (commandParts.length > 0) summaries.command = commandParts.join(" · ")

  const indexingCount = data.documents.filter((d) => d.ragStatus === "PENDING").length
  const evidenceParts = [
    data.documents.length > 0 ? t("badgeDocs", { count: data.documents.length }) : null,
    data.timeline.length > 0 ? t("focusDatedEvents", { count: data.timeline.length }) : null,
    indexingCount > 0 ? t("focusIndexing", { count: indexingCount }) : null,
  ].filter((part): part is string => Boolean(part))
  if (evidenceParts.length > 0) summaries.evidence = evidenceParts.join(" · ")

  const approachCount = data.procedure.items.filter((i) => i.kind.toUpperCase() === "STRATEGY").length
  const openTodoCount = data.procedure.items.filter((i) => i.kind.toUpperCase() !== "STRATEGY" && !i.done).length
  const procedureParts = [
    approachCount > 0 ? t("focusApproachPoints", { count: approachCount }) : null,
    openTodoCount > 0 ? t("badgeToDos", { count: openTodoCount }) : null,
  ].filter((part): part is string => Boolean(part))
  if (procedureParts.length > 0) summaries.procedure = procedureParts.join(" · ")

  if (data.mindMap.lastGeneratedAt) {
    const parts = [data.mindMap.isStale ? t("badgeStale") : t("badgeReady"), relativeUpdate(data.mindMap.lastGeneratedAt)].filter(
      (part): part is string => Boolean(part),
    )
    summaries.mindMap = parts.join(" · ")
  }

  // No structured "threat count"/"weak point" exists on RedTeamAssessment (content is free
  // text) — "Ready · updated ..." is the honest equivalent instead of guessing a figure out of
  // prose, same anti-fabrication stance as panelBadges above.
  if (data.redTeamAssessment) {
    const parts = [t("badgeReady"), relativeUpdate(data.redTeamAssessment.updatedAt)].filter((part): part is string => Boolean(part))
    summaries.redTeam = parts.join(" · ")
  }

  return summaries
}

function PaneDragGhost({
  label,
  badge,
  rect,
}: {
  label: string
  badge?: string
  rect: PaneDragPreview
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-40 flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-brand-gold/70 bg-card/85 shadow-xl backdrop-blur-sm"
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
      }}
    >
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-brand-gold/30 bg-brand-gold/10 px-3">
        <Grip className="h-3 w-3 text-brand-gold" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[1.2px] text-foreground">{label}</span>
        {badge && <span className="text-[9px] text-brand-gold">{badge}</span>}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 opacity-70">
        <span className="h-2 w-3/4 rounded-full bg-foreground/20" />
        <span className="h-2 w-full rounded-full bg-foreground/10" />
        <span className="h-2 w-5/6 rounded-full bg-foreground/10" />
        <span className="mt-2 h-8 w-full rounded border border-foreground/10 bg-foreground/5" />
      </div>
    </div>
  )
}

function ResizeHandle({
  edge,
  className,
  panel,
  onDown,
  onMove,
  onUp,
  onKeyDown,
  onFitToContent,
  t,
  children,
}: {
  edge: ResizeEdge
  className: string
  panel: PanelLayout
  onDown: (panel: PanelLayout, edges: ResizeEdge, event: PointerEvent<HTMLDivElement>) => void
  onMove: (event: PointerEvent<HTMLDivElement>) => void
  onUp: () => void
  onKeyDown: (panel: PanelLayout, edges: ResizeEdge, event: KeyboardEvent<HTMLDivElement>) => void
  // Only the plain N/S edge handles get this (see fitPaneHeightToContent) — snaps this edge to
  // the panel's natural content height instead of a user-dragged one. Double-click matches the
  // familiar spreadsheet/file-manager "double-click a border to autofit" convention; Enter is the
  // keyboard equivalent, consistent with every other drag handle in the terminal having one.
  onFitToContent?: () => void
  t: (key: string) => string
  children?: ReactNode
}) {
  // A corner handle carries both axes — aria-orientation just describes which one to lead with
  // for a screen reader; arrow keys in both directions still work regardless (see
  // onResizeKeyDown, which no-ops an axis clampResize doesn't recognize for this handle's edges).
  const orientation = edge.e || edge.w ? "vertical" : "horizontal"
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={onFitToContent ? t("resizePaneFitHint") : t("resizePane")}
      title={onFitToContent ? t("resizePaneFitHint") : undefined}
      tabIndex={0}
      className={`${className} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/60`}
      onPointerDown={(event) => onDown(panel, edge, event)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onLostPointerCapture={onUp}
      onDoubleClick={onFitToContent}
      onKeyDown={(event) => {
        if (onFitToContent && event.key === "Enter") {
          event.preventDefault()
          onFitToContent()
          return
        }
        onKeyDown(panel, edge, event)
      }}
    >
      {children}
    </div>
  )
}

function defaultIdsForPreset(preset: PresetValue): PanelId[] {
  switch (preset) {
    case "PANE_1":
      return ["command"]
    case "PANE_2":
      return ["command", "evidence"]
    case "PANE_4":
      return ["command", "evidence", "chat", "procedure"]
    case "PANE_6":
      return ["command", "evidence", "law", "mindMap", "procedure", "chat"]
    default:
      return ["command", "evidence"]
  }
}

function PresetLayoutPreview({ preset, selected }: { preset: PresetValue; selected: boolean }) {
  const panelIds = defaultIdsForPreset(preset)
  const columns = preset === "PANE_1" ? 1 : preset === "PANE_6" ? 3 : 2

  return (
    <span
      aria-hidden="true"
      className={`grid h-20 w-full gap-1 rounded border p-1.5 transition-colors ${
        selected ? "border-brand-gold/60 bg-brand-navy-950/70" : "border-border/70 bg-muted/60"
      }`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {panelIds.map((panelId, index) => (
        <span
          key={`${panelId}-${index}`}
          className={`min-h-0 rounded-sm border ${
            selected ? "border-brand-gold/35 bg-brand-gold/35" : "border-foreground/10 bg-foreground/15"
          }`}
        />
      ))}
    </span>
  )
}
