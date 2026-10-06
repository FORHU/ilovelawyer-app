"use client"

import { useHasAudioOverview } from "@/lib/chat/use-audio-overview"
import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { HIDDEN_PANELS, ModalOverlay, TerminalCanvas, type PaneDragPreview } from "@/components/terminal/terminal-canvas"
import TerminalSettingsSidebar from "@/components/terminal/terminal-settings-sidebar"
import { ArrangementSwitcher } from "@/components/terminal/arrangement-switcher"
import { PresetList } from "@/components/terminal/preset-list"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import { createPanelPlacementActions, moveToScreen } from "@/lib/terminal/panel-placement"
import {
  arrangementForScreen,
  autoTileLayout,
  computeFocusStackSummaries,
  computePanelBadges,
  openCanvasWindow,
  screenIndicesInUse,
  sortedSecondaryScreens,
} from "@/lib/terminal/multi-screen"
import {
  applyScreenPreset,
  captureCurrentScreens,
  fromRow,
  generateSpreadPreset,
  presetLabel,
  type ScreenPresetDef,
} from "@/lib/terminal/screen-presets"
import {
  useCaseSnapshotQuery,
  useCreateScreenPresetMutation,
  useCreateWorkspaceMutation,
  useDeleteScreenPresetMutation,
  useScreenPresetsQuery,
  useTerminalCatalogQuery,
} from "@/lib/terminal/mutations"
import type { ArrangementValue, PanelId, PanelLayout, WorkspaceLayout } from "@/lib/terminal/types"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"

interface LayoutBuilderModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Same detect-on-click contract as ScreenPresetsModal — see its own doc comment.
  detectedCount: number | null
  caseId: string
  canvasWindowsRef: React.RefObject<Map<number, Window>>
  // The builder already POSTed the new workspace itself (its own createWorkspace mutation) —
  // this just hands the result back so the caller can adopt it as the active tab.
  onCreated: (workspace: { id: string }, layoutJson: WorkspaceLayout) => void
}

// Ephemeral per-screen UI state — none of this lives on WorkspaceLayout (mirrors
// legal-terminal.tsx's own local state for the same fields). One independent copy per screen tab
// so switching tabs doesn't leak "this pane is maximized" across screens. Only ever one tab's
// TerminalCanvas is actually mounted at a time, so a single shared stageRef is enough — no need
// for a stageRef per screen.
interface ScreenUiState {
  maximizedId: PanelId | null
  focusedId: PanelId | null
  dragPreview: PaneDragPreview | null
  draggingId: PanelId | null
  replaceTarget: PanelId | null
}
const DEFAULT_UI_STATE: ScreenUiState = { maximizedId: null, focusedId: null, dragPreview: null, draggingId: null, replaceTarget: null }

/** The "+ New Layout" replacement: a drag-and-drop layout builder. Every available pane listed in
 * a sidebar, dragged onto a real per-screen TerminalCanvas (same component the live Terminal
 * uses — full arrangement switcher, resize, pin, all of it), one screen visible at a time via
 * tabs. Existing presets stay available as optional starting templates. No real secondary OS
 * windows open while building — only on final Create, mirroring ScreenPresetsModal's commit(). */
export function LayoutBuilderModal({ open, onOpenChange, detectedCount, caseId, canvasWindowsRef, onCreated }: LayoutBuilderModalProps) {
  const { t } = useTranslation("terminal")
  const catalog = useTerminalCatalogQuery()
  const snapshot = useCaseSnapshotQuery(caseId)
  const panelLabels = useTerminalDisplayStore((state) => state.panelLabels)

  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [detecting, setDetecting] = useState(false)
  // Screen count only ever grows while the modal is open (a lower re-detection, e.g. a monitor
  // unplugged mid-build, doesn't remove a tab the user may already have placed panes on) — see
  // the plan's edge-case note. Reset to 1 on close.
  const [tabCount, setTabCount] = useState(1)
  const screenCount = liveCount ?? detectedCount ?? 1
  useEffect(() => {
    if (screenCount > tabCount) setTabCount(screenCount)
  }, [screenCount, tabCount])

  const [activeScreenTab, setActiveScreenTab] = useState(0)
  const [builderLayout, setBuilderLayout] = useState<WorkspaceLayout | null>(null)
  const [screenUiState, setScreenUiState] = useState<Record<number, ScreenUiState>>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [name, setName] = useState("")

  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !catalog.data || builderLayout) return
    setBuilderLayout({
      preset: catalog.data.defaultPreset,
      arrangement: "free",
      panels: catalog.data.panels.map((panel, index) => ({ id: panel.id, visible: false, order: index, width: 1, height: 1 })),
    })
  }, [open, catalog.data, builderLayout])

  const presetsQuery = useScreenPresetsQuery(screenCount)
  const createWorkspace = useCreateWorkspaceMutation()
  const createScreenPreset = useCreateScreenPresetMutation()
  const deleteScreenPreset = useDeleteScreenPresetMutation()
  const templates: ScreenPresetDef[] = [...(presetsQuery.data?.map(fromRow) ?? []), ...(screenCount > 3 ? [generateSpreadPreset(screenCount)] : [])]

  const uiState = screenUiState[activeScreenTab] ?? DEFAULT_UI_STATE
  function makeUiSetter<K extends keyof ScreenUiState>(key: K): Dispatch<SetStateAction<ScreenUiState[K]>> {
    return (value) => {
      setScreenUiState((prev) => {
        const cur = prev[activeScreenTab] ?? DEFAULT_UI_STATE
        const next = typeof value === "function" ? (value as (p: ScreenUiState[K]) => ScreenUiState[K])(cur[key]) : value
        return { ...prev, [activeScreenTab]: { ...cur, [key]: next } }
      })
    }
  }
  const setMaximizedId = makeUiSetter("maximizedId")
  const setFocusedId = makeUiSetter("focusedId")
  const setDragPreview = makeUiSetter("dragPreview")
  const setDraggingId = makeUiSetter("draggingId")
  const setReplaceTarget = makeUiSetter("replaceTarget")

  const visiblePanels = useMemo(() => {
    if (!builderLayout) return []
    return [...builderLayout.panels]
      .filter((p) => p.visible && (p.screen ?? 0) === activeScreenTab && !HIDDEN_PANELS.has(p.id))
      .sort((a, b) => a.order - b.order)
  }, [builderLayout, activeScreenTab])

  const paneCountOn = (screen: number) =>
    builderLayout?.panels.filter((p) => p.visible && (p.screen ?? 0) === screen && !HIDDEN_PANELS.has(p.id)).length ?? 0
  const arrangement = builderLayout ? arrangementForScreen(builderLayout, activeScreenTab) : "free"
  // Screen 0's arrangement fields live at the top of WorkspaceLayout, 1+'s in screenLayouts[n] —
  // same split patchScreenArrangement writes to below.
  const columnCount = activeScreenTab === 0 ? (builderLayout?.columnCount ?? 3) : (builderLayout?.screenLayouts?.[activeScreenTab]?.columnCount ?? 3)
  const columnWidths = activeScreenTab === 0 ? (builderLayout?.columnWidths ?? []) : (builderLayout?.screenLayouts?.[activeScreenTab]?.columnWidths ?? [])
  const availablePanels = useMemo(() => catalog.data?.panels.filter((p) => p.available && !HIDDEN_PANELS.has(p.id)) ?? [], [catalog.data])
  const hasAudioOverview = useHasAudioOverview(caseId)
  const panelBadges = snapshot.data ? computePanelBadges(snapshot.data, t, { hasAudioOverview }) : {}
  const focusStackSummaries = snapshot.data ? computeFocusStackSummaries(snapshot.data, t) : {}
  const labelFor = (panel: PanelLayout | { id: PanelId }) =>
    PANEL_TITLES[panel.id] ?? catalog.data?.panels.find((p) => p.id === panel.id)?.label ?? panel.id

  const hidePanel = (id: PanelId) => {
    setMaximizedId((cur) => (cur === id ? null : cur))
    setBuilderLayout((prev) => {
      if (!prev) return prev
      const hidden = { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, visible: false } : p)) }
      return arrangementForScreen(prev, activeScreenTab) === "free" ? autoTileLayout(hidden, undefined, activeScreenTab) : hidden
    })
  }

  // Patches whichever screen's own arrangement fields are active — screen 0 lives on
  // builderLayout's top-level fields, 1+ on builderLayout.screenLayouts[screen], exactly like
  // arrangementForScreen already reads. The shared placement factory below only knows about
  // screen 0 (it's a straight lift of legal-terminal.tsx, which only ever has a screen 0), so the
  // builder needs its own screen-aware versions of these five instead of the factory's.
  const patchScreenArrangement = (patch: Partial<Pick<WorkspaceLayout, "arrangement" | "columnCount" | "columnWidths">>) => {
    setBuilderLayout((prev) => {
      if (!prev) return prev
      if (activeScreenTab === 0) return { ...prev, ...patch }
      return { ...prev, screenLayouts: { ...prev.screenLayouts, [activeScreenTab]: { ...prev.screenLayouts?.[activeScreenTab], ...patch } } }
    })
  }
  const setArrangement = (next: ArrangementValue) => {
    const curColumnCount = activeScreenTab === 0 ? builderLayout?.columnCount : builderLayout?.screenLayouts?.[activeScreenTab]?.columnCount
    patchScreenArrangement({ arrangement: next, columnCount: next === "columns" ? (curColumnCount ?? 3) : curColumnCount })
  }
  const setColumnCount = (count: number) => patchScreenArrangement({ columnCount: count })
  const setColumnWidths = (widths: number[]) => patchScreenArrangement({ columnWidths: widths })

  // Shared with legal-terminal.tsx — see lib/terminal/panel-placement.ts. Re-derived whenever the
  // active tab or the layout changes (each tab's placement math is scoped to that tab's own
  // panels/arrangement).
  const { dropPanelAtRect, patchPanel, requestAddPanel, beginPanelDrag, updateDragPreview, replacePaneInColumns, bringToFront } =
    useMemo(
      () =>
        createPanelPlacementActions({
          layout: builderLayout,
          setLayout: setBuilderLayout,
          arrangement,
          visiblePanels,
          stageRef,
          dragPreview: uiState.dragPreview,
          setDragPreview,
          setReplaceTarget,
          // A brand-new pane lands on whichever tab is open; a re-shown one keeps its own screen.
          resolveTargetScreen: (id) => builderLayout?.panels.find((p) => p.id === id)?.screen ?? activeScreenTab,
          onHide: hidePanel,
        }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [builderLayout, arrangement, visiblePanels, activeScreenTab, uiState.dragPreview],
    )

  const toggleMaximize = (id: PanelId) => {
    setMaximizedId((cur) => (cur === id ? null : id))
    bringToFront(id)
  }

  const onMoveToScreen = (id: PanelId, screen: number) => {
    if (screen === activeScreenTab) return
    setBuilderLayout((prev) => (prev ? moveToScreen(prev, id, screen) : prev))
  }

  const applyTemplate = (preset: ScreenPresetDef) => {
    setBuilderLayout((prev) => (prev ? applyScreenPreset(prev, preset) : prev))
    setScreenUiState({})
    setSelectedTemplateId(preset.id)
    // Only while the name is still untouched (blank) — once the lawyer has typed their own name,
    // switching templates shouldn't clobber it.
    setName((prev) => (prev.trim() ? prev : presetLabel(preset, t)))
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setLiveCount(null)
      setTabCount(1)
      setActiveScreenTab(0)
      setBuilderLayout(null)
      setScreenUiState({})
      setSelectedTemplateId(null)
      setName("")
    }
  }

  const detect = () => {
    if (!window.getScreenDetails) return
    setDetecting(true)
    const minDelay = new Promise((resolve) => setTimeout(resolve, 400))
    Promise.all([window.getScreenDetails(), minDelay])
      .then(([details]) => setLiveCount(1 + sortedSecondaryScreens(details).length))
      .finally(() => setDetecting(false))
  }

  const handleCreate = (alsoSaveAsWorkflow: boolean) => {
    if (!builderLayout) return
    const layoutJson = builderLayout
    createWorkspace.mutate(
      { caseId, name: name.trim() || t("untitledLayout"), layoutJson },
      {
        onSuccess: (workspace) => {
          onCreated(workspace, layoutJson)
          if (window.getScreenDetails) {
            window.getScreenDetails().then((details) => {
              const secondary = sortedSecondaryScreens(details)
              screenIndicesInUse(layoutJson.panels).forEach((screenIndex) => {
                if (screenIndex === 0 || canvasWindowsRef.current.has(screenIndex)) return
                const screen = secondary[screenIndex - 1]
                if (screen) openCanvasWindow(caseId, screenIndex, screen, canvasWindowsRef)
              })
            })
          }
          if (alsoSaveAsWorkflow) {
            const workflowName = name.trim() || t("untitledLayout")
            // mutateAsync, not mutate: this callback's own handlers are dropped once the modal closes below.
            createScreenPreset
              .mutateAsync({ name: workflowName, screens: captureCurrentScreens(layoutJson, tabCount) })
              .then(() => toast.success(t("workflowSaved", { name: workflowName })))
              .catch(() => toast.error(t("workflowSaveFailed")))
          }
          handleOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        overlayClassName="backdrop-blur-sm"
        className="flex h-[90vh] max-h-[90vh] w-[96vw] max-w-[96vw] flex-col gap-0 overflow-hidden p-0"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/60 py-4 pl-6 pr-12">
          <div>
            <DialogTitle asChild>
              <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("layoutBuilderTitle")}</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-1 text-xs text-muted-foreground">{t("layoutBuilderHint")}</p>
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
              {t("screensConnected", { count: screenCount })}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={detect}
                  aria-label={t("detectScreens")}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("detectScreens")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* relative here (not on the row below) so the sidebar's `absolute inset-y-0` spans down
            through the footer too, instead of stopping above it. */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {!builderLayout || !snapshot.data ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("loading")}</p>
        ) : (
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <TerminalSettingsSidebar
              expanded
              onExpandedChange={() => {}}
              isMobileOpen={false}
              onMobileOpenChange={() => {}}
              allPanels={availablePanels}
              visiblePanelIds={builderLayout.panels.filter((p) => p.visible).map((p) => p.id)}
              panelBadges={panelBadges}
              onAddPanel={requestAddPanel}
              onPanelDragStart={beginPanelDrag}
              onPanelDragEnd={() => setDragPreview(null)}
            />

            {/* TerminalSettingsSidebar is `absolute inset-y-0 left-0` (see its own doc comment),
                so this column needs the matching left offset reserved — same lg:pl-72 as
                legal-terminal.tsx uses for an always-expanded sidebar (no collapse toggle here). */}
            <div className="flex min-h-0 flex-1 flex-col lg:pl-72">
              <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-3 py-2">
                <div className="flex items-center gap-1">
                  {Array.from({ length: tabCount }, (_, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={uiState.draggingId !== null && i !== activeScreenTab}
                      onClick={() => setActiveScreenTab(i)}
                      aria-current={activeScreenTab === i ? "true" : undefined}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[1px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                        activeScreenTab === i ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      }`}
                    >
                      {activeScreenTab === i && <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />}
                      {t("builderDisplayLabel", { n: i + 1 })}
                      <span className="font-mono text-[10px] font-normal tracking-normal text-muted-foreground">{paneCountOn(i)}</span>
                    </button>
                  ))}
                </div>

                <div className="mx-2 flex min-w-0 flex-1 justify-center">
                  <div className="group relative w-full max-w-56">
                  <input
                    id="layout-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur()
                    }}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder={t("untitledLayout")}
                    aria-label={t("layoutNameLabel")}
                    className="h-8 w-full truncate rounded-md border border-transparent bg-transparent px-7 text-center text-xs font-medium text-foreground outline-none transition-colors placeholder:text-foreground/70 hover:border-border focus:border-brand-gold/60 focus:bg-background"
                  />
                  <Pencil
                    className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-0"
                    aria-hidden="true"
                  />
                  </div>
                </div>

                <ArrangementSwitcher arrangement={arrangement} onSetArrangement={setArrangement} columnCount={columnCount} onSetColumnCount={setColumnCount} t={t} />
              </div>

              <TerminalCanvas
                  caseId={caseId}
                  stageRef={stageRef}
                  snapshot={snapshot.data!}
                  visiblePanels={visiblePanels}
                  labelFor={labelFor}
                  panelBadges={panelBadges}
                  focusStackSummaries={focusStackSummaries}
                  panelLabels={panelLabels}
                  t={t}
                  arrangement={arrangement}
                  columnCount={columnCount}
                  columnWidths={columnWidths}
                  onSetColumnWidths={setColumnWidths}
                  onPatchPanel={patchPanel}
                  onHide={hidePanel}
                  onJumpToPanel={() => {}}
                  onBringToFront={bringToFront}
                  screenCount={tabCount}
                  onMoveToScreen={onMoveToScreen}
                  maximizedId={uiState.maximizedId}
                  onToggleMaximize={toggleMaximize}
                  focusedId={uiState.focusedId}
                  onFocus={setFocusedId}
                  dragPreview={uiState.dragPreview}
                  onDragPreviewChange={setDragPreview}
                  draggingId={uiState.draggingId}
                  onDraggingIdChange={setDraggingId}
                  onDropNew={requestAddPanel}
                  onDropAtRect={dropPanelAtRect}
                  onDragPreviewUpdate={updateDragPreview}
                >
                  {uiState.replaceTarget && (
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
                                      onClick={() => replacePaneInColumns(panel.id, uiState.replaceTarget!)}
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

            <div className="flex w-64 shrink-0 flex-col border-l border-border/70">
              <div className="px-3 pb-1 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[1px] text-foreground">{t("builderStartFrom")}</p>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t("builderStartFromHint")}</p>
              </div>
              <PresetList
                variant="detailed"
                autoSelectFirst={false}
                presets={templates}
                selectedId={selectedTemplateId}
                onSelect={(id) => {
                  const preset = templates.find((p) => p.id === id)
                  if (preset) applyTemplate(preset)
                }}
                onDelete={(id) => {
                  deleteScreenPreset.mutate(id)
                  if (selectedTemplateId === id) setSelectedTemplateId(null)
                }}
              />

            </div>
          </div>
        )}

        <div className="flex min-h-[72px] shrink-0 flex-wrap items-center justify-end gap-3 border-t border-border bg-muted/40 px-6 py-2 lg:h-[72px] lg:flex-nowrap lg:pl-[calc(18rem+1.5rem)]">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleCreate(true)}
                disabled={createWorkspace.isPending}
                className="h-9 shrink-0 rounded-full border border-border px-4 text-[11px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t("createAndSaveWorkflow")}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-60">{t("saveAsWorkflowHint")}</TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={() => handleCreate(false)}
            disabled={createWorkspace.isPending}
            className="shrink-0 bg-brand-gold text-brand-gold-foreground text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand-gold"
          >
            {t("createLayout")}
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
