import { describe, it, expect } from "vitest"
import { advanceDamagesTracker, damagesActivityOf, initialDamagesTracker, type DamagesTrackerInput } from "../damages-activity"

// Walks the tracker through a sequence of renders, each merging its changes into the last input.
function run(steps: Partial<DamagesTrackerInput>[]) {
  let input: DamagesTrackerInput = { status: undefined, jobUpdatedAt: 0, count: 2, snapshotUpdatedAt: 100, paneVisible: false }
  let tracker = initialDamagesTracker(100)
  const seen: (string | undefined)[] = []
  for (const step of steps) {
    input = { ...input, ...step }
    tracker = advanceDamagesTracker(tracker, input)
    seen.push(damagesActivityOf(tracker))
  }
  return { seen, tracker }
}

describe("damages pane activity", () => {
  it("is busy while the job runs, then fresh when the next snapshot has more heads", () => {
    const { seen } = run([
      { status: "IN_PROGRESS", jobUpdatedAt: 200 },
      { status: "DONE", jobUpdatedAt: 300 },
      { snapshotUpdatedAt: 350, count: 3 },
    ])
    expect(seen).toEqual(["busy", undefined, "fresh"])
  })

  it("counts a new suggested update as news too (count covers heads + proposals)", () => {
    const { seen } = run([{ status: "IN_PROGRESS", jobUpdatedAt: 200 }, { status: "DONE", jobUpdatedAt: 300 }, { snapshotUpdatedAt: 350, count: 4 }])
    expect(seen.at(-1)).toBe("fresh")
  })

  it("isn't fresh when the run added nothing", () => {
    const { seen, tracker } = run([{ status: "IN_PROGRESS", jobUpdatedAt: 200 }, { status: "DONE", jobUpdatedAt: 300 }, { snapshotUpdatedAt: 350 }])
    expect(seen.at(-1)).toBeUndefined()
    // …and the run is no longer tracked, so a later manual add isn't mistaken for it.
    expect(tracker.baseline).toBeNull()
  })

  it("ignores a snapshot that predates the job finishing", () => {
    const { seen } = run([
      { status: "IN_PROGRESS", jobUpdatedAt: 200 },
      { status: "DONE", jobUpdatedAt: 300 },
      { snapshotUpdatedAt: 250, count: 3 },
      { snapshotUpdatedAt: 400 },
    ])
    expect(seen).toEqual(["busy", undefined, undefined, "fresh"])
  })

  it("isn't fresh when the pane was on screen, and clears once the pane is shown", () => {
    expect(
      run([{ status: "IN_PROGRESS", jobUpdatedAt: 200, paneVisible: true }, { status: "DONE", jobUpdatedAt: 300 }, { snapshotUpdatedAt: 350, count: 3 }]).seen.at(-1),
    ).toBeUndefined()

    const { seen } = run([
      { status: "IN_PROGRESS", jobUpdatedAt: 200 },
      { status: "DONE", jobUpdatedAt: 300 },
      { snapshotUpdatedAt: 350, count: 3 },
      { paneVisible: true },
      { paneVisible: false },
    ])
    expect(seen.slice(-3)).toEqual(["fresh", undefined, undefined])
  })

  it("doesn't count a manual add as news when no run happened", () => {
    expect(run([{ snapshotUpdatedAt: 350, count: 5 }]).seen).toEqual([undefined])
  })

  it("returns the same tracker when nothing changed, so state isn't set again", () => {
    const t0 = initialDamagesTracker(100)
    const input: DamagesTrackerInput = { status: undefined, jobUpdatedAt: 0, count: 2, snapshotUpdatedAt: 100, paneVisible: false }
    expect(advanceDamagesTracker(t0, input)).toBe(t0)
  })

  it("treats a page loaded mid-run as busy", () => {
    expect(run([{ status: "IN_PROGRESS", jobUpdatedAt: 50 }]).seen).toEqual(["busy"])
  })
})
