import { describe, it, expect } from "vitest"
import { buildSummaryView, openFindings } from "../case-summary-view"
import type { CaseFinding, CaseSnapshot } from "../types"

const finding = (category: CaseFinding["category"], tag: CaseFinding["tag"]) => ({ category, tag }) as CaseFinding

describe("openFindings", () => {
  it("counts legal issues not RESOLVED and weaknesses not CLOSED", () => {
    const findings = [
      finding("LEGAL_ISSUE", "OPEN"),
      finding("LEGAL_ISSUE", "CONTESTED"),
      finding("LEGAL_ISSUE", "RESOLVED"),
      finding("WEAKNESS", "MATERIAL"),
      finding("WEAKNESS", null),
      finding("WEAKNESS", "CLOSED"),
      finding("STRENGTH", "STRONG"),
    ]
    expect(openFindings({ findings })).toHaveLength(4)
  })
})

describe("buildSummaryView key issues", () => {
  const snapshot = (findings: CaseFinding[]) =>
    ({
      findings,
      risks: [],
      documents: [],
      procedure: { deadlines: [] },
      nextDate: null,
      riskAnalysis: null,
      case: { parties: [], actionType: null, jurisdiction: null },
    }) as unknown as CaseSnapshot

  it("lists every open finding counted by the Open issues tile, serious ones first", () => {
    const findings = [
      { ...finding("WEAKNESS", null), id: "w-open" },
      { ...finding("LEGAL_ISSUE", "RESOLVED"), id: "l-resolved" },
      { ...finding("LEGAL_ISSUE", "CONTESTED"), id: "l-contested" },
      { ...finding("LEGAL_ISSUE", "OPEN"), id: "l-open" },
      { ...finding("WEAKNESS", "MATERIAL"), id: "w-material" },
    ] as CaseFinding[]
    const view = buildSummaryView(snapshot(findings))
    expect(view.findings.map((f) => f.id)).toEqual(["l-contested", "w-material", "w-open", "l-open"])
    expect(view.openIssues.value).toBe(view.findings.length)
  })
})
