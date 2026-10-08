import type { ConfidenceLevel, FindingCategory, FindingTag, OutlookBand, PanelId } from "./types"

// What one analysis refresh changed, pane by pane — the snapshot's `latestChangeSummary`. Mirrors
// ilovelawyer-api's types/case-change.ts (CaseChangeSummary row + CaseChangeDeltas); change both
// together.

export type PaneStatus = "changed" | "unchanged" | "skipped" | "failed"
export interface PaneNotRun {
  status: "skipped" | "failed"
}

export interface ContradictionRef {
  kind: string
  factKey: string
  leftValue: string
  rightValue: string
  leftDocument: string | null
  rightDocument: string | null
}
export interface ContradictionsDelta {
  status: PaneStatus
  added: ContradictionRef[]
  addedCount: number
  dropped: ContradictionRef[]
  droppedCount: number
  carriedOver: number
  droppedTriaged: number
}

export interface FindingRating {
  tag: FindingTag | null
  impact: number | null
}
export interface FindingCategoryDelta {
  added: string[]
  removed: string[]
  rerated: { label: string; from: FindingRating; to: FindingRating }[]
}
export interface FindingsDelta {
  status: PaneStatus
  byCategory: Partial<Record<FindingCategory, FindingCategoryDelta>>
  /** The one category a panel's own Regenerate rewrote. */
  category?: FindingCategory
}

export type RedTeamStrength = "STRONG" | "MODERATE" | "WEAK"
export interface RedTeamDelta {
  status: PaneStatus
  first: boolean
  riskOfLoss: { from: number | null; to: number | null }
  added: string[]
  dropped: string[]
  restrengthened: { title: string; from: RedTeamStrength; to: RedTeamStrength }[]
}

export interface ReconstructionDelta {
  status: PaneStatus
  outcome: "generated" | "regenerated" | "skipped-edited" | null
  gapsOpened: string[]
  gapsClosed: string[]
}

export interface OutlookDelta {
  status: PaneStatus
  first: boolean
  band: { from: OutlookBand | null; to: OutlookBand | null }
  confidence: { from: ConfidenceLevel | null; to: ConfidenceLevel | null }
  driversAdded: { label: string; direction: "HELPS" | "HURTS" }[]
  driversDropped: { label: string; direction: "HELPS" | "HURTS" }[]
}

/** Case Strategy's plan and to-dos, and the key dates the same step writes onto the timeline. */
export interface StrategyDelta {
  status: PaneStatus
  planAdded: string[]
  planRemoved: string[]
  todosAdded: string[]
  todosRemoved: string[]
  datesAdded: { title: string; occurredOn: string | null }[]
  datesRemoved: { title: string; occurredOn: string | null }[]
}

export interface WitnessesDelta {
  status: PaneStatus
  added: string[]
  removed: string[]
  rescored: { name: string; from: number; to: number }[]
}

export interface DamagesDelta {
  status: PaneStatus
  added: string[]
  removed: string[]
  amountChanged: { title: string; from: number | null; to: number | null }[]
}

export interface TheoryDelta {
  status: PaneStatus
  first: boolean
  title: { from: string | null; to: string | null }
  claimsAdded: string[]
  claimsDropped: string[]
  assumptionsChanged: number
  openQuestionsChanged: number
}

export interface MindMapDelta {
  status: PaneStatus
  /** No map before this run: `branchesAdded` lists every branch it built. Absent on older rows. */
  first?: boolean
  branchesAdded: string[]
  branchesRemoved: string[]
  pointsAdded: number
  pointsRemoved: number
  keptUserChanges: boolean
}

export interface AudioOverviewDelta {
  status: PaneStatus
  overviewId: string | null
}

export interface CaseChangeDeltas {
  contradictions?: ContradictionsDelta | PaneNotRun
  findings?: FindingsDelta | PaneNotRun
  redTeam?: RedTeamDelta | PaneNotRun
  reconstruction?: ReconstructionDelta | PaneNotRun
  outlook?: OutlookDelta | PaneNotRun
  strategy?: StrategyDelta | PaneNotRun
  witnesses?: WitnessesDelta | PaneNotRun
  damages?: DamagesDelta | PaneNotRun
  theory?: TheoryDelta | PaneNotRun
  mindMap?: MindMapDelta | PaneNotRun
  audioOverview?: AudioOverviewDelta | PaneNotRun
}

export interface CaseChangeSummary {
  id: string
  caseId: string
  /** "regenerate": one pane's own Regenerate — `perPaneDeltas` holds that pane alone and the
   * document lists are empty. */
  reason: "manual" | "post-extraction" | "regenerate"
  documentsAdded: { id: string; name: string | null }[]
  documentsRemoved: { id: string; name: string | null }[]
  totalChanges: number
  /** The case's first analysis — nothing to compare with. Absent on rows from before the flag. */
  firstAnalysis?: boolean
  perPaneDeltas: CaseChangeDeltas
  createdAt: string
}

/** Smallest Red Team risk-of-loss move worth a line — mirrors the API's
 * CASE_CHANGE_RISK_OF_LOSS_THRESHOLD, which decides whether it counts. */
const RISK_OF_LOSS_THRESHOLD = 5

/** One part of a pane's line: a `terminal` translation key and its values. */
export interface ChangePart {
  key: string
  values?: Record<string, string | number>
}

/** One line of the modal: the pane it's about (its "Open" link) and what changed there. */
export interface ChangeLine {
  pane: PanelId
  parts: ChangePart[]
  /** The pane wasn't updated this time — shown in amber, never counted. */
  notUpdated?: boolean
}

const FINDING_PANES: [FindingCategory, PanelId][] = [
  ["LEGAL_ISSUE", "legalIssues"],
  ["STRENGTH", "strengths"],
  ["WEAKNESS", "weaknesses"],
  ["ATTACK_STRATEGY", "attackStrategy"],
  ["DEFENSE_STRATEGY", "defenseStrategy"],
]

const ran = <T extends { status: PaneStatus }>(delta: T | PaneNotRun | undefined): delta is T =>
  !!delta && (delta.status === "changed" || delta.status === "unchanged")

const count = (key: string, n: number): ChangePart[] => (n > 0 ? [{ key, values: { count: n } }] : [])

/** One item is named (`namedKey`, its text as `value`); more are counted (`countKey`). */
const nameOrCount = (namedKey: string, countKey: string, items: string[], value = "label"): ChangePart[] => {
  const [only] = items
  return items.length === 1 && only !== undefined ? [{ key: namedKey, values: { [value]: only } }] : count(countKey, items.length)
}

/**
 * The modal's lines, in Terminal order: the outlook (Case Summary), Evidence & Timeline
 * (contradictions, then key dates), Case Strategy, Witnesses, Damages & Remedies, the five findings
 * panes, Red Team, Theories, Case Reconstruction, the Visual Strategy Map, the Audio Overview. A pane
 * with nothing to say is left out; one whose step failed says it wasn't updated, and a narrative or
 * map left alone because a lawyer changed it says so.
 */
export function describeChangeLines(deltas: CaseChangeDeltas): ChangeLine[] {
  const lines: ChangeLine[] = []
  const { outlook, contradictions, findings, redTeam, reconstruction, strategy, witnesses, damages, theory, mindMap, audioOverview } = deltas
  const notUpdated = (pane: PanelId, delta: { status: PaneStatus } | undefined) => {
    if (delta?.status === "failed") lines.push({ pane, parts: [{ key: "changeNotUpdated" }], notUpdated: true })
  }

  if (ran(outlook) && outlook.first) {
    // A first outlook: what it says, not what moved.
    const parts: ChangePart[] = outlook.band.to ? [{ key: "changeOutlookFirst", values: { band: outlook.band.to } }] : []
    parts.push(...count("changeDriversFirst", outlook.driversAdded.length))
    if (parts.length) lines.push({ pane: "command", parts })
  } else if (ran(outlook)) {
    const parts: ChangePart[] = []
    if (outlook.band.from && outlook.band.to && outlook.band.from !== outlook.band.to) {
      parts.push({ key: "changeOutlookBand", values: { from: outlook.band.from, to: outlook.band.to } })
    }
    parts.push(...count("changeDriversAdded", outlook.driversAdded.length), ...count("changeDriversDropped", outlook.driversDropped.length))
    if (parts.length) lines.push({ pane: "command", parts })
  } else notUpdated("command", outlook)

  if (ran(contradictions)) {
    const parts = [
      ...count("changeContradictionsAdded", contradictions.addedCount),
      ...count("changeContradictionsDropped", contradictions.droppedCount),
      ...count("changeContradictionsDroppedTriaged", contradictions.droppedTriaged),
    ]
    if (parts.length) lines.push({ pane: "evidence", parts })
  } else notUpdated("evidence", contradictions)

  if (ran(strategy)) {
    const dates = [...count("changeDatesAdded", strategy.datesAdded.length), ...count("changeDatesRemoved", strategy.datesRemoved.length)]
    if (dates.length) lines.push({ pane: "evidence", parts: dates })
    const plan = [
      ...count("changePlanAdded", strategy.planAdded.length),
      ...count("changePlanRemoved", strategy.planRemoved.length),
      ...nameOrCount("changeTodoAddedNamed", "changeTodosAdded", strategy.todosAdded),
      ...count("changeTodosRemoved", strategy.todosRemoved.length),
    ]
    if (plan.length) lines.push({ pane: "procedure", parts: plan })
  } else notUpdated("procedure", strategy)

  if (ran(witnesses)) {
    const [one] = witnesses.rescored
    const rescored: ChangePart[] =
      witnesses.rescored.length === 1 && one
        ? [{ key: "changeWitnessRescoredNamed", values: { name: one.name, from: one.from, to: one.to } }]
        : count("changeWitnessesRescored", witnesses.rescored.length)
    const parts = [
      ...nameOrCount("changeWitnessAddedNamed", "changeWitnessesAdded", witnesses.added, "name"),
      ...count("changeWitnessesRemoved", witnesses.removed.length),
      ...rescored,
    ]
    if (parts.length) lines.push({ pane: "witnesses", parts })
  } else notUpdated("witnesses", witnesses)

  if (ran(damages)) {
    const parts = [
      ...nameOrCount("changeDamageAddedNamed", "changeDamagesAdded", damages.added),
      ...count("changeDamagesRemoved", damages.removed.length),
      ...count("changeDamagesAmountChanged", damages.amountChanged.length),
    ]
    if (parts.length) lines.push({ pane: "damages", parts })
  } else notUpdated("damages", damages)

  if (ran(findings)) {
    for (const [category, pane] of FINDING_PANES) {
      const d = findings.byCategory[category]
      if (!d) continue
      // A single new finding is named; more than one is counted.
      const [only] = d.added
      const added: ChangePart[] =
        d.added.length === 1 && only !== undefined
          ? [{ key: "changeFindingAddedNamed", values: { label: only } }]
          : count("changeFindingsAdded", d.added.length)
      const parts = [...added, ...count("changeFindingsRemoved", d.removed.length), ...count("changeFindingsRerated", d.rerated.length)]
      if (parts.length) lines.push({ pane, parts })
    }
  } else if (findings?.status === "failed") {
    lines.push({ pane: "legalIssues", parts: [{ key: "changeFindingsNotUpdated" }], notUpdated: true })
  }

  if (ran(redTeam) && redTeam.first) {
    // A first assessment: its risk of loss and how many arguments it makes.
    const parts: ChangePart[] = redTeam.riskOfLoss.to !== null ? [{ key: "changeRiskOfLossFirst", values: { to: redTeam.riskOfLoss.to } }] : []
    parts.push(...count("changeArgumentsFirst", redTeam.added.length))
    if (parts.length) lines.push({ pane: "redTeam", parts })
  } else if (ran(redTeam)) {
    const { from, to } = redTeam.riskOfLoss
    const parts: ChangePart[] = []
    if (from !== null && to !== null && Math.abs(to - from) >= RISK_OF_LOSS_THRESHOLD) {
      parts.push({ key: "changeRiskOfLoss", values: { from, to } })
    }
    parts.push(
      ...count("changeArgumentsAdded", redTeam.added.length),
      ...count("changeArgumentsDropped", redTeam.dropped.length),
      ...count("changeArgumentsRestrengthened", redTeam.restrengthened.length),
    )
    if (parts.length) lines.push({ pane: "redTeam", parts })
  } else notUpdated("redTeam", redTeam)

  if (ran(theory) && theory.first) {
    // A first AI draft: what it argues.
    const parts: ChangePart[] = theory.title.to ? [{ key: "changeTheoryTitle", values: { label: theory.title.to } }] : []
    parts.push(...count("changeClaimsFirst", theory.claimsAdded.length))
    if (parts.length) lines.push({ pane: "theories", parts })
  } else if (ran(theory)) {
    const parts: ChangePart[] = []
    if (theory.title.to && theory.title.from !== theory.title.to) parts.push({ key: "changeTheoryTitle", values: { label: theory.title.to } })
    parts.push(
      ...count("changeClaimsAdded", theory.claimsAdded.length),
      ...count("changeClaimsDropped", theory.claimsDropped.length),
      ...count("changeTheoryNotes", theory.assumptionsChanged + theory.openQuestionsChanged),
    )
    if (parts.length) lines.push({ pane: "theories", parts })
  } else notUpdated("theories", theory)

  if (reconstruction?.status === "skipped" && "outcome" in reconstruction && reconstruction.outcome === "skipped-edited") {
    lines.push({ pane: "caseReconstruction", parts: [{ key: "changeReconstructionKept" }], notUpdated: true })
  } else if (ran(reconstruction) && reconstruction.outcome === "generated") {
    // A first narrative: written, with the gaps it found.
    lines.push({ pane: "caseReconstruction", parts: [{ key: "changeNarrativeWritten" }, ...count("changeGapsFirst", reconstruction.gapsOpened.length)] })
  } else if (ran(reconstruction)) {
    const parts = [...count("changeGapsOpened", reconstruction.gapsOpened.length), ...count("changeGapsClosed", reconstruction.gapsClosed.length)]
    if (parts.length) lines.push({ pane: "caseReconstruction", parts })
  } else notUpdated("caseReconstruction", reconstruction)

  if (mindMap?.status === "skipped" && "keptUserChanges" in mindMap && mindMap.keptUserChanges) {
    lines.push({ pane: "mindMap", parts: [{ key: "changeMindMapKept" }], notUpdated: true })
  } else if (ran(mindMap) && mindMap.first) {
    // A first map: built, with how many branches.
    lines.push({ pane: "mindMap", parts: [{ key: "changeMapFirst", values: { count: mindMap.branchesAdded.length } }] })
  } else if (ran(mindMap)) {
    const parts = [
      ...count("changeBranchesAdded", mindMap.branchesAdded.length),
      ...count("changeBranchesRemoved", mindMap.branchesRemoved.length),
      ...count("changePointsAdded", mindMap.pointsAdded),
      ...count("changePointsRemoved", mindMap.pointsRemoved),
    ]
    if (parts.length) lines.push({ pane: "mindMap", parts })
  } else notUpdated("mindMap", mindMap)

  if (audioOverview?.status === "changed") {
    lines.push({ pane: "audioOverview", parts: [{ key: "changeAudioOverviewNew" }] })
  } else notUpdated("audioOverview", audioOverview)

  return lines
}

/** The pane a Regenerate summary is about — null for a refresh, which covers every tracked pane. */
export function regeneratedPane(summary: CaseChangeSummary): PanelId | null {
  if (summary.reason !== "regenerate") return null
  const d = summary.perPaneDeltas
  if (d.outlook) return "command"
  if (d.contradictions) return "evidence"
  if (d.redTeam) return "redTeam"
  if (d.reconstruction) return "caseReconstruction"
  if (d.strategy) return "procedure"
  if (d.witnesses) return "witnesses"
  if (d.damages) return "damages"
  if (d.theory) return "theories"
  if (d.mindMap) return "mindMap"
  if (d.audioOverview) return "audioOverview"
  if (d.findings) {
    const category = ("category" in d.findings && d.findings.category) || ("byCategory" in d.findings && Object.keys(d.findings.byCategory)[0])
    return FINDING_PANES.find(([c]) => c === category)?.[1] ?? "legalIssues"
  }
  return null
}

/** The modal's headline as a `terminal` key + values: what caused the run (new documents,
 * removed ones, a plain refresh, or one pane's Regenerate) and whether anything changed. A
 * Regenerate's `pane` value is a PanelId for the modal to name. */
export function describeChangeHeadline(summary: CaseChangeSummary): ChangePart {
  const pane = regeneratedPane(summary)
  // A new overview is never counted as a change, so "nothing material changed" would undersell it.
  if (pane === "audioOverview") return { key: "changeHeadlineAudio" }
  if (pane) {
    return summary.totalChanges > 0
      ? { key: "changeHeadlinePane", values: { pane, changes: summary.totalChanges } }
      : { key: "changeHeadlinePaneNone", values: { pane } }
  }
  const added = summary.documentsAdded.length
  const removed = summary.documentsRemoved.length
  const changes = summary.totalChanges
  if (changes === 0) {
    if (added) return { key: "changeHeadlineNoneFromDocs", values: { count: added } }
    return { key: "changeHeadlineNone" }
  }
  if (added) return { key: "changeHeadlineFromDocs", values: { count: added, changes } }
  if (removed) return { key: "changeHeadlineFromRemoved", values: { count: removed, changes } }
  return { key: "changeHeadlineRefresh", values: { changes } }
}

/** How the History list names a run: a pane's Regenerate, the new or removed documents behind a
 * refresh, a lawyer's "Refresh analysis", the automatic run, or the case's first analysis. A
 * Regenerate's `pane` value is a PanelId for the modal to name. */
export function describeChangeRun(summary: CaseChangeSummary): ChangePart {
  if (summary.firstAnalysis) return { key: "changeRunFirst" }
  const pane = regeneratedPane(summary)
  if (pane) return { key: "changeRunPane", values: { pane } }
  if (summary.documentsAdded.length) return { key: "changeRunDocs", values: { count: summary.documentsAdded.length } }
  if (summary.documentsRemoved.length) return { key: "changeRunRemoved", values: { count: summary.documentsRemoved.length } }
  return { key: summary.reason === "manual" ? "changeRunManual" : "changeRunAuto" }
}

/** One calendar day the case has change summaries on — GET /change-summaries/days. */
export interface ChangeSummaryDay {
  /** YYYY-MM-DD in the viewer's time zone. */
  day: string
  runs: number
  totalChanges: number
  /** Lawyers' editing sessions that started that day. Absent from an API older than them. */
  editSessions?: number
}

/** The calendar day (YYYY-MM-DD) a moment falls on in `timeZone` — how the API groups days too. */
export function dayKeyOf(moment: string | Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(moment))
}

/** The date picker's days, newest first. The latest summary's day leads even before the fetched
 * list has it (a run that just landed, or the list still loading). */
export function changeSummaryDays(latest: CaseChangeSummary, fetched: ChangeSummaryDay[] | undefined, timeZone: string): ChangeSummaryDay[] {
  const latestDay = dayKeyOf(latest.createdAt, timeZone)
  const days = fetched ?? []
  if (days.some((d) => d.day === latestDay)) return days
  return [{ day: latestDay, runs: 1, totalChanges: latest.firstAnalysis ? 0 : latest.totalChanges, editSessions: 0 }, ...days]
}

/** How the date picker names a day: "Today", "Yesterday", or the date (a `date` value, YYYY-MM-DD,
 * for the modal to format). */
export function describeDay(day: string, today: string, yesterday: string): ChangePart {
  if (day === today) return { key: "changeDayToday" }
  if (day === yesterday) return { key: "changeDayYesterday" }
  return { key: "changeDayDate", values: { date: day } }
}

/** The History list for one day: that day's fetched runs, with the snapshot's latest summary first
 * when it falls on that day (it can be newer than a list fetched a moment ago), each once. */
export function changeSummaryHistory(
  latest: CaseChangeSummary,
  fetched: CaseChangeSummary[] | undefined,
  day: string,
  timeZone: string,
): CaseChangeSummary[] {
  const runs = fetched ?? []
  if (dayKeyOf(latest.createdAt, timeZone) !== day) return runs
  return [latest, ...runs.filter((s) => s.id !== latest.id)]
}

/** Whether there is a summary to look at — any, a case's first analysis included (it then shows
 * what that analysis found). Drives the case row's "What changed" button. */
export function canViewChangeSummary(summary: CaseChangeSummary | null | undefined): summary is CaseChangeSummary {
  return !!summary
}

/** Whether the "What changed" modal opens by itself for this summary: one there is to look at, that
 * this viewer hasn't closed yet (`seenId`). */
export function shouldShowChangeSummary(summary: CaseChangeSummary | null | undefined, seenId: string | null): summary is CaseChangeSummary {
  return canViewChangeSummary(summary) && summary.id !== seenId
}
