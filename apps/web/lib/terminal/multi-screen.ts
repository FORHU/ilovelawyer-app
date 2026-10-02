import { HIDDEN_PANELS, type PaneRect } from "@/components/terminal/terminal-canvas"
import type { ArrangementValue, CaseSnapshot, FindingCategory, PanelId, PanelLayout, WorkspaceLayout } from "@/lib/terminal/types"
import { damagesBadge } from "@/lib/terminal/damages-format"

// Up to 5 secondary screens (1-5) plus the primary (0) — see the plan's data model doc comment
// on PanelLayout.screen.
export const MAX_SECONDARY_SCREENS = 5

// Secondary screens only, left-to-right by physical position, numbered fresh on every call —
// screens have no durable cross-session identity, so this is never persisted or cached.
export function sortedSecondaryScreens(details: { screens: ScreenDetailed[] }): ScreenDetailed[] {
  return details.screens
    .filter((s) => !s.isPrimary)
    .sort((a, b) => a.left - b.left)
    .slice(0, MAX_SECONDARY_SCREENS)
}

// 0 (primary) -> 1 -> 2 -> ... -> N (secondaryCount) -> 0. With no secondary screens detected,
// stays at primary (nothing to cycle to).
export function nextScreenIndex(current: number, secondaryCount: number): number {
  if (secondaryCount <= 0) return 0
  const cur = current || 0
  return cur >= secondaryCount ? 0 : cur + 1
}

// How many panels are currently assigned to (visible or not — a hidden pane still "belongs" to
// its screen) a given secondary screen index. Screen 0 covers both 0 and undefined.
export function panelCountOnScreen(panels: PanelLayout[], screenIndex: number): number {
  return panels.filter((p) => (p.screen ?? 0) === screenIndex).length
}

// window.open geometry string for a canvas window positioned/sized to fill one physical screen.
export function canvasWindowFeatures(screen: ScreenDetailed): string {
  return `left=${screen.left},top=${screen.top},width=${screen.width},height=${screen.height}`
}

// Named per case+screen (not per-open-call) so re-clicking round-robin, or a reopen after reload,
// focuses the same OS window instead of piling up duplicates — same pattern as popOutPanel's
// named single-panel pop-outs.
export function canvasWindowName(caseId: string, screenIndex: number): string {
  return `terminal-canvas-${caseId}-${screenIndex}`
}

export function canvasWindowUrl(caseId: string, screenIndex: number): string {
  return `/homepage/terminal/${caseId}/canvas/${screenIndex}`
}

// Opens (or focuses, via the shared window name) a canvas window positioned on `screen`, and
// tracks it in `canvasWindowsRef` if the open succeeded (popup blocked -> null, left untracked).
export function openCanvasWindow(
  caseId: string,
  screenIndex: number,
  screen: ScreenDetailed,
  canvasWindowsRef: React.RefObject<Map<number, Window>>,
): Window | null {
  const win = window.open(canvasWindowUrl(caseId, screenIndex), canvasWindowName(caseId, screenIndex), canvasWindowFeatures(screen))
  if (win) canvasWindowsRef.current.set(screenIndex, win)
  return win
}

// Shared fallback mechanics for a closed canvas window — one place both the 500ms poll
// (useCanvasWindowReaper) and the BroadcastChannel handler (useLayoutSyncChannel) call, so a
// screen's panels fall back to primary identically whether the closure was noticed via poll or via
// an instant cross-window broadcast.
export function applyScreenClosedFallback(layout: WorkspaceLayout, screenIndex: number): WorkspaceLayout {
  return { ...layout, panels: layout.panels.map((p) => ((p.screen ?? 0) === screenIndex ? { ...p, screen: undefined } : p)) }
}

// Every distinct secondary screen index actually referenced by `panels`, ascending.
export function screenIndicesInUse(panels: PanelLayout[]): number[] {
  const set = new Set<number>()
  for (const p of panels) {
    const s = p.screen ?? 0
    if (s > 0) set.add(s)
  }
  return Array.from(set).sort((a, b) => a - b)
}

// Used by the round-robin click handler's auto-close check: does `screenIndex` still have any
// panel assigned to it after this move?
export function screenIsEmpty(panels: PanelLayout[], screenIndex: number): boolean {
  return panelCountOnScreen(panels, screenIndex) === 0
}

// Screen 0's arrangement lives in the top-level fields (unchanged since before multi-screen
// existed); every secondary screen's lives in screenLayouts, defaulting to "free" until that
// screen has ever had its own arrangement set. Used by usePopOutToNextScreen to decide whether the
// screen a panel is leaving/arriving at needs an autoTileLayout pass.
export function arrangementForScreen(layout: WorkspaceLayout, screen: number): ArrangementValue {
  if (screen === 0) return layout.arrangement ?? "free"
  return layout.screenLayouts?.[screen]?.arrangement ?? "free"
}

// Real, non-fabricated per-pane status text for the Pane Library rows ("3 docs", "2 found",
// "Ready" — never an invented figure; a pane with nothing to report simply has no entry, which
// the library renders as an em dash, same spirit as ADR 0013's stance against fabricated stat
// chips). Computed for every catalog panel, not just hidden ones, so a pane already on the grid
// still shows its status in the library list. Shared by legal-terminal.tsx (memoized there) and
// every canvas window (no memoization needed there, one snapshot per render).
export function computePanelBadges(data: CaseSnapshot, t: (key: string, opts?: Record<string, unknown>) => string): Partial<Record<PanelId, string>> {
  const found = (n: number) => (n > 0 ? t("badgeFound", { count: n }) : undefined)
  const byCategory = (category: FindingCategory) => found(data.findings.filter((f) => f.category === category).length)
  const badges: Partial<Record<PanelId, string>> = {
    command: data.case.parties.length > 0 ? t("badgeParties", { count: data.case.parties.length }) : undefined,
    evidence: data.documents.length > 0 ? t("badgeDocs", { count: data.documents.length }) : undefined,
    law: data.law.citations.length > 0 ? t("badgeCited", { count: data.law.citations.length }) : undefined,
    // The case's document-built map when it has a live one (what the panel shows), else the
    // chat-generated map the panel falls back to.
    mindMap:
      data.caseMindMap && !data.caseMindMap.retired
        ? data.caseMindMap.isStale ? t("badgeStale") : t("badgeReady")
        : data.mindMap.lastGeneratedAt ? (data.mindMap.isStale ? t("badgeStale") : t("badgeReady")) : undefined,
    redTeam: data.redTeamAssessment ? t("badgeReady") : undefined,
    procedure: (() => {
      const open = data.procedure.items.filter((i) => !i.done).length
      return open > 0 ? t("badgeToDos", { count: open }) : undefined
    })(),
    legalIssues: byCategory("LEGAL_ISSUE"),
    weaknesses: byCategory("WEAKNESS"),
    strengths: byCategory("STRENGTH"),
    attackStrategy: byCategory("ATTACK_STRATEGY"),
    defenseStrategy: byCategory("DEFENSE_STRATEGY"),
    witnesses: data.witnesses.length > 0 ? t("badgeWitnesses", { count: data.witnesses.length }) : undefined,
    // Headline count only — legal-terminal.tsx's own panelBadges layers live busy/fresh activity
    // (from useDamagesActivity) on top of this for the primary window; a canvas window has no
    // such context, so it always shows this plain headline instead. `damagesSummary` is typed as
    // always present, but a snapshot from before this case's damages computation last ran can
    // still come back without it — guard rather than crash the whole badge computation over one
    // missing field.
    damages: damagesBadge(data.damagesSummary, t),
    caseReconstruction: data.reconstruction ? t("badgeReady") : undefined,
    audioOverview: data.reconstruction?.audioFileId ? t("badgeReady") : undefined,
    decisions: data.decisions.length > 0 ? t("badgeDecisions", { count: data.decisions.length }) : undefined,
    theories: data.theories.length > 0 ? t("badgeTheories", { count: data.theories.length }) : undefined,
  }
  return badges
}

// Richer, still real-data-only summaries for Focus mode's stack cards — composites of 2-3 facts
// per pane (vs computePanelBadges' single metric), for the handful of pane types the redesign
// mock shows worked examples for. Every other pane type falls back to its plain computePanelBadges
// entry in FocusArrangement, rather than inventing a composite the mock never specified. Not
// memoized by callers that read Date.now() (relative "updated Xm ago" text) — recomputing on
// every render is fine for something this cheap, and keeps it honestly "live" instead of caching
// a timestamp that goes stale.
export function computeFocusStackSummaries(data: CaseSnapshot, t: (key: string, opts?: Record<string, unknown>) => string): Partial<Record<PanelId, string>> {
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

  // Same choice as the badge above: the live case map first, else the chat map.
  const shownMap =
    data.caseMindMap && !data.caseMindMap.retired
      ? { isStale: data.caseMindMap.isStale, updatedAt: data.caseMindMap.generatedAt }
      : data.mindMap.lastGeneratedAt
        ? { isStale: data.mindMap.isStale, updatedAt: data.mindMap.lastGeneratedAt }
        : null
  if (shownMap) {
    const parts = [shownMap.isStale ? t("badgeStale") : t("badgeReady"), relativeUpdate(shownMap.updatedAt)].filter(
      (part): part is string => Boolean(part),
    )
    summaries.mindMap = parts.join(" · ")
  }

  // No structured "threat count"/"weak point" exists on RedTeamAssessment (content is free
  // text) — "Ready · updated ..." is the honest equivalent instead of guessing a figure out of
  // prose, same anti-fabrication stance as computePanelBadges above.
  if (data.redTeamAssessment) {
    const parts = [t("badgeReady"), relativeUpdate(data.redTeamAssessment.updatedAt)].filter((part): part is string => Boolean(part))
    summaries.redTeam = parts.join(" · ")
  }

  return summaries
}

// Free canvas auto-tiling, so the board is always filled: 1 pane = whole canvas, 2 = side by
// side, 3-4 = a 2-column grid, 5+ = 3 columns. A short last row stretches its panes to the full
// width (3 panes = two on top, one full-width below) rather than leaving an empty cell. Panes
// keep their current reading order (top-to-bottom, left-to-right) so re-tiling doesn't shuffle
// what the user already arranged; `newestId` goes last. If any pane is pinned the layout is
// returned untouched — pinning protects that pane's own slot, which tiling would move. Shared by
// legal-terminal.tsx's hidePanel and every canvas window's hidePanel, so a Free-arrangement
// screen always re-tiles the same way regardless of which window it renders in. `screen` scopes
// tiling to one screen's own panels (0/undefined = primary) — each screen has its own independent
// Free canvas, so retiling one must never move panes that live on a different screen.
export function autoTileLayout(layout: WorkspaceLayout, newestId?: PanelId, screen?: number): WorkspaceLayout {
  const visible = layout.panels.filter(
    (panel) => panel.visible && !HIDDEN_PANELS.has(panel.id) && (panel.screen ?? 0) === (screen ?? 0),
  )
  if (visible.length === 0 || visible.some((panel) => panel.pinned)) return layout

  const readingKey = (panel: PanelLayout): [number, number] =>
    Number.isFinite(panel.x) && Number.isFinite(panel.y)
      ? [Math.round((panel.y as number) * 10), panel.x as number]
      : [Number.POSITIVE_INFINITY, panel.order]
  const ordered = [...visible].sort((a, b) => {
    if (a.id === newestId) return 1
    if (b.id === newestId) return -1
    const [rowA, colA] = readingKey(a)
    const [rowB, colB] = readingKey(b)
    return rowA - rowB || colA - colB
  })

  const count = ordered.length
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3
  const rows = Math.ceil(count / cols)
  const height = 1 / rows
  const rects = new Map<PanelId, PaneRect>()
  ordered.forEach((panel, index) => {
    const row = Math.floor(index / cols)
    const inRow = row === rows - 1 ? count - row * cols : cols
    const width = 1 / inRow
    rects.set(panel.id, { x: (index - row * cols) * width, y: row * height, width, height })
  })

  return {
    ...layout,
    panels: layout.panels.map((panel) => {
      const rect = rects.get(panel.id)
      return rect ? { ...panel, ...rect } : panel
    }),
  }
}
