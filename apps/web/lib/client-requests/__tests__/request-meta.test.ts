import { describe, expect, it } from "vitest"
import { CLIENT_REQUEST_STATUSES } from "@/lib/client-handoff"
import { hoursLeft, readiness, sortRequests, stepPosition } from "../request-meta"

const NOW = new Date("2026-10-29T12:00:00Z").getTime()

describe("hoursLeft", () => {
  it("rounds up to whole hours", () => {
    expect(hoursLeft("2026-10-29T14:30:00Z", NOW)).toBe(3)
  })
  it("never goes below zero", () => {
    expect(hoursLeft("2026-10-29T10:00:00Z", NOW)).toBe(0)
  })
  it("is null with nothing to count to", () => {
    expect(hoursLeft(null, NOW)).toBeNull()
  })
})

describe("readiness", () => {
  const withCriteria = (criteria: { key: string; label: string; met: boolean }[] | undefined) =>
    ({ brief: { intake: criteria ? { completeness: { ready: false, criteria } } : null } }) as never
  it("counts the criteria met", () => {
    expect(readiness(withCriteria([{ key: "a", label: "A", met: true }, { key: "b", label: "B", met: false }]))).toEqual({ met: 1, total: 2 })
  })
  it("is null before the check has run", () => {
    expect(readiness(withCriteria(undefined))).toBeNull()
    expect(readiness(withCriteria([]))).toBeNull()
  })
})

describe("sortRequests", () => {
  const a = { id: "a", routedAt: "2026-10-29T08:00:00Z", routingExpiresAt: "2026-10-31T08:00:00Z" }
  const b = { id: "b", routedAt: "2026-10-29T10:00:00Z", routingExpiresAt: "2026-10-31T10:00:00Z" }
  const c = { id: "c", routedAt: "2026-10-28T10:00:00Z", routingExpiresAt: null }
  it("puts the soonest to close first, and those with no expiry last", () => {
    expect(sortRequests([c, b, a], "closing").map((r) => r.id)).toEqual(["a", "b", "c"])
  })
  it("puts the newest first", () => {
    expect(sortRequests([a, c, b], "newest").map((r) => r.id)).toEqual(["b", "a", "c"])
  })
  it("leaves its input alone", () => {
    const input = [b, a]
    sortRequests(input, "closing")
    expect(input.map((r) => r.id)).toEqual(["b", "a"])
  })
})

describe("stepPosition", () => {
  it("covers every status", () => {
    for (const s of CLIENT_REQUEST_STATUSES) expect(() => stepPosition(s)).not.toThrow()
  })
  it("moves forward through the main path", () => {
    const path = ["ROUTED", "CLAIMED", "QUOTED", "CONFIRMED", "ENGAGED", "CLOSED"] as const
    expect(path.map(stepPosition)).toEqual([0, 1, 2, 3, 4, 5])
  })
  it("has no line for a request that never got a lawyer", () => {
    expect(stepPosition("EXPIRED")).toBeNull()
    expect(stepPosition("WITHDRAWN")).toBeNull()
  })
})
