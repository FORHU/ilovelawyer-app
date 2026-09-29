import { describe, it, expect } from "vitest"
import { shouldShowUpdatingAnalysis } from "../refresh-status"

describe("shouldShowUpdatingAnalysis", () => {
  it("shows while a caseRefresh job is IN_PROGRESS", () => {
    expect(shouldShowUpdatingAnalysis("IN_PROGRESS")).toBe(true)
  })

  it("hides once the job completes (DONE)", () => {
    expect(shouldShowUpdatingAnalysis("DONE")).toBe(false)
  })

  it("hides on a failed job", () => {
    expect(shouldShowUpdatingAnalysis("FAILED")).toBe(false)
  })

  it("hides when no job status has loaded yet", () => {
    expect(shouldShowUpdatingAnalysis(undefined)).toBe(false)
  })

  it("shows while either the refresh or the damages extraction is running", () => {
    expect(shouldShowUpdatingAnalysis("DONE", "IN_PROGRESS")).toBe(true)
    expect(shouldShowUpdatingAnalysis("IN_PROGRESS", undefined)).toBe(true)
    expect(shouldShowUpdatingAnalysis("DONE", "FAILED")).toBe(false)
    expect(shouldShowUpdatingAnalysis(undefined, undefined)).toBe(false)
  })
})
