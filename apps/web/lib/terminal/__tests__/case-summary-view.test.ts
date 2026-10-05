import { describe, it, expect } from "vitest"
import { openFindings } from "../case-summary-view"
import type { CaseFinding } from "../types"

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
