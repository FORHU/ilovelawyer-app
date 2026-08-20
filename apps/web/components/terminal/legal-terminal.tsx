"use client"

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react"
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

type ResizeDrag =
  | { kind: "col"; leftCol: number; rightCol: number; startX: number; leftFr: number; rightFr: number }
  | { kind: "row"; topRow: number; bottomRow: number; startY: number; topFr: number; bottomFr: number }

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
  const [dropTargetId, setDropTargetId] = useState<PanelId | null>(null)
  const resizeRef = useRef<ResizeDrag | null>(null)
  const moveRef = useRef<{ panelId: PanelId; startX: number; startY: number; armed: boolean } | null>(null)
  const dropTargetRef = useRef<PanelId | null>(null)

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
      setLayout(mergeCatalogPanels(asLayout(lastUsed.layoutJson, fallback), catalog.data.panels.map((p) => p.id)))
      setSelectedWorkspaceId(lastUsed.id)
      return
    }
    setLayout(applyPreset(fallback, "PANE_4", catalog.data.panels.filter((p) => p.available).map((p) => p.id)))
  }, [catalog.data, catalog.isLoading, workspaces.data, workspaces.isLoading, layout])

  const visiblePanels = useMemo(() => {
    if (!layout) return []
    return [...layout.panels].filter((p) => p.visible && !HIDDEN_PANELS.has(p.id)).sort((a, b) => a.order - b.order)
  }, [layout])

  const cols = columnCount(layout?.preset ?? "PANE_2", visiblePanels.length)
  const rows = Math.max(1, Math.ceil(visiblePanels.length / cols))
  const { colFr, rowFr } = tracksFromPanels(visiblePanels, cols, rows)

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
      const next = { id, visible: true, order: maxOrder + 1, width: 1, height: 1 }
      if (prev.panels.some((panel) => panel.id === id)) {
        return {
          ...prev,
          panels: prev.panels.map((panel) => (panel.id === id ? { ...panel, ...next } : panel)),
        }
      }
      return { ...prev, panels: [...prev.panels, next] }
    })
  }

  const swapPanels = (fromId: PanelId, toId: PanelId) => {
    if (fromId === toId) return
    setLayout((prev) => {
      if (!prev) return prev
      const from = prev.panels.find((p) => p.id === fromId)
      const to = prev.panels.find((p) => p.id === toId)
      if (!from || !to) return prev
      return {
        ...prev,
        panels: prev.panels.map((panel) => {
          if (panel.id === fromId) return { ...panel, order: to.order }
          if (panel.id === toId) return { ...panel, order: from.order }
          return panel
        }),
      }
    })
  }

  const writeTracks = (nextCol: number[], nextRow: number[]) => {
    setLayout((prev) => {
      if (!prev) return prev
      return { ...prev, panels: applyTracks(prev.panels, visiblePanels, cols, nextCol, nextRow) }
    })
  }

  const onResizePointerDown = (drag: ResizeDrag, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    resizeRef.current = drag
  }

  const onResizePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current
    const grid = document.getElementById("terminal-grid")
    if (!drag || !grid) return
    if (drag.kind === "col") {
      const delta = (event.clientX - drag.startX) / grid.clientWidth
      const left = Math.max(MIN_FR, drag.leftFr + delta)
      const right = Math.max(MIN_FR, drag.rightFr - delta)
      const next = [...colFr]
      next[drag.leftCol] = left
      next[drag.rightCol] = right
      writeTracks(next, rowFr)
      return
    }
    const delta = (event.clientY - drag.startY) / grid.clientHeight
    const top = Math.max(MIN_FR, drag.topFr + delta)
    const bottom = Math.max(MIN_FR, drag.bottomFr - delta)
    const next = [...rowFr]
    next[drag.topRow] = top
    next[drag.bottomRow] = bottom
    writeTracks(colFr, next)
  }

  const onResizePointerUp = () => {
    resizeRef.current = null
  }

  const onHeaderPointerDown = (panelId: PanelId, event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    moveRef.current = { panelId, startX: event.clientX, startY: event.clientY, armed: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onHeaderPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const move = moveRef.current
    if (!move) return
    const distance = Math.hypot(event.clientX - move.startX, event.clientY - move.startY)
    if (!move.armed && distance < 6) return
    move.armed = true
    setDraggingId(move.panelId)
    const el = document.elementFromPoint(event.clientX, event.clientY)
    const target = el?.closest("[data-panel-id]")?.getAttribute("data-panel-id") as PanelId | null
    const nextTarget = target && target !== move.panelId ? target : null
    dropTargetRef.current = nextTarget
    setDropTargetId(nextTarget)
  }

  const onHeaderPointerUp = () => {
    const move = moveRef.current
    const target = dropTargetRef.current
    if (move?.armed && target) swapPanels(move.panelId, target)
    moveRef.current = null
    dropTargetRef.current = null
    setDraggingId(null)
    setDropTargetId(null)
  }

  const controlClass =
    "h-8 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors hover:border-foreground/20 focus:border-ring focus:ring-2 focus:ring-ring/20"
  const ghostBtnClass =
    "h-8 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
  const primaryBtnClass =
    "h-8 rounded-md bg-secondary px-3 text-[10px] font-semibold uppercase tracking-[1px] text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"

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
        <button type="button" onClick={() => snapshot.refetch()} className="text-xs font-semibold uppercase tracking-wider text-blue-400 hover:underline">
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
        <h1 className="min-w-0 shrink truncate text-sm font-medium text-foreground md:text-base">
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
              setLayout(mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? []))
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
            className={`${controlClass} w-36`}
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
                  setLayout(mergeCatalogPanels(asLayout(workspace.layoutJson, layout), catalog.data?.panels.map((p) => p.id) ?? []))
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
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
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

      <div
        id="terminal-grid"
        className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3"
        style={{
          gridTemplateColumns: colFr.map((fr) => `minmax(0, ${fr}fr)`).join(" "),
          gridTemplateRows: rowFr.map((fr) => `minmax(0, ${fr}fr)`).join(" "),
        }}
      >
        {visiblePanels.map((panel, index) => {
          const col = index % cols
          const row = Math.floor(index / cols)
          const label = PANEL_TITLES[panel.id] ?? catalog.data?.panels.find((p) => p.id === panel.id)?.label ?? panel.id
          const isDrop = dropTargetId === panel.id
          return (
            <div
              key={panel.id}
              data-panel-id={panel.id}
              className={`relative flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card ${
                draggingId === panel.id ? "opacity-50" : ""
              } ${isDrop ? "ring-2 ring-blue-500" : ""}`}
              style={{ gridColumn: col + 1, gridRow: row + 1 }}
            >
              <div
                onPointerDown={(e) => onHeaderPointerDown(panel.id, e)}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
                onPointerCancel={onHeaderPointerUp}
                className="flex h-9 shrink-0 cursor-grab items-center gap-2 border-b border-border bg-muted px-3 active:cursor-grabbing"
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
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                        aria-label={t("hidePane")}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("hidePane")}</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="min-h-0 flex-1 overflow-hidden bg-card">
                <TerminalPanelBody panelId={panel.id} caseId={caseId} snapshot={snapshot.data} />
              </div>

              {col < cols - 1 && index + 1 < visiblePanels.length && (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  onPointerDown={(e) =>
                    onResizePointerDown(
                      { kind: "col", leftCol: col, rightCol: col + 1, startX: e.clientX, leftFr: colFr[col] ?? 1, rightFr: colFr[col + 1] ?? 1 },
                      e,
                    )
                  }
                  onPointerMove={onResizePointerMove}
                  onPointerUp={onResizePointerUp}
                  className="absolute -right-1.5 top-0 z-20 h-full w-3 cursor-col-resize"
                />
              )}
              {row < rows - 1 && (
                <div
                  role="separator"
                  aria-orientation="horizontal"
                  onPointerDown={(e) =>
                    onResizePointerDown(
                      { kind: "row", topRow: row, bottomRow: row + 1, startY: e.clientY, topFr: rowFr[row] ?? 1, bottomFr: rowFr[row + 1] ?? 1 },
                      e,
                    )
                  }
                  onPointerMove={onResizePointerMove}
                  onPointerUp={onResizePointerUp}
                  className="absolute -bottom-1.5 left-0 z-20 h-3 w-full cursor-row-resize"
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function columnCount(preset: PresetValue, n: number) {
  if (n <= 1) return 1
  if (preset === "PANE_6" || n >= 5) return 3
  if (preset === "PANE_1") return 1
  return 2
}

function tracksFromPanels(panels: PanelLayout[], cols: number, rows: number) {
  const colFr = Array.from({ length: cols }, (_, col) => {
    const cell = panels.find((_, index) => index % cols === col)
    return Math.max(MIN_FR, cell?.width || 1)
  })
  const rowFr = Array.from({ length: rows }, (_, row) => {
    const cell = panels[row * cols]
    return Math.max(MIN_FR, cell?.height || 1)
  })
  return { colFr, rowFr }
}

function applyTracks(
  all: PanelLayout[],
  visible: PanelLayout[],
  cols: number,
  colFr: number[],
  rowFr: number[],
): PanelLayout[] {
  const byId = new Map(visible.map((panel, index) => [panel.id, { col: index % cols, row: Math.floor(index / cols) }]))
  return all.map((panel) => {
    const pos = byId.get(panel.id)
    if (!pos) return panel
    return {
      ...panel,
      width: colFr[pos.col] ?? 1,
      height: rowFr[pos.row] ?? 1,
    }
  })
}

function applyPreset(layout: WorkspaceLayout, preset: PresetValue, availableIds: PanelId[]): WorkspaceLayout {
  const merged = mergeCatalogPanels(layout, availableIds)
  const visibleIds = defaultIdsForPreset(preset).filter((id) => availableIds.includes(id) && !HIDDEN_PANELS.has(id))
  return {
    preset,
    panels: merged.panels.map((panel, index) => {
      const visibleIndex = visibleIds.indexOf(panel.id)
      const visible = visibleIndex !== -1
      return {
        ...panel,
        visible,
        order: visible ? visibleIndex : 100 + index,
        width: 1,
        height: 1,
      }
    }),
  }
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
