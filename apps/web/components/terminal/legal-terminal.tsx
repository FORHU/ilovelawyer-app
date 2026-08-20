"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { ArrowLeft, Grip, Loader2, AlertCircle, X, RefreshCw } from "lucide-react"
import { FatalRiskBanner, TerminalPanelBody } from "@/components/terminal/terminal-panels"
import {
  useApplyWorkspaceMutation,
  useCaseSnapshotQuery,
  useCreateWorkspaceMutation,
  useRefreshSnapshotMutation,
  useResetWorkspaceMutation,
  useTerminalCatalogQuery,
  useTerminalWorkspacesQuery,
} from "@/lib/terminal/mutations"
import type { PanelId, PanelLayout, PresetValue, WorkspaceLayout } from "@/lib/terminal/types"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

const HIDDEN_PANELS = new Set<PanelId>(["redTeam", "dates"])

const PANEL_TITLES: Record<PanelId, string> = {
  command: "Case Summary",
  evidence: "Evidence & Timeline",
  law: "Law & Precedent",
  dates: "Timeline",
  chat: "AI Legal Assistant",
  mindMap: "Visual Strategy Map",
  redTeam: "Red Team",
  procedure: "Case Strategy",
  teamAudit: "Team & Audit",
}

const PRESET_LABELS: Record<PresetValue, string> = {
  PANE_1: "preset1",
  PANE_2: "preset2",
  PANE_4: "preset4",
  PANE_6: "preset6",
}

const MIN_FR = 0.18
const PANE_GAP_PX = 6

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
  const applyWorkspace = useApplyWorkspaceMutation()
  const resetWorkspace = useResetWorkspaceMutation()
  const refresh = useRefreshSnapshotMutation(caseId)

  const [layout, setLayout] = useState<WorkspaceLayout | null>(null)
  const [workspaceName, setWorkspaceName] = useState("")
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState("")
  const [draggingId, setDraggingId] = useState<PanelId | null>(null)
  const resizeRef = useRef<ResizeDrag | null>(null)
  const moveRef = useRef<MoveDrag | null>(null)

  useEffect(() => {
    if (!catalog.data || catalog.isLoading || workspaces.isLoading || layout) return
    const lastUsed = workspaces.data?.find((w) => w.isLastUsed)
    const fallback: WorkspaceLayout = {
      preset: catalog.data.defaultPreset,
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

  const visiblePanels = useMemo(() => {
    if (!layout) return []
    return [...layout.panels].filter((p) => p.visible && !HIDDEN_PANELS.has(p.id)).sort((a, b) => a.order - b.order)
  }, [layout])

  const hiddenPanels = useMemo(() => {
    if (!layout || !catalog.data) return []
    return catalog.data.panels.filter((panel) => {
      if (!panel.available || HIDDEN_PANELS.has(panel.id)) return false
      return !layout.panels.find((p) => p.id === panel.id)?.visible
    })
  }, [layout, catalog.data])

  const setPreset = (preset: PresetValue) => {
    setLayout((prev) => {
      if (!prev || !catalog.data) return prev
      return applyPreset(prev, preset, catalog.data.panels.filter((p) => p.available).map((p) => p.id))
    })
  }

  const hidePanel = (id: PanelId) => {
    setLayout((prev) => {
      if (!prev) return prev
      const visibleCount = prev.panels.filter((p) => p.visible && !HIDDEN_PANELS.has(p.id)).length
      if (visibleCount <= 1) return prev
      return { ...prev, panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, visible: false } : panel)) }
    })
  }

  const showPanel = (id: PanelId) => {
    setLayout((prev) => {
      if (!prev) return prev
      const maxOrder = Math.max(0, ...prev.panels.filter((p) => p.visible).map((p) => p.order))
      const next = { id, visible: true, order: maxOrder + 1, ...cascadeRect(prev.panels) }
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
    patchPanelRect(drag.panelId, clampResize(drag, dx, dy))
  }

  const onResizePointerUp = () => {
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
    patchPanelRect(move.panelId, {
      x: clamp(move.x + dx, 0, 1 - move.width),
      y: clamp(move.y + dy, 0, 1 - move.height),
      width: move.width,
      height: move.height,
    })
  }

  const onHeaderPointerUp = () => {
    moveRef.current = null
    setDraggingId(null)
  }

  const controlClass =
    "h-8 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors hover:border-foreground/20 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
  const ghostBtnClass =
    "h-8 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
  const primaryBtnClass =
    "h-8 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"

  if (snapshot.isLoading || catalog.isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-background font-['Inter'] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("loading")}
      </div>
    )
  }

  if (snapshot.isError || !snapshot.data || !layout) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background font-['Inter'] text-foreground">
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-border bg-card px-4">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/homepage/terminal"
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
          {t("next")}: {nextLabel}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <select
            value={layout.preset}
            onChange={(e) => setPreset(e.target.value as PresetValue)}
            aria-label={t("preset")}
            className={controlClass}
          >
            {(catalog.data?.presets ?? []).map((preset) => (
              <option key={preset} value={preset}>
                {t(PRESET_LABELS[preset])}
              </option>
            ))}
          </select>
          {hiddenPanels.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) showPanel(e.target.value as PanelId)
              }}
              className={controlClass}
              aria-label={t("addPane")}
            >
              <option value="">{t("addPane")}</option>
              {hiddenPanels.map((panel) => (
                <option key={panel.id} value={panel.id}>
                  {PANEL_TITLES[panel.id] ?? panel.label}
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedWorkspaceId}
            onChange={(e) => {
              const id = e.target.value
              setSelectedWorkspaceId(id)
              const workspace = workspaces.data?.find((w) => w.id === id)
              if (!workspace) return
              setLayout(
                hydrateFreeform(
                  mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? []),
                ),
              )
              applyWorkspace.mutate(id)
            }}
            className={`${controlClass} max-w-40`}
            aria-label={t("loadWorkspace")}
          >
            <option value="">{t("loadWorkspace")}</option>
            {(workspaces.data ?? []).map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
          <input
            value={workspaceName}
            onChange={(e) => setWorkspaceName(e.target.value)}
            placeholder={t("workspaceName")}
            className={`${controlClass} w-36 placeholder:text-muted-foreground`}
          />
          <button
            type="button"
            disabled={!workspaceName.trim() || createWorkspace.isPending}
            onClick={() => {
              const name = workspaceName.trim()
              if (!name || !layout) return
              createWorkspace.mutate({ name, preset: layout.preset, layoutJson: layout })
              setWorkspaceName("")
            }}
            className={primaryBtnClass}
          >
            {t("save")}
          </button>
          <button
            type="button"
            onClick={() => {
              resetWorkspace.mutate(layout.preset, {
                onSuccess: (workspace) => {
                  setLayout(
                    hydrateFreeform(
                      mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? []),
                    ),
                  )
                  setSelectedWorkspaceId(workspace.id)
                },
              })
            }}
            className={ghostBtnClass}
          >
            {t("reset")}
          </button>
          <button
            type="button"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`} aria-hidden="true" />
            {refresh.isPending ? t("refreshing") : t("refresh")}
          </button>
        </div>
      </div>

      {snapshot.data.fatalRisks.length > 0 && (
        <div className="px-3 pt-3">
          <FatalRiskBanner risks={snapshot.data.fatalRisks} />
        </div>
      )}

      <div id="terminal-grid" className="relative min-h-0 flex-1 overflow-hidden p-3">
        {visiblePanels.map((panel) => {
          const rect = panelRect(panel)
          const label = PANEL_TITLES[panel.id] ?? catalog.data?.panels.find((p) => p.id === panel.id)?.label ?? panel.id
          const isDragging = draggingId === panel.id
          return (
            <div
              key={panel.id}
              data-panel-id={panel.id}
              className={`absolute flex min-h-0 min-w-0 flex-col rounded-lg border border-border bg-card ${
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
                className="flex h-9 shrink-0 cursor-grab items-center gap-2 rounded-t-lg border-b border-border bg-muted px-3 active:cursor-grabbing"
                title={t("dragHint")}
              >
                <Grip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                  {label}
                </span>
                {visiblePanels.length > 1 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => hidePanel(panel.id)}
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label={t("hidePane")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("hidePane")}</TooltipContent>
                  </Tooltip>
                )}
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
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function panelRect(panel: PanelLayout): PaneRect {
  return {
    x: Number.isFinite(panel.x) ? Number(panel.x) : 0,
    y: Number.isFinite(panel.y) ? Number(panel.y) : 0,
    width: Math.max(MIN_FR, panel.width || MIN_FR),
    height: Math.max(MIN_FR, panel.height || MIN_FR),
  }
}

function clampResize(drag: ResizeDrag, dx: number, dy: number): PaneRect {
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
