import { describe, it, expect } from "vitest"
import { scriptStepFor, SCRIPT_STEP_COUNT } from "../use-audio-overview"
import type { AiJobStatus } from "@/lib/terminal/mutations"

const STARTED = Date.parse("2026-10-01T09:00:00.000Z")

function job(patch: Partial<AiJobStatus>): AiJobStatus {
  return { status: "IN_PROGRESS", startedAt: "2026-10-01T09:00:01.000Z", finishedAt: null, error: null, stage: null, ...patch }
}

describe("scriptStepFor", () => {
  it("follows the API's stage while the job is running", () => {
    expect(scriptStepFor(job({ stage: null }), STARTED)).toBe(0)
    expect(scriptStepFor(job({ stage: "answering" }), STARTED)).toBe(1)
    expect(scriptStepFor(job({ stage: "extras" }), STARTED)).toBe(2)
  })

  it("shows every step done once this run's job has finished", () => {
    expect(scriptStepFor(job({ status: "DONE", finishedAt: "2026-10-01T09:01:30.000Z" }), STARTED)).toBe(SCRIPT_STEP_COUNT)
  })

  it("ignores a DONE row left over from the previous generation", () => {
    expect(scriptStepFor(job({ status: "DONE", finishedAt: "2026-09-30T14:12:00.000Z" }), STARTED)).toBe(0)
  })

  it("starts at the first step when nothing is known yet", () => {
    expect(scriptStepFor(undefined, STARTED)).toBe(0)
    expect(scriptStepFor(null, null)).toBe(0)
    expect(scriptStepFor(job({ status: "DONE", finishedAt: "2026-10-01T09:01:30.000Z" }), null)).toBe(0)
  })
})
