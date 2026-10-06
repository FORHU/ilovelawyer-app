"use client"

import { useHasAudioOverview } from "@/lib/chat/use-audio-overview"
import { useEffect, useMemo, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { AlertCircle, Loader2 } from "lucide-react"
import {
  useCaseSnapshotQuery,
  useTerminalCatalogQuery,
  useTerminalWorkspacesQuery,
  useUpdateWorkspaceMutation,
} from "@/lib/terminal/mutations"
import type { ArrangementValue, PanelId, PanelLayout, WorkspaceLayout } from "@/lib/terminal/types"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { TerminalCanvas, HIDDEN_PANELS, type PaneDragPreview, type PaneRect } from "@/components/terminal/terminal-canvas"
import { PaneActivityContext, useDamagesActivity } from "@/components/terminal/pane-activity"
import { TerminalDisplayProvider } from "@/components/terminal/terminal-display-provider"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import { hidePanelInLayout, computeFocusStackSummaries, computePanelBadges } from "@/lib/terminal/multi-screen"
import { damagesBadge } from "@/lib/terminal/damages-format"
import { dropUnknownPanels } from "@/lib/terminal/drop-unknown-panels"
import { useCanvasWindowReaper, useIsExtendedScreen, usePopOutToNextScreen } from "@/lib/terminal/use-multi-screen-windows"
import { announceWindowClosing, useLayoutSyncChannel } from "@/lib/terminal/layout-sync-channel"
import { ArrangementSwitcher } from "@/components/terminal/arrangement-switcher"
import { apiFetch } from "@/lib/fetch"

// Pop-out target for one secondary physical screen (see legal-terminal.tsx's pop-out action and
// the reopen banner) — a minimal, chrome-less page: no PageShell/GlobalHeader/sidebar, its own
// useCaseSnapshotQuery/useTerminalWorkspacesQuery calls, no cross-window JS state sharing — every
// window independently queries/mutates the same persisted layoutJson. Filters panels to
// `p.screen === screenIndex` and reads/writes this screen's own arrangement from
// layoutJson.screenLayouts[screenIndex] — every other screen (including the primary window's
// screen 0) runs its own independent arrangement, not one shared grid.
export default function TerminalCanvasWindowPage() {
  const { t } = useTranslation("terminal")
  const params = useParams<{ caseId: string; screenIndex: string }>()
  const caseId = params.caseId
  const screenIndex = Number(params.screenIndex) || 0

  const catalog = useTerminalCatalogQuery()
  const workspaces = useTerminalWorkspacesQuery(caseId)
  const snapshot = useCaseSnapshotQuery(caseId)
  const updateWorkspace = useUpdateWorkspaceMutation()
  const panelLabels = useTerminalDisplayStore((state) => state.panelLabels)

  const [workspaceId, setWorkspaceId] = useState("")
  const [layout, setLayout] = useState<WorkspaceLayout | null>(null)
  const lastSavedLayoutRef = useRef("")
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingSaveRef = useRef<{ workspaceId: string; layoutJson: WorkspaceLayout } | null>(null)

  // Ephemeral per-window UI state — never persisted, never shared with the primary window or
  // any other canvas window (mirrors legal-terminal.tsx's own local state for the same fields).
  const [maximizedId, setMaximizedId] = useState<PanelId | null>(null)
  const [focusedId, setFocusedId] = useState<PanelId | null>(null)
  const [dragPreview, setDragPreview] = useState<PaneDragPreview | null>(null)
  const [draggingId, setDraggingId] = useState<PanelId | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  // This screen can pop out a panel onward to a further screen too — same ref/poll pattern as
  // legal-terminal.tsx's canvasWindowsRef, scoped to windows THIS tab opened.
  const canvasWindowsRef = useRef<Map<number, Window>>(new Map())
  const isExtendedScreen = useIsExtendedScreen()

  // Flipped by a "terminal-closing" broadcast — see useLayoutSyncChannel's closeOnTerminalClosing.
  const unloadingRef = useRef(false)
  useCanvasWindowReaper(canvasWindowsRef, setLayout, unloadingRef)

  // Instant cross-window layout sync + close notifications, additive to the poll above — see
  // lib/terminal/layout-sync-channel.ts.
  const { broadcastLayout } = useLayoutSyncChannel({
    caseId,
    workspaceId,
    layout,
    setLayout,
    lastSavedLayoutRef,
    canvasWindowsRef,
    setWorkspaceId,
    unloadingRef,
    closeOnTerminalClosing: true,
  })

  // This window closing is itself the signal the primary window (or any other window) needs to
  // instantly fall this screen's panels back to primary, rather than waiting on its own poll.
  // Also flushes whatever save is still outstanding with `keepalive` so it survives — a normal
  // (non-keepalive) fetch is cancelled by the window closing, same gap legal-terminal.tsx's own
  // autosave had. This mattered more than it looked: when the primary closes and force-closes
  // this window too, whichever of the two windows' saves was going to be the authoritative "last
  // write" (both PATCH the same workspace row independently) needs to actually survive its own
  // window's closure, or the persisted layout silently reverts to an older state.
  useEffect(() => {
    const onHide = () => {
      // Closing a canvas also closes every canvas it opened further out (screen N -> N+1 ...), so
      // no window outlives its opener. The primary falls their panels back to screen 0 via the
      // children's own "screen-closing" broadcasts.
      unloadingRef.current = true
      for (const win of canvasWindowsRef.current.values()) win.close()
      canvasWindowsRef.current.clear()
      announceWindowClosing(caseId, { type: "screen-closing", screenIndex })
      const pending = pendingSaveRef.current
      if (!pending) return
      pendingSaveRef.current = null
      apiFetch(`/api/terminal/workspaces/${pending.workspaceId}`, {
        method: "PATCH",
        keepalive: true,
        body: JSON.stringify({ preset: pending.layoutJson.preset, layoutJson: pending.layoutJson }),
      }).catch(() => {})
    }
    window.addEventListener("pagehide", onHide)
    return () => window.removeEventListener("pagehide", onHide)
  }, [caseId, screenIndex])

  // Load the same "last used" workspace the primary window shows — this window renders whatever
  // subset of ITS panels carry this screen's index, nothing more.
  useEffect(() => {
    if (layout || !workspaces.data) return
    const lastUsed = workspaces.data.find((w) => w.isLastUsed)
    if (!lastUsed) return
    // Same as the primary window: a layout saved before ADR 0016 may list retired panes, which would crash PaneCode.
    const cleaned = dropUnknownPanels(lastUsed.layoutJson)
    lastSavedLayoutRef.current = JSON.stringify(cleaned)
    setLayout(cleaned)
    setWorkspaceId(lastUsed.id)
  }, [workspaces.data, layout])

  // Same 1.2s debounce as legal-terminal.tsx's autosave, writing to the same workspace row —
  // both windows independently PATCH the same layoutJson; last write wins, no merge.
  useEffect(() => {
    if (!layout || !workspaceId) return
    const serialized = JSON.stringify(layout)
    if (serialized === lastSavedLayoutRef.current) {
      // Equal to what's saved (or just adopted from another window): nothing is pending, and an
      // older pending copy must not be flushed on pagehide over the newer state.
      pendingSaveRef.current = null
      return
    }

    // Broadcast immediately, not gated behind the debounce below — that debounce exists only to
    // reduce backend PATCH traffic, but every other open window should reflect a change right
    // away. Guarded by the lastSavedLayoutRef comparison above, so adopting a REMOTE broadcast
    // (which sets lastSavedLayoutRef before setLayout) never bounces straight back out as a new
    // one.
    broadcastLayout(layout)

    pendingSaveRef.current = { workspaceId, layoutJson: layout }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      const pending = pendingSaveRef.current
      if (!pending) return
      // NOT cleared here — see the pagehide handler above: a normal fetch dies if this window
      // closes while it's still in flight, so `pending` stays put until the save confirms.
      updateWorkspace.mutate(
        { id: pending.workspaceId, preset: pending.layoutJson.preset, layoutJson: pending.layoutJson },
        {
          onSuccess: () => {
            lastSavedLayoutRef.current = JSON.stringify(pending.layoutJson)
            if (pendingSaveRef.current === pending) pendingSaveRef.current = null
          },
        },
      )
    }, 1200)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [layout, workspaceId, updateWorkspace, broadcastLayout])

  const visiblePanels = useMemo(() => {
    if (!layout) return []
    return layout.panels
      .filter((p) => (p.screen ?? 0) === screenIndex && p.visible && !HIDDEN_PANELS.has(p.id))
      .sort((a, b) => a.order - b.order)
  }, [layout, screenIndex])

  const labelFor = (panel: PanelLayout | { id: PanelId }) =>
    PANEL_TITLES[panel.id] ?? catalog.data?.panels.find((p) => p.id === panel.id)?.label ?? panel.id

  const screenSettings = layout?.screenLayouts?.[screenIndex]
  const arrangement: ArrangementValue = screenSettings?.arrangement ?? "free"

  const patchScreenSettings = (patch: Partial<NonNullable<WorkspaceLayout["screenLayouts"]>[number]>) => {
    setLayout((prev) => {
      if (!prev) return prev
      const current = prev.screenLayouts?.[screenIndex] ?? {}
      return { ...prev, screenLayouts: { ...prev.screenLayouts, [screenIndex]: { ...current, ...patch } } }
    })
  }

  // Same shared computation as legal-terminal.tsx's own panelBadges/focusStackSummaries — a
  // panel's badge and Focus-stack summary must read identically whether it renders here or in
  // the primary window. Not memoized: this window's snapshot query already gives a stable
  // reference, and focusStackSummaries reads Date.now() so caching it would go stale anyway.
  // Same PaneActivityContext setup as legal-terminal.tsx, so a popped-out damages panel keeps its
  // live busy/fresh indicator here too — each window is its own React tree (a separate browser
  // window), so the primary's Provider doesn't reach this one; it needs its own.
  const damagesPaneVisible = layout?.panels.some((p) => p.id === "damages" && p.visible) ?? false
  const damagesActivity = useDamagesActivity(caseId, snapshot.data, snapshot.dataUpdatedAt, damagesPaneVisible)
  const paneActivity = useMemo(
    (): Partial<Record<PanelId, "busy" | "fresh">> => (damagesActivity ? { damages: damagesActivity } : {}),
    [damagesActivity],
  )

  const hasAudioOverview = useHasAudioOverview(caseId)
  const panelBadges = useMemo((): Partial<Record<PanelId, string>> => {
    const data = snapshot.data
    if (!data) return {}
    const base = computePanelBadges(data, t, { hasAudioOverview })
    return {
      ...base,
      // damagesSummary is typed as always present, but a snapshot from before this case's
      // damages computation last ran can still come back without it.
      damages:
        damagesActivity === "busy"
          ? t("badgeUpdating")
          : damagesActivity === "fresh"
            ? t("badgeNew")
            : damagesBadge(data.damagesSummary, t),
    }
  }, [snapshot.data, t, damagesActivity, hasAudioOverview])
  const focusStackSummaries = snapshot.data ? computeFocusStackSummaries(snapshot.data, t) : {}

  // Mirrors legal-terminal.tsx's setArrangement: Columns must always save an explicit
  // columnCount, since asLayout treats a columnCount-less "columns" save as a pre-rework legacy
  // Free layout.
  const setArrangement = (next: ArrangementValue) => {
    patchScreenSettings({ arrangement: next, columnCount: next === "columns" ? (screenSettings?.columnCount ?? 3) : screenSettings?.columnCount })
  }
  const setColumnCount = (count: number) => patchScreenSettings({ columnCount: count })

  const patchPanel = (id: PanelId, patch: Partial<PanelLayout>) => {
    setLayout((prev) => (prev ? { ...prev, panels: prev.panels.map((p) => (p.id === id ? { ...p, ...patch } : p)) } : prev))
  }

  const bringToFront = (panelId: PanelId) => {
    setLayout((prev) => {
      if (!prev) return prev
      const onScreen = prev.panels.filter((p) => p.visible && (p.screen ?? 0) === screenIndex)
      const maxOrder = Math.max(0, ...onScreen.map((p) => p.order))
      const current = prev.panels.find((p) => p.id === panelId)
      if (!current || current.order >= maxOrder) return prev
      return { ...prev, panels: prev.panels.map((p) => (p.id === panelId ? { ...p, order: maxOrder + 1 } : p)) }
    })
  }

  const hidePanel = (id: PanelId) => {
    setMaximizedId((cur) => (cur === id ? null : cur))
    setLayout((prev) => (prev ? hidePanelInLayout(prev, id) : prev))
  }

  const toggleMaximize = (id: PanelId) => {
    setMaximizedId((cur) => (cur === id ? null : id))
    bringToFront(id)
  }

  // A panel this screen doesn't hold can't be "jumped to" without cross-window state sharing
  // (an explicit non-goal) — this only ever resolves for panels already assigned to this screen.
  const jumpToPanel = (id: PanelId) => {
    const isHere = visiblePanels.some((p) => p.id === id)
    if (!isHere) return
    bringToFront(id)
    setMaximizedId(null)
    setFocusedId(id)
  }

  // Pop-out, shared with legal-terminal.tsx — ownScreenIndex is THIS window's own screen index,
  // which is what lets the hook close this window itself when its own last panel pops out onward
  // (see usePopOutToNextScreen's doc comment). A pane already on this screen can still send itself
  // onward to a further screen.
  const sendToNextScreen = usePopOutToNextScreen({ caseId, ownScreenIndex: screenIndex, layout, setLayout, canvasWindowsRef })
  const popOutPanel = isExtendedScreen ? sendToNextScreen : undefined

  // No Panel Library / sidebar in a canvas window — panels only ever arrive here via pop-out from
  // the primary window, never by dragging a new one in, so both drop paths are no-ops.
  const dropNoop: (id: PanelId) => void = () => {}
  const dropAtRectNoop: (id: PanelId, rect: PaneRect, sourceRect: DOMRect) => void = () => {}

  if (workspaces.isLoading || snapshot.isLoading || catalog.isLoading || (!layout && !workspaces.isError)) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-['Inter'] text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      </div>
    )
  }

  if (snapshot.isError || workspaces.isError || catalog.isError || !snapshot.data || !layout) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background font-['Inter'] text-sm">
        <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
        <p className="text-destructive">{t("loadError")}</p>
        <button type="button" onClick={() => snapshot.refetch()} className="text-xs font-semibold uppercase tracking-wider text-brand-gold hover:underline">
          {t("retry")}
        </button>
      </div>
    )
  }

  return (
    <PaneActivityContext.Provider value={paneActivity}>
    <TerminalDisplayProvider>
      <div className="flex h-screen min-h-0 flex-col bg-background font-['Inter'] text-foreground">
        {/* Minimal chrome for this screen's own window — just the arrangement switcher, writing
            to this screen's own screenLayouts entry, independent of the primary window's mode
            and every other canvas window's. */}
        <div className="flex h-12 shrink-0 items-center justify-end gap-3 border-b border-border bg-card px-4">
          <ArrangementSwitcher
            arrangement={arrangement}
            onSetArrangement={setArrangement}
            columnCount={screenSettings?.columnCount ?? 3}
            onSetColumnCount={setColumnCount}
            t={t}
          />
        </div>
        <TerminalCanvas
          caseId={caseId}
          stageRef={stageRef}
          snapshot={snapshot.data}
          visiblePanels={visiblePanels}
          labelFor={labelFor}
          panelBadges={panelBadges}
          focusStackSummaries={focusStackSummaries}
          panelLabels={panelLabels}
          t={t}
          arrangement={arrangement}
          columnCount={screenSettings?.columnCount ?? 3}
          columnWidths={screenSettings?.columnWidths ?? []}
          onSetColumnWidths={(widths) => patchScreenSettings({ columnWidths: widths })}
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
          onDropNew={dropNoop}
          onDropAtRect={dropAtRectNoop}
        />
      </div>
    </TerminalDisplayProvider>
    </PaneActivityContext.Provider>
  )
}
