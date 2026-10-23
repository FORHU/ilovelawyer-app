import { describe, it, expect } from "vitest"
import { chargeStatusTone, groupChargesByMonth } from "../fee-history-format"
import type { ChargeRecord } from "../billing"

function charge(id: string, createdAt: string, extra: Partial<ChargeRecord> = {}): ChargeRecord {
  return {
    id,
    kind: "PER_CASE_FEE",
    status: "SUCCEEDED",
    amount: { amountMinor: 8000, currency: "GBP" },
    refunded: { amountMinor: 0, currency: "GBP" },
    requestId: null,
    lawyer: null,
    failureReason: null,
    receiptUrl: null,
    provider: "STRIPE",
    createdAt,
    ...extra,
  }
}

describe("chargeStatusTone", () => {
  it("maps every charge status to a badge tone", () => {
    expect(chargeStatusTone("SUCCEEDED")).toBe("success")
    expect(chargeStatusTone("PENDING")).toBe("caution")
    expect(chargeStatusTone("FAILED")).toBe("danger")
    expect(chargeStatusTone("PARTIALLY_REFUNDED")).toBe("warning")
    expect(chargeStatusTone("REFUNDED")).toBe("neutral")
  })
})

describe("groupChargesByMonth", () => {
  it("splits charges across a month boundary, newest month first", () => {
    const charges = [
      charge("1", "2026-10-21T10:00:00.000Z"),
      charge("2", "2026-10-09T10:00:00.000Z"),
      charge("3", "2026-09-27T10:00:00.000Z"),
      charge("4", "2026-09-03T10:00:00.000Z"),
    ]

    const groups = groupChargesByMonth(charges)

    expect(groups.map((g) => g.key)).toEqual(["2026-10", "2026-09"])
    expect(groups[0].charges.map((c) => c.id)).toEqual(["1", "2"])
    expect(groups[1].charges.map((c) => c.id)).toEqual(["3", "4"])
  })

  it("preserves each group's input order (the API's createdAt desc)", () => {
    const charges = [charge("a", "2026-10-21T10:00:00.000Z"), charge("b", "2026-10-01T10:00:00.000Z")]
    const groups = groupChargesByMonth(charges)
    expect(groups).toHaveLength(1)
    expect(groups[0].charges.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("returns no groups for an empty list", () => {
    expect(groupChargesByMonth([])).toEqual([])
  })
})
