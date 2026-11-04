import { describe, expect, it } from "vitest"
import { CLIENT_REQUEST_STATUSES } from "@/lib/client-handoff"
import { closingSoon, leftToShow, readiness, sortRequests, stepPosition, timeLeft } from "../request-meta"

const NOW = new Date("2026-10-29T12:00:00Z").getTime()
const MIN = 60_000

describe("timeLeft", () => {
  it("counts the milliseconds left", () => {
    expect(timeLeft("2026-10-29T12:30:00Z", NOW)).toBe(30 * MIN)
  })
  it("never goes below zero", () => {
    expect(timeLeft("2026-10-29T10:00:00Z", NOW)).toBe(0)
  })
  it("is null with nothing to count to", () => {
    expect(timeLeft(null, NOW)).toBeNull()
  })
})

describe("leftToShow", () => {
  it("rounds down to whole hours from an hour up", () => {
    expect(leftToShow(150 * MIN)).toEqual({ hours: 2 })
    expect(leftToShow(90 * MIN)).toEqual({ hours: 1 })
    expect(leftToShow(60 * MIN)).toEqual({ hours: 1 })
  })
  it("shows minutes in the last hour", () => {
    expect(leftToShow(30 * MIN)).toEqual({ minutes: 30 })
    expect(leftToShow(59.9 * MIN)).toEqual({ minutes: 59 })
  })
  it("is 0 minutes in the last minute", () => {
    expect(leftToShow(30_000)).toEqual({ minutes: 0 })
  })
})

describe("closingSoon", () => {
  it("is true under 6 hours", () => {
    expect(closingSoon(359 * MIN)).toBe(true)
    expect(closingSoon(360 * MIN)).toBe(false)
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
