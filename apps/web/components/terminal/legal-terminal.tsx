"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import {
  AppWindow,
  ArrowLeft,
  Columns2,
  Columns3,
  Download,
  Grip,
  LayoutPanelLeft,
  Loader2,
  AlertCircle,
  Pin,
  Plus,
  PanelLeft,
  PanelTop,
  RefreshCw,
  Maximize2,
  Minimize2,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react"
import { FatalRiskBanner, TerminalPanelBody } from "@/components/terminal/terminal-panels"
import { CaseBriefPreviewModal } from "@/components/case-brief/case-brief-preview-modal"
import {
  useAiJobStatus,
  useApplyWorkspaceMutation,
  useCaseSnapshotQuery,
  useCreateWorkspaceMutation,
  useDeleteWorkspaceMutation,
  useRefreshSnapshotMutation,
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
  { id: "columns", labelKey: "arrangementColumns", icon: Columns3 },
  { id: "tabs", labelKey: "arrangementTabs", icon: PanelTop },
  { id: "focus", labelKey: "arrangementFocus", icon: LayoutPanelLeft },
  { id: "split", labelKey: "arrangementSplit", icon: Columns2 },
]

const MIN_FR = 0.18
const PANE_GAP_PX = 6
// 1/24 gives a 24-column/row grid — fine enough not to feel restrictive at
// MIN_FR-sized panes (~4.3 cells) but still a real snap, not a cosmetic one.
const GRID_SNAP_STEP = 1 / 24

type PaneRect = { x: number; y: number; width: number; height: number }
type ResizeEdge = { n?: boolean; s?: boolean; e?: boolean; w?: boolean }
type ResizeDrag = PaneRect & { panelId: PanelId; edges: ResizeEdge; startX: number; startY: number }
type MoveDrag = PaneRect & { panelId: PanelId; startX: number; startY: number; armed: boolean }

function asLayout(value: unknown, fallback: WorkspaceLayout): WorkspaceLayout {
  if (!value || typeof value !== "object") return fallback
  const raw = value as Partial<WorkspaceLayout>
  if (!Array.isArray(raw.panels)) return fallback
  return {
    preset: raw.preset ?? fallback.preset,
    arrangement: raw.arrangement ?? fallback.arrangement ?? "columns",
    panels: raw.panels as PanelLayout[],
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
  const workspaces = useTerminalWorkspacesQuery()
  const snapshot = useCaseSnapshotQuery(caseId)
  const createWorkspace = useCreateWorkspaceMutation()
  const updateWorkspace = useUpdateWorkspaceMutation()
  const applyWorkspace = useApplyWorkspaceMutation()
  const deleteWorkspace = useDeleteWorkspaceMutation()
  const refresh = useRefreshSnapshotMutation(caseId)
  const refreshJob = useAiJobStatus(caseId, "caseRefresh")
  const isRefreshing = refresh.isPending || refreshJob.data?.status === "IN_PROGRESS"

  const [layout, setLayout] = useState<WorkspaceLayout | null>(null)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
  const [draggingId, setDraggingId] = useState<PanelId | null>(null)
  // A maximized pane covers the whole stage on top of whatever arrangement is active; its
  // committed rect/grouping is left untouched, so clearing this just removes the overlay.
  const [maximizedId, setMaximizedId] = useState<PanelId | null>(null)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [briefPreviewOpen, setBriefPreviewOpen] = useState(false)
  // Lifted out of TerminalSettingsSidebar (mirrors ConsultationSidebar's sidebarMobileOpen) so
  // the mobile trigger can render inline in the Case Row instead of as a floating circle that
  // overlapped the "Back to Case" link below `lg`.
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false)
  // Tabs/Focus "which one is showing" state is intentionally ephemeral (not saved with the
  // workspace) — it resets to the first pane in each group/stack on reload, same spirit as
  // the freeform canvas not remembering scroll position.
  const [activeTabA, setActiveTabA] = useState<PanelId | null>(null)
  const [activeTabB, setActiveTabB] = useState<PanelId | null>(null)
  const [focusedId, setFocusedId] = useState<PanelId | null>(null)
  const [creatingLayout, setCreatingLayout] = useState(false)
  const [newLayoutName, setNewLayoutName] = useState("")
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
  // Drag/resize used to call setLayout() (a full state update, re-rendering every visible
  // pane's contents) on every raw pointermove — the measured cause of the reported lag. This
  // ref instead tracks the in-progress rect and is written straight to the pane's DOM style
  // (applyLivePaneStyle, bypassing React) on each move; the single commit to React state
  // happens once, on pointer-up.
  const pendingRectRef = useRef<{ panelId: PanelId; rect: PaneRect } | null>(null)

  useEffect(() => {
    if (!catalog.data || catalog.isLoading || workspaces.isLoading || layout) return
    const lastUsed = workspaces.data?.find((w) => w.isLastUsed)
    const fallback: WorkspaceLayout = {
      preset: catalog.data.defaultPreset,
      arrangement: "columns",
      panels: catalog.data.panels.map((panel, index) => ({
        id: panel.id,
        visible: false,
        order: index,
        width: 1,
        height: 1,
      })),
    }
    if (lastUsed) {
      setLayout(
        hydrateFreeform(mergeCatalogPanels(asLayout(lastUsed.layoutJson, fallback), catalog.data.panels.map((p) => p.id))),
      )
      setSelectedWorkspaceId(lastUsed.id)
      return
    }
    setLayout(applyPreset(fallback, "PANE_4", catalog.data.panels.filter((p) => p.available).map((p) => p.id)))
  }, [catalog.data, catalog.isLoading, workspaces.data, workspaces.isLoading, layout])

  const arrangement: ArrangementValue = layout?.arrangement ?? "columns"

  const setArrangement = (next: ArrangementValue) => {
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

  // rect is explicit for a drag-and-drop drop position; omitted for the Panel Library's
  // click fallback (and for drops in a non-Columns arrangement, where there's no on-screen
  // coordinate to place it at), which keeps today's cascade placement.
  const showPanelAt = (id: PanelId, rect?: PaneRect) => {
    setLayout((prev) => {
      if (!prev) return prev
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      const next = { id, visible: true, order: maxOrder + 1, ...(rect ?? cascadeRect(prev.panels)) }
      if (prev.panels.some((panel) => panel.id === id)) {
        return {
          ...prev,
          panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, ...next } : panel)),
        }
      }
      return { ...prev, panels: [...prev.panels, next] }
    })
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
    const rect = panelRect(panel)
    bringToFront(panel.id)
    resizeRef.current = { panelId: panel.id, edges, startX: event.clientX, startY: event.clientY, ...rect }
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current
    const grid = document.getElementById("terminal-grid")
    if (!drag || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    const dx = (event.clientX - drag.startX) / grid.clientWidth
    const dy = (event.clientY - drag.startY) / grid.clientHeight
    const rect = clampResize(drag, dx, dy, true)
    pendingRectRef.current = { panelId: drag.panelId, rect }
    applyLivePaneStyle(drag.panelId, rect)
  }

  const onResizePointerUp = () => {
    if (pendingRectRef.current) {
      patchPanelRect(pendingRectRef.current.panelId, pendingRectRef.current.rect)
      pendingRectRef.current = null
    }
    resizeRef.current = null
  }

  const onHeaderPointerDown = (panel: PanelLayout, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    bringToFront(panel.id)
    moveRef.current = { panelId: panel.id, startX: event.clientX, startY: event.clientY, armed: false, ...panelRect(panel) }
  }

  const onHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const move = moveRef.current
    const grid = document.getElementById("terminal-grid")
    if (!move || !grid || grid.clientWidth === 0 || grid.clientHeight === 0) return
    const distance = Math.hypot(event.clientX - move.startX, event.clientY - move.startY)
    if (!move.armed && distance < 6) return
    move.armed = true
    setDraggingId(move.panelId)
    const dx = (event.clientX - move.startX) / grid.clientWidth
    const dy = (event.clientY - move.startY) / grid.clientHeight
    const x = clamp(snapValue(clamp(move.x + dx, 0, 1 - move.width), GRID_SNAP_STEP), 0, 1 - move.width)
    const y = clamp(snapValue(clamp(move.y + dy, 0, 1 - move.height), GRID_SNAP_STEP), 0, 1 - move.height)
    const rect = { x, y, width: move.width, height: move.height }
    pendingRectRef.current = { panelId: move.panelId, rect }
    applyLivePaneStyle(move.panelId, rect)
  }

  const onHeaderPointerUp = () => {
    if (pendingRectRef.current) {
      patchPanelRect(pendingRectRef.current.panelId, pendingRectRef.current.rect)
      pendingRectRef.current = null
    }
    moveRef.current = null
    setDraggingId(null)
  }

  const selectWorkspace = (id: string) => {
    setSelectedWorkspaceId(id)
    setMaximizedId(null)
    const workspace = workspaces.data?.find((w) => w.id === id)
    if (!workspace || !layout) return
    setLayout(
      hydrateFreeform(mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? [])),
    )
    applyWorkspace.mutate(id)
  }

  const commitNewLayout = () => {
    const name = newLayoutName.trim()
    if (name && layout) createWorkspace.mutate({ name, preset: layout.preset, layoutJson: layout })
    setNewLayoutName("")
    setCreatingLayout(false)
  }

  const updateCurrentWorkspace = () => {
    if (!selectedWorkspaceId || !layout) return
    updateWorkspace.mutate({ id: selectedWorkspaceId, preset: layout.preset, layoutJson: layout })
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
      arrangement: "columns",
      panels: catalog.data.panels.map((panel, index) => ({
        id: panel.id,
        visible: false,
        order: index,
        width: 1,
        height: 1,
      })),
    }
    const defaultLayout = applyPreset(fallback, preset, catalog.data.panels.filter((p) => p.available).map((p) => p.id))
    setLayout(defaultLayout)
    updateWorkspace.mutate({ id: selectedWorkspaceId, preset, layoutJson: defaultLayout })
  }

  // Deleting the active tab needs somewhere else to land — falls back to whichever tab is
  // first in the (now stable, createdAt-ordered) remaining list. Blocked entirely when it's the
  // only tab left; the terminal always needs at least one layout to show.
  const closeWorkspaceTab = (id: string) => {
    const [fallback] = (workspaces.data ?? []).filter((w) => w.id !== id)
    if (!fallback) return
    deleteWorkspace.mutate(id, {
      onSuccess: () => {
        if (id === selectedWorkspaceId) selectWorkspace(fallback.id)
      },
    })
  }

  if (snapshot.isLoading || catalog.isLoading) {
    return (
      <div className="dark flex flex-1 flex-col items-center justify-center gap-2 bg-background font-['Inter'] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    )
  }

  if (snapshot.isError || !snapshot.data || !layout) {
    return (
      <div className="dark flex flex-1 flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-red-400" aria-hidden="true" />
        <p className="text-red-400">{t("loadError")}</p>
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
    // The Legal Terminal is always the brand's near-black/gold palette (matching the redesign
    // screenshots), regardless of the user's light/dark theme preference — same intent as
    // global-header.tsx's always-black chrome, but scoped here via Tailwind's `dark` class
    // instead of hardcoding every one of the many bg-background/bg-card/border-border tokens
    // already used across this file, terminal-panels.tsx, and the sidebar.
    <div ref={rootRef} className="dark relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background font-['Inter'] text-foreground">
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
          <span className="hidden shrink-0 rounded-md border border-orange-400/30 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1px] text-orange-400 sm:inline">
            {t("next")}: <span className="font-mono normal-case tracking-normal">{nextLabel}</span>
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setBriefPreviewOpen(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted/70"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("downloadCaseBrief")}
            </button>
            <button
              type="button"
              onClick={() => refresh.mutate()}
              disabled={isRefreshing}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} aria-hidden="true" />
              {isRefreshing ? t("refreshing") : t("refresh")}
            </button>
          </div>
        </div>
        <CaseBriefPreviewModal caseId={caseId} open={briefPreviewOpen} onOpenChange={setBriefPreviewOpen} />

        {/* Terminal bar: layout tabs · arrangement switch · pane count · add pane */}
        <div className="flex h-12 shrink-0 items-stretch gap-4 overflow-x-auto border-b border-border bg-card px-4">
          <div className="flex min-w-0 flex-1 items-stretch gap-5 overflow-x-auto">
            {(workspaces.data ?? []).map((workspace) => {
              const active = workspace.id === selectedWorkspaceId
              const canClose = (workspaces.data?.length ?? 0) > 1
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
                  {canClose && (
                    <button
                      type="button"
                      onClick={() => closeWorkspaceTab(workspace.id)}
                      aria-label={t("closeLayout")}
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100 dark:hover:bg-overlay-hover"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  )}
                </span>
              )
            })}
            {creatingLayout ? (
              <input
                autoFocus
                value={newLayoutName}
                onChange={(e) => setNewLayoutName(e.target.value)}
                onBlur={commitNewLayout}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitNewLayout()
                  if (e.key === "Escape") {
                    setNewLayoutName("")
                    setCreatingLayout(false)
                  }
                }}
                placeholder={t("workspaceName")}
                className="h-7 w-36 shrink-0 self-center rounded-md border border-border bg-muted px-2 text-xs text-foreground outline-none focus:border-brand-gold/60"
              />
            ) : (
              <button
                type="button"
                onClick={() => setCreatingLayout(true)}
                className="flex shrink-0 items-center gap-1.5 self-center text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground transition-colors hover:text-foreground"
              >
                <Plus className="h-3 w-3" aria-hidden="true" />
                {t("newLayout")}
              </button>
            )}
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
            <span className="hidden text-[10px] uppercase tracking-[1px] text-muted-foreground sm:inline">
              {t("paneCount", { count: visiblePanels.length, total: availablePanels.length })}
            </span>
            <button
              type="button"
              onClick={() => {
                // Only one of these is ever visible at a given viewport (aside is lg-and-up,
                // MobileDrawer is below lg) — setting both is harmless and viewport-agnostic.
                setSidebarExpanded(true)
                setMobileLibraryOpen(true)
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("addPane")}
            </button>
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
              <PopoverContent container={rootRef.current}>
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
                    {selectedWorkspaceId && (
                      <button
                        type="button"
                        disabled={updateWorkspace.isPending}
                        onClick={updateCurrentWorkspace}
                        className="h-8 w-full rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
                      >
                        {t("saveChanges")}
                      </button>
                    )}
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
          onAddPanel={(id) => showPanelAt(id)}
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

        <div className="relative min-h-0 flex-1 overflow-hidden p-3">
          {visiblePanels.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-sm text-muted-foreground">{t("emptyGrid")}</p>
            </div>
          )}

          {arrangement === "columns" && (
            <div
              id="terminal-grid"
              className="terminal-grid-texture relative h-full min-h-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
                if (!id) return
                const bounds = e.currentTarget.getBoundingClientRect()
                const width = 0.32
                const height = 0.32
                const x = clamp(snapValue(clamp((e.clientX - bounds.left) / bounds.width, 0, 1 - width), GRID_SNAP_STEP), 0, 1 - width)
                const y = clamp(snapValue(clamp((e.clientY - bounds.top) / bounds.height, 0, 1 - height), GRID_SNAP_STEP), 0, 1 - height)
                showPanelAt(id, { x, y, width, height })
              }}
            >
              {visiblePanels.map((panel) => {
                const rect = panelRect(panel)
                const label = labelFor(panel)
                const isDragging = draggingId === panel.id
                return (
                  <div
                    key={panel.id}
                    data-panel-id={panel.id}
                    data-panel-labels={panelLabels ? "on" : "off"}
                    className={`terminal-pane absolute flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card ${
                      isDragging ? "shadow-lg ring-1 ring-brand-gold/50" : ""
                    }`}
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
                      onPointerDown={(e) => onHeaderPointerDown(panel, e)}
                      onPointerMove={onHeaderPointerMove}
                      onPointerUp={onHeaderPointerUp}
                      onPointerCancel={onHeaderPointerUp}
                      className="terminal-pane-header flex h-9 shrink-0 cursor-grab items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3 active:cursor-grabbing"
                      title={t("dragHint")}
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
                      />
                    </div>
                    <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
                      <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot.data} />
                    </div>
                    <ResizeHandle edge={{ n: true }} className="absolute -top-1 left-3 right-3 z-20 h-2 cursor-n-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ s: true }} className="absolute -bottom-1 left-3 right-3 z-20 h-2 cursor-s-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ e: true }} className="absolute -right-1 top-3 bottom-3 z-20 w-2 cursor-e-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ w: true }} className="absolute -left-1 top-3 bottom-3 z-20 w-2 cursor-w-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ n: true, w: true }} className="absolute -left-1 -top-1 z-30 h-3 w-3 cursor-nw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ n: true, e: true }} className="absolute -right-1 -top-1 z-30 h-3 w-3 cursor-ne-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle edge={{ s: true, w: true }} className="absolute -bottom-1 -left-1 z-30 h-3 w-3 cursor-sw-resize" panel={panel} onDown={onResizePointerDown} onMove={onResizePointerMove} onUp={onResizePointerUp} />
                    <ResizeHandle
                      edge={{ s: true, e: true }}
                      className="absolute -bottom-0.5 -right-0.5 z-30 flex h-4 w-4 cursor-se-resize items-end justify-end p-0.5"
                      panel={panel}
                      onDown={onResizePointerDown}
                      onMove={onResizePointerMove}
                      onUp={onResizePointerUp}
                    >
                      <span className="h-2 w-2 rounded-sm border-b-2 border-r-2 border-muted-foreground/70" aria-hidden="true" />
                    </ResizeHandle>
                  </div>
                )
              })}
            </div>
          )}

          {arrangement === "tabs" && visiblePanels.length > 0 && (
            <TabsArrangement
              panels={visiblePanels}
              caseId={caseId}
              snapshot={snapshot.data}
              labelFor={labelFor}
              activeA={activeTabA}
              activeB={activeTabB}
              onSetActiveA={setActiveTabA}
              onSetActiveB={setActiveTabB}
              onToggleMaximize={toggleMaximize}
              onHide={hidePanel}
              t={t}
              onDrop={(id) => showPanelAt(id)}
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
              t={t}
              onDrop={(id) => showPanelAt(id)}
            />
          )}

          {arrangement === "split" && visiblePanels.length > 0 && (
            <SplitArrangement
              panels={visiblePanels}
              caseId={caseId}
              snapshot={snapshot.data}
              labelFor={labelFor}
              onToggleMaximize={toggleMaximize}
              onHide={hidePanel}
              t={t}
              onDrop={(id) => showPanelAt(id)}
            />
          )}

          {maximizedPanel && (
            <div
              data-panel-id={maximizedPanel.id}
              className="terminal-pane absolute inset-3 z-[90] flex flex-col rounded-lg border border-brand-gold/40 bg-card shadow-2xl"
            >
              <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3">
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {labelFor(maximizedPanel)}
                </span>
                <PaneHeaderActions
                  t={t}
                  isMaximized
                  onToggleMaximize={() => toggleMaximize(maximizedPanel.id)}
                  onHide={() => hidePanel(maximizedPanel.id)}
                />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-b-lg bg-card">
                <TerminalPanelBody panelId={maximizedPanel.id} caseId={caseId} snapshot={snapshot.data} />
              </div>
            </div>
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
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </label>
  )
}

// Shared header icon cluster: static (disabled) Pin/Pop-out affordances for visual parity
// with the redesign, plus the real Maximize/Hide controls that already exist today.
function PaneHeaderActions({
  t,
  isMaximized,
  onToggleMaximize,
  onHide,
}: {
  t: (key: string) => string
  isMaximized: boolean
  onToggleMaximize: () => void
  onHide: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-6 w-6 cursor-not-allowed items-center justify-center rounded p-1 text-muted-foreground/40">
            <Pin className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("pinPane")} — {t("comingSoon")}
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-6 w-6 cursor-not-allowed items-center justify-center rounded p-1 text-muted-foreground/40">
            <AppWindow className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {t("popOutPane")} — {t("comingSoon")}
        </TooltipContent>
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

type ArrangementBodyProps = {
  panels: PanelLayout[]
  caseId: string
  snapshot: CaseSnapshot
  labelFor: (panel: PanelLayout | { id: PanelId }) => string
  onToggleMaximize: (id: PanelId) => void
  onHide: (id: PanelId) => void
  t: (key: string, opts?: Record<string, unknown>) => string
  onDrop: (id: PanelId) => void
}

function dropHandlers(onDrop: (id: PanelId) => void) {
  return {
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const id = e.dataTransfer.getData("text/x-panel-id") as PanelId
      if (id) onDrop(id)
    },
  }
}

// Splits visible panes into 2 tab groups (first half / second half by order) — each group
// renders as one card with a clickable tab strip, only the active tab's body mounted below it.
function TabsArrangement({
  panels,
  caseId,
  snapshot,
  labelFor,
  activeA,
  activeB,
  onSetActiveA,
  onSetActiveB,
  onToggleMaximize,
  onHide,
  t,
  onDrop,
}: ArrangementBodyProps & {
  activeA: PanelId | null
  activeB: PanelId | null
  onSetActiveA: (id: PanelId) => void
  onSetActiveB: (id: PanelId) => void
}) {
  const half = Math.ceil(panels.length / 2)
  const groups = [panels.slice(0, half), panels.slice(half)].filter((group) => group.length > 0)
  const actives = [activeA, activeB]
  const setActives = [onSetActiveA, onSetActiveB]

  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto" {...dropHandlers(onDrop)}>
      {groups.map((group, groupIndex) => {
        const activeId = actives[groupIndex] && group.some((p) => p.id === actives[groupIndex]) ? actives[groupIndex] : group[0]?.id
        const activePanel = group.find((p) => p.id === activeId) ?? group[0]
        return (
          <div
            key={groupIndex}
            className="flex min-w-[280px] flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="terminal-pane-header flex h-10 shrink-0 items-stretch gap-1 border-b border-border px-2">
              {group.map((panel) => {
                const active = panel.id === activePanel?.id
                return (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setActives[groupIndex]?.(panel.id)}
                    className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-2 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
                      active ? "border-brand-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {labelFor(panel)}
                  </button>
                )
              })}
              {activePanel && (
                <div className="ml-auto flex items-center">
                  <PaneHeaderActions t={t} isMaximized={false} onToggleMaximize={() => onToggleMaximize(activePanel.id)} onHide={() => onHide(activePanel.id)} />
                </div>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              {activePanel && <TerminalPanelBody panelId={activePanel.id} caseId={caseId} snapshot={snapshot} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// One large focused pane plus a clickable stack of the rest — clicking a stack card swaps
// which pane is focused. Stack summaries are real data composites (stackSummaries, falling
// back to the single-metric panelBadges) — never an invented description of a pane's contents,
// same anti-fabrication stance as docs/adr/0013.
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
  t,
  onDrop,
}: ArrangementBodyProps & {
  stackSummaries: Partial<Record<PanelId, string>>
  panelBadges: Partial<Record<PanelId, string>>
  focusedId: PanelId | null
  onFocus: (id: PanelId) => void
}) {
  const chatPanel = panels.find((p) => p.id === "chat")
  const stackable = panels.filter((p) => p.id !== "chat")
  const focusId = focusedId && stackable.some((p) => p.id === focusedId) ? focusedId : stackable[0]?.id
  const focusPanel = stackable.find((p) => p.id === focusId)
  const stackRest = stackable.filter((p) => p.id !== focusId)

  return (
    <div
      className="grid h-full min-h-0 gap-3"
      style={{ gridTemplateColumns: chatPanel ? "minmax(280px,1.4fr) 260px minmax(260px,1fr)" : "minmax(280px,1.4fr) 260px" }}
      {...dropHandlers(onDrop)}
    >
      <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
        {focusPanel && (
          <>
            <div className="terminal-pane-header flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
              <span className="min-w-0 flex-1 truncate font-['Libre_Caslon_Text'] text-sm text-foreground">{labelFor(focusPanel)}</span>
              <PaneHeaderActions t={t} isMaximized={false} onToggleMaximize={() => onToggleMaximize(focusPanel.id)} onHide={() => onHide(focusPanel.id)} />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-card">
              <TerminalPanelBody panelId={focusPanel.id} caseId={caseId} snapshot={snapshot} />
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
      {chatPanel && (
        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-brand-gold/35 bg-card">
          <div className="terminal-pane-header flex h-9 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">{labelFor(chatPanel)}</span>
            <PaneHeaderActions t={t} isMaximized={false} onToggleMaximize={() => onToggleMaximize(chatPanel.id)} onHide={() => onHide(chatPanel.id)} />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-card">
            <TerminalPanelBody panelId={chatPanel.id} caseId={caseId} snapshot={snapshot} />
          </div>
        </div>
      )}
    </div>
  )
}

// Fixed 2-column grid of every visible pane, wrapping to further rows rather than the mock's
// literal 2-pane assumption — every visible pane stays reachable, no drag/resize.
function SplitArrangement({ panels, caseId, snapshot, labelFor, onToggleMaximize, onHide, t, onDrop }: ArrangementBodyProps) {
  return (
    <div
      className="grid h-full min-h-0 auto-rows-[minmax(280px,1fr)] gap-3 overflow-y-auto"
      style={{ gridTemplateColumns: "repeat(2, minmax(280px, 1fr))" }}
      {...dropHandlers(onDrop)}
    >
      {panels.map((panel) => (
        <div key={panel.id} className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="terminal-pane-header flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="min-w-0 flex-1 truncate font-['Libre_Caslon_Text'] text-sm text-foreground">{labelFor(panel)}</span>
            <PaneHeaderActions t={t} isMaximized={false} onToggleMaximize={() => onToggleMaximize(panel.id)} onHide={() => onHide(panel.id)} />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden bg-card">
            <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot} />
          </div>
        </div>
      ))}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

// Writes a pane's position/size straight to its DOM node during an active drag/resize,
// bypassing React so the gesture doesn't re-render the whole Terminal (and every visible
// pane's contents) on every pointermove. Mirrors the `style` computed from `rect` in the
// JSX below — must stay in sync with it, since a later React re-render will overwrite
// whatever this wrote with `rect` from committed state.
function applyLivePaneStyle(panelId: PanelId, rect: PaneRect) {
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

function ResizeHandle({
  edge,
  className,
  panel,
  onDown,
  onMove,
  onUp,
  children,
}: {
  edge: ResizeEdge
  className: string
  panel: PanelLayout
  onDown: (panel: PanelLayout, edges: ResizeEdge, event: PointerEvent<HTMLDivElement>) => void
  onMove: (event: PointerEvent<HTMLDivElement>) => void
  onUp: () => void
  children?: ReactNode
}) {
  return (
    <div
      role="separator"
      className={className}
      onPointerDown={(event) => onDown(panel, edge, event)}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
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
      return ["command", "evidence", "chat", "procedure", "mindMap"]
    case "PANE_6":
      return ["command", "evidence", "law", "mindMap", "procedure", "chat"]
    default:
      return ["command", "evidence"]
  }
}
