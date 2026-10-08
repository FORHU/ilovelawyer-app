import { describe, it, expect } from "vitest"
import {
  describeChangeHeadline,
  canViewChangeSummary,
  changeSummaryDays,
  changeSummaryHistory,
  dayKeyOf,
  describeDay,
  describeChangeLines,
  describeChangeRun,
  regeneratedPane,
  shouldShowChangeSummary,
  type CaseChangeSummary,
  type ContradictionsDelta,
} from "../change-summary"

const contradictions = (over: Partial<ContradictionsDelta> = {}): ContradictionsDelta => ({
  status: "unchanged",
  added: [],
  addedCount: 0,
  dropped: [],
  droppedCount: 0,
  carriedOver: 0,
  droppedTriaged: 0,
  ...over,
})

const summary = (over: Partial<CaseChangeSummary> = {}): CaseChangeSummary => ({
  id: "s1",
  caseId: "case-1",
  reason: "post-extraction",
  documentsAdded: [],
  documentsRemoved: [],
  totalChanges: 0,
  firstAnalysis: false,
  perPaneDeltas: {},
  createdAt: "2026-10-08T09:00:00.000Z",
  ...over,
})

describe("describeChangeLines", () => {
  it("lists each changed pane in Terminal order, with the pane its Open link goes to", () => {
    const lines = describeChangeLines({
      redTeam: { status: "changed", first: false, riskOfLoss: { from: 38, to: 47 }, added: ["Waiver"], dropped: [], restrengthened: [] },
      contradictions: contradictions({ status: "changed", addedCount: 2, droppedCount: 1 }),
      outlook: {
        status: "changed",
        first: false,
        band: { from: "LEANS_FAVORABLE", to: "UNCERTAIN" },
        confidence: { from: "MEDIUM", to: "MEDIUM" },
        driversAdded: [],
        driversDropped: [],
      },
      findings: {
        status: "changed",
        byCategory: { WEAKNESS: { added: ["Gap in overtime records"], removed: [], rerated: [] } },
      },
    })
    expect(lines.map((l) => l.pane)).toEqual(["command", "evidence", "weaknesses", "redTeam"])
    expect(lines[0].parts).toEqual([{ key: "changeOutlookBand", values: { from: "LEANS_FAVORABLE", to: "UNCERTAIN" } }])
    expect(lines[1].parts.map((p) => p.key)).toEqual(["changeContradictionsAdded", "changeContradictionsDropped"])
    expect(lines[2].parts).toEqual([{ key: "changeFindingAddedNamed", values: { label: "Gap in overtime records" } }])
    expect(lines[3].parts).toEqual([
      { key: "changeRiskOfLoss", values: { from: 38, to: 47 } },
      { key: "changeArgumentsAdded", values: { count: 1 } },
    ])
  })

  it("counts findings when more than one was added to a pane", () => {
    const [line] = describeChangeLines({
      findings: { status: "changed", byCategory: { LEGAL_ISSUE: { added: ["A", "B"], removed: ["C"], rerated: [] } } },
    })
    expect(line.parts).toEqual([
      { key: "changeFindingsAdded", values: { count: 2 } },
      { key: "changeFindingsRemoved", values: { count: 1 } },
    ])
  })

  it("leaves out panes with nothing to say, and a first assessment or outlook", () => {
    const lines = describeChangeLines({
      contradictions: contradictions(),
      redTeam: { status: "unchanged", first: true, riskOfLoss: { from: null, to: 40 }, added: [], dropped: [], restrengthened: [] },
      reconstruction: { status: "unchanged", outcome: "regenerated", gapsOpened: [], gapsClosed: [] },
    })
    expect(lines).toEqual([])
  })

  it("says a failed pane wasn't updated, and that an edited narrative was left alone, without a skipped Red Team line", () => {
    const lines = describeChangeLines({
      outlook: { status: "failed" },
      redTeam: { status: "skipped" },
      reconstruction: { status: "skipped", outcome: "skipped-edited", gapsOpened: [], gapsClosed: [] },
    })
    expect(lines).toEqual([
      { pane: "command", parts: [{ key: "changeNotUpdated" }], notUpdated: true },
      { pane: "caseReconstruction", parts: [{ key: "changeReconstructionKept" }], notUpdated: true },
    ])
  })
})

describe("describeChangeLines — the six panes added later", () => {
  it("puts key dates under Evidence & Timeline and the plan under Case Strategy, naming a single new to-do", () => {
    const lines = describeChangeLines({
      strategy: {
        status: "changed",
        planAdded: [],
        planRemoved: ["Old step"],
        todosAdded: ["Request payroll records"],
        todosRemoved: [],
        datesAdded: [{ title: "Last salary paid", occurredOn: "2024-08-08" }],
        datesRemoved: [],
      },
    })
    expect(lines).toEqual([
      { pane: "evidence", parts: [{ key: "changeDatesAdded", values: { count: 1 } }] },
      {
        pane: "procedure",
        parts: [
          { key: "changePlanRemoved", values: { count: 1 } },
          { key: "changeTodoAddedNamed", values: { label: "Request payroll records" } },
        ],
      },
    ])
  })

  it("names a single new witness and a single re-score", () => {
    const [line] = describeChangeLines({
      witnesses: { status: "changed", added: ["M. Reyes"], removed: [], rescored: [{ name: "J. Cruz", from: 70, to: 45 }] },
    })
    expect(line).toEqual({
      pane: "witnesses",
      parts: [
        { key: "changeWitnessAddedNamed", values: { name: "M. Reyes" } },
        { key: "changeWitnessRescoredNamed", values: { name: "J. Cruz", from: 70, to: 45 } },
      ],
    })
  })

  it("covers damages, the AI draft theory, the map and the audio overview, in Terminal order", () => {
    const lines = describeChangeLines({
      audioOverview: { status: "changed", overviewId: "ao-1" },
      mindMap: { status: "changed", branchesAdded: ["Damages"], branchesRemoved: [], pointsAdded: 3, pointsRemoved: 0, keptUserChanges: false },
      theory: {
        status: "changed",
        first: false,
        title: { from: "Unpaid overtime", to: "Constructive dismissal" },
        claimsAdded: ["A"],
        claimsDropped: [],
        assumptionsChanged: 0,
        openQuestionsChanged: 0,
      },
      damages: { status: "changed", added: ["13th month pay"], removed: [], amountChanged: [{ title: "Overtime", from: 1, to: 2 }] },
    })
    expect(lines.map((l) => l.pane)).toEqual(["damages", "theories", "mindMap", "audioOverview"])
    expect(lines[1].parts[0]).toEqual({ key: "changeTheoryTitle", values: { label: "Constructive dismissal" } })
    expect(lines[3].parts).toEqual([{ key: "changeAudioOverviewNew" }])
  })

  it("says a map with a lawyer's changes wasn't rebuilt, and a failed witnesses step wasn't updated", () => {
    const lines = describeChangeLines({
      mindMap: { status: "skipped", branchesAdded: [], branchesRemoved: [], pointsAdded: 0, pointsRemoved: 0, keptUserChanges: true },
      witnesses: { status: "failed" },
    })
    expect(lines).toEqual([
      { pane: "witnesses", parts: [{ key: "changeNotUpdated" }], notUpdated: true },
      { pane: "mindMap", parts: [{ key: "changeMindMapKept" }], notUpdated: true },
    ])
  })
})

describe("describeChangeHeadline", () => {
  it("credits new documents when there were any", () => {
    const docs = [{ id: "d1", name: "Payroll.pdf" }, { id: "d2", name: "Incident.pdf" }]
    expect(describeChangeHeadline(summary({ documentsAdded: docs, totalChanges: 6 }))).toEqual({
      key: "changeHeadlineFromDocs",
      values: { count: 2, changes: 6 },
    })
    expect(describeChangeHeadline(summary({ documentsAdded: docs }))).toEqual({ key: "changeHeadlineNoneFromDocs", values: { count: 2 } })
  })

  it("never says 'new evidence' for a refresh with no document change", () => {
    expect(describeChangeHeadline(summary({ totalChanges: 3 }))).toEqual({ key: "changeHeadlineRefresh", values: { changes: 3 } })
    expect(describeChangeHeadline(summary())).toEqual({ key: "changeHeadlineNone" })
  })

  it("names removed documents as the cause when nothing was added", () => {
    expect(describeChangeHeadline(summary({ documentsRemoved: [{ id: "d1", name: null }], totalChanges: 1 }))).toEqual({
      key: "changeHeadlineFromRemoved",
      values: { count: 1, changes: 1 },
    })
  })
})

describe("a pane's own Regenerate", () => {
  it("names the pane in the headline, whether or not anything changed", () => {
    const redTeam = summary({
      reason: "regenerate",
      totalChanges: 2,
      perPaneDeltas: { redTeam: { status: "changed", first: false, riskOfLoss: { from: 40, to: 41 }, added: ["A"], dropped: ["B"], restrengthened: [] } },
    })
    expect(describeChangeHeadline(redTeam)).toEqual({ key: "changeHeadlinePane", values: { pane: "redTeam", changes: 2 } })

    const weaknesses = summary({ reason: "regenerate", perPaneDeltas: { findings: { status: "unchanged", byCategory: {}, category: "WEAKNESS" } } })
    expect(describeChangeHeadline(weaknesses)).toEqual({ key: "changeHeadlinePaneNone", values: { pane: "weaknesses" } })
  })

  it("maps each tracked pane to the Terminal pane it opens", () => {
    const pane = (perPaneDeltas: CaseChangeSummary["perPaneDeltas"]) => regeneratedPane(summary({ reason: "regenerate", perPaneDeltas }))
    expect(pane({ outlook: { status: "skipped" } })).toBe("command")
    expect(pane({ contradictions: { status: "skipped" } })).toBe("evidence")
    expect(pane({ reconstruction: { status: "skipped" } })).toBe("caseReconstruction")
    expect(pane({ findings: { status: "changed", byCategory: { DEFENSE_STRATEGY: { added: ["A"], removed: [], rerated: [] } } } })).toBe("defenseStrategy")
    expect(pane({ strategy: { status: "skipped" } })).toBe("procedure")
    expect(pane({ theory: { status: "skipped" } })).toBe("theories")
    expect(pane({ mindMap: { status: "skipped" } })).toBe("mindMap")
    expect(regeneratedPane(summary({ perPaneDeltas: { redTeam: { status: "skipped" } } }))).toBe(null)
  })

  it("says a regenerated Audio Overview is ready rather than that nothing changed", () => {
    const audio = summary({ reason: "regenerate", perPaneDeltas: { audioOverview: { status: "changed", overviewId: "ao-1" } } })
    expect(describeChangeHeadline(audio)).toEqual({ key: "changeHeadlineAudio" })
  })
})

describe("History", () => {
  it("names each kind of run", () => {
    expect(describeChangeRun(summary({ firstAnalysis: true }))).toEqual({ key: "changeRunFirst" })
    expect(describeChangeRun(summary({ reason: "regenerate", perPaneDeltas: { redTeam: { status: "skipped" } } }))).toEqual({
      key: "changeRunPane",
      values: { pane: "redTeam" },
    })
    expect(describeChangeRun(summary({ documentsAdded: [{ id: "d1", name: "Payroll.pdf" }] }))).toEqual({ key: "changeRunDocs", values: { count: 1 } })
    expect(describeChangeRun(summary({ documentsRemoved: [{ id: "d1", name: null }] }))).toEqual({ key: "changeRunRemoved", values: { count: 1 } })
    expect(describeChangeRun(summary({ reason: "manual" }))).toEqual({ key: "changeRunManual" })
    expect(describeChangeRun(summary())).toEqual({ key: "changeRunAuto" })
  })

  it("puts the snapshot's latest first, once, ahead of the fetched list", () => {
    const latest = summary({ id: "s3" })
    const fetched = [summary({ id: "s2" }), summary({ id: "s1" })]
    // summary() is made at 2026-10-08T09:00Z — 17:00 in Manila, the same calendar day.
    const day = "2026-10-08"
    expect(changeSummaryHistory(latest, fetched, day, "Asia/Manila").map((s) => s.id)).toEqual(["s3", "s2", "s1"])
    expect(changeSummaryHistory(latest, [latest, ...fetched], day, "Asia/Manila").map((s) => s.id)).toEqual(["s3", "s2", "s1"])
    expect(changeSummaryHistory(latest, undefined, day, "Asia/Manila").map((s) => s.id)).toEqual(["s3"])
    // Another day's list never gets the latest run added to it.
    expect(changeSummaryHistory(latest, fetched, "2026-10-07", "Asia/Manila").map((s) => s.id)).toEqual(["s2", "s1"])
  })

  it("splits days on the viewer's calendar, not UTC's", () => {
    // 20:30 UTC on Oct 7 is already Oct 8 in Manila (UTC+8).
    expect(dayKeyOf("2026-10-07T20:30:00Z", "Asia/Manila")).toBe("2026-10-08")
    expect(dayKeyOf("2026-10-07T20:30:00Z", "UTC")).toBe("2026-10-07")
  })

  it("leads the date picker with the latest run's day even before the day list has it", () => {
    const latest = summary({ id: "s9", createdAt: "2026-10-08T09:00:00.000Z", totalChanges: 4 })
    expect(changeSummaryDays(latest, undefined, "UTC")).toEqual([{ day: "2026-10-08", runs: 1, totalChanges: 4 }])
    const fetched = [{ day: "2026-10-07", runs: 3, totalChanges: 20 }]
    expect(changeSummaryDays(latest, fetched, "UTC").map((d) => d.day)).toEqual(["2026-10-08", "2026-10-07"])
    const withToday = [{ day: "2026-10-08", runs: 5, totalChanges: 40 }, ...fetched]
    expect(changeSummaryDays(latest, withToday, "UTC")).toBe(withToday)
  })

  it("names days Today and Yesterday, and dates the rest", () => {
    expect(describeDay("2026-10-08", "2026-10-08", "2026-10-07")).toEqual({ key: "changeDayToday" })
    expect(describeDay("2026-10-07", "2026-10-08", "2026-10-07")).toEqual({ key: "changeDayYesterday" })
    expect(describeDay("2026-10-01", "2026-10-08", "2026-10-07")).toEqual({ key: "changeDayDate", values: { date: "2026-10-01" } })
  })
})

describe("canViewChangeSummary", () => {
  it("offers the What changed button for any summary but a case's first analysis", () => {
    expect(canViewChangeSummary(summary())).toBe(true)
    expect(canViewChangeSummary(summary({ firstAnalysis: true }))).toBe(false)
    expect(canViewChangeSummary(null)).toBe(false)
  })
})

describe("shouldShowChangeSummary", () => {
  it("shows a summary this viewer hasn't dismissed", () => {
    expect(shouldShowChangeSummary(summary(), null)).toBe(true)
    expect(shouldShowChangeSummary(summary(), "s1")).toBe(false)
  })

  it("never shows a case's first analysis, or nothing at all", () => {
    expect(shouldShowChangeSummary(summary({ firstAnalysis: true }), null)).toBe(false)
    expect(shouldShowChangeSummary(null, null)).toBe(false)
  })
})
