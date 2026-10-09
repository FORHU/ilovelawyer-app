import { describe, it, expect } from "vitest"
import { computePanelBadges } from "../multi-screen"
import type { CaseFinding, CaseSnapshot, SnapshotRisk } from "../types"

const t = (key: string, opts?: Record<string, unknown>) => (opts?.count !== undefined ? `${key}:${opts.count}` : key)

const snapshot = (overrides: Partial<CaseSnapshot> = {}, parties: unknown[] = []) =>
  ({
    case: { parties },
    findings: [],
    risks: [],
    documents: [],
    law: { citations: [] },
    mindMap: { lastGeneratedAt: null, isStale: false },
    caseMindMap: null,
    redTeamAssessment: null,
    procedure: { items: [], deadlines: [] },
    witnesses: [],
    reconstruction: null,
    decisions: [],
    theories: [],
    outlook: null,
    riskAnalysis: null,
    ...overrides,
  }) as unknown as CaseSnapshot

describe("computePanelBadges: Case Summary", () => {
  it("counts the pane's open issues (open risks + open findings), even with no parties", () => {
    const data = snapshot({
      risks: [{ status: "OPEN" }, { status: "RESOLVED" }] as SnapshotRisk[],
      findings: [
        { category: "LEGAL_ISSUE", tag: "CONTESTED" },
        { category: "WEAKNESS", tag: "CLOSED" },
        { category: "STRENGTH", tag: "STRONG" },
      ] as CaseFinding[],
    })
    expect(computePanelBadges(data, t).command).toBe("badgeOpenIssues:2")
  })

  it("falls back to parties, then Ready for an outlook alone", () => {
    expect(computePanelBadges(snapshot({}, [{ id: "p1" }]), t).command).toBe("badgeParties:1")
    expect(computePanelBadges(snapshot({ outlook: {} as CaseSnapshot["outlook"] }), t).command).toBe("badgeReady")
  })

  it("has no badge when the pane has nothing to show", () => {
    expect(computePanelBadges(snapshot(), t).command).toBeUndefined()
  })
})
