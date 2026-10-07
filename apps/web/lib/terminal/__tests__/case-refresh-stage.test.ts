import { describe, it, expect } from "vitest"
import { caseRefreshRewriting } from "../case-refresh-stage"
import type { AiJobStatus } from "../mutations"

const job = (status: AiJobStatus["status"], stage: string | null = null) =>
  ({ status, startedAt: "", finishedAt: null, error: null, stage }) as AiJobStatus

describe("caseRefreshRewriting", () => {
  it("is false with no run going", () => {
    expect(caseRefreshRewriting(undefined, "timeline")).toBe(false)
    expect(caseRefreshRewriting(job("DONE"), "mindMap")).toBe(false)
    expect(caseRefreshRewriting(job("FAILED"), "timeline")).toBe(false)
  })

  it("rewrites the timeline only during wave 1", () => {
    expect(caseRefreshRewriting(job("IN_PROGRESS"), "timeline")).toBe(true)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave2"), "timeline")).toBe(false)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave3"), "timeline")).toBe(false)
  })

  it("rewrites the map through wave 2", () => {
    expect(caseRefreshRewriting(job("IN_PROGRESS"), "mindMap")).toBe(true)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave2"), "mindMap")).toBe(true)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave3"), "mindMap")).toBe(false)
  })

  it("rewrites the Data Table through wave 2 — its witness scores and re-rated damages land there", () => {
    expect(caseRefreshRewriting(job("IN_PROGRESS"), "dataTable")).toBe(true)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave2"), "dataTable")).toBe(true)
    expect(caseRefreshRewriting(job("IN_PROGRESS", "wave3"), "dataTable")).toBe(false)
    expect(caseRefreshRewriting(job("DONE"), "dataTable")).toBe(false)
  })
})
