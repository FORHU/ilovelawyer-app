import { describe, it, expect } from "vitest"
import { shouldShowUpdatingAnalysis } from "../refresh-status"

describe("shouldShowUpdatingAnalysis", () => {
  it("shows while a caseRefresh job is IN_PROGRESS and this tab didn't just click Refresh", () => {
    expect(shouldShowUpdatingAnalysis(false, "IN_PROGRESS")).toBe(true)
  })

  it("hides while this tab's own click is still pending — the Refresh button already shows its own state", () => {
    expect(shouldShowUpdatingAnalysis(true, "IN_PROGRESS")).toBe(false)
  })

  it("hides once the job completes (DONE)", () => {
    expect(shouldShowUpdatingAnalysis(false, "DONE")).toBe(false)
  })

  it("hides on a failed job", () => {
    expect(shouldShowUpdatingAnalysis(false, "FAILED")).toBe(false)
  })

  it("hides when no job status has loaded yet", () => {
    expect(shouldShowUpdatingAnalysis(false, undefined)).toBe(false)
  })
})
