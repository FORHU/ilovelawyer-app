import { describe, it, expect } from "vitest"
import {
  basisMonths,
  formatMoney,
  formatMoneyCompact,
  formatShare,
  monthsBetween,
  previewAmount,
  rangePercent,
  ringSegments,
  sameFigures,
  sortDamageHeads,
} from "../damages-format"

describe("damages money formatting", () => {
  it("formats pesos and pounds in full, with cents only when present", () => {
    expect(formatMoney(486000, "PHP")).toBe("₱486,000")
    expect(formatMoney(78600.5, "PHP")).toBe("₱78,600.5")
    expect(formatMoney(486000, "GBP")).toBe("£486,000")
    expect(formatMoney(0, "PHP")).toBe("₱0")
  })

  it("compacts the mockup's figures the way the ring and range bar show them", () => {
    expect(formatMoneyCompact(918600, "PHP")).toBe("₱918.6K")
    expect(formatMoneyCompact(1240000, "PHP")).toBe("₱1.24M")
    expect(formatMoneyCompact(640000, "PHP")).toBe("₱640K")
    expect(formatMoneyCompact(1400000, "PHP")).toBe("₱1.4M")
    expect(formatMoneyCompact(0, "PHP")).toBe("₱0")
    expect(formatMoneyCompact(950, "PHP")).toBe("₱950")
    expect(formatMoneyCompact(1240000, "GBP")).toMatch(/^£1\.24m$/i)
  })

  it("rounds shares to whole percent, keeping slivers visible", () => {
    expect(formatShare(486000 / 918600)).toBe("53%")
    expect(formatShare(0.004)).toBe("<1%")
    expect(formatShare(0)).toBe("0%")
    expect(formatShare(1)).toBe("100%")
  })
})

describe("sortDamageHeads", () => {
  it("orders by the mockup's category order, then oldest first", () => {
    const heads = [
      { id: "o", category: "OTHER" as const, createdAt: "2026-01-01" },
      { id: "a2", category: "ACTUAL" as const, createdAt: "2026-02-01" },
      { id: "f", category: "ATTORNEYS_FEES" as const, createdAt: "2026-01-01" },
      { id: "a1", category: "ACTUAL" as const, createdAt: "2026-01-01" },
      { id: "m", category: "MORAL" as const, createdAt: "2026-01-01" },
    ]
    expect(sortDamageHeads(heads).map((h) => h.id)).toEqual(["a1", "a2", "m", "f", "o"])
  })
})

describe("ringSegments", () => {
  it("lays the heads end to end with a gap between them", () => {
    const segs = ringSegments(
      [
        { id: "a", share: 0.5 },
        { id: "b", share: 0.3 },
        { id: "c", share: 0.2 },
      ],
      0.01,
    )
    expect(segs.map((s) => s.id)).toEqual(["a", "b", "c"])
    expect(segs[0]!.offset).toBeCloseTo(0.005)
    expect(segs[0]!.length).toBeCloseTo(0.49)
    expect(segs[1]!.offset).toBeCloseTo(0.505)
    expect(segs[2]!.offset + segs[2]!.length + 0.005).toBeCloseTo(1)
  })

  it("gives a lone head the whole circle and skips zero shares", () => {
    expect(ringSegments([{ id: "a", share: 1 }, { id: "z", share: 0 }])).toEqual([{ id: "a", length: 1, offset: 0 }])
    expect(ringSegments([{ id: "z", share: 0 }])).toEqual([])
  })

  it("keeps a hairline for a head smaller than the gap", () => {
    const segs = ringSegments([
      { id: "a", share: 0.999 },
      { id: "b", share: 0.001 },
    ])
    expect(segs[1]!.length).toBeGreaterThan(0)
  })
})

describe("rangePercent", () => {
  it("places values on the track and clamps to it", () => {
    expect(rangePercent(700000, 1400000)).toBe(50)
    expect(rangePercent(2000000, 1400000)).toBe(100)
    expect(rangePercent(-5, 1400000)).toBe(0)
    expect(rangePercent(10, 0)).toBe(0)
  })
})

describe("previewAmount", () => {
  it("previews each basis kind the way the server computes it", () => {
    expect(previewAmount({ kind: "FIXED" }, 200000, {})).toBe(200000)
    expect(previewAmount({ kind: "FIXED" }, null, {})).toBeUndefined()
    expect(previewAmount({ kind: "RATE_X_PERIOD", monthlyRate: 27000, months: 18 }, null, {})).toBe(486000)
    expect(
      previewAmount({ kind: "RATE_X_PERIOD", monthlyRate: 30000, fromDate: "2025-01-15", untilDate: "2025-07-30" }, null, {}),
    ).toBe(195000)
    expect(previewAmount({ kind: "RATE_X_PERIOD", monthlyRate: 30000 }, null, {})).toBeUndefined()
    expect(
      previewAmount(
        { kind: "PERCENT_OF", percent: 10, categories: ["ACTUAL", "MORAL", "EXEMPLARY"] },
        null,
        { ACTUAL: 486000, MORAL: 200000, EXEMPLARY: 100000, OTHER: 54000 },
      ),
    ).toBe(78600)
  })

  it("matches the API's month counting, including month-end clamping", () => {
    expect(monthsBetween("2025-01-15", "2026-07-15")).toBe(18)
    expect(monthsBetween("2025-01-31", "2025-03-01")).toBe(1.03)
    expect(monthsBetween("2025-03-01", "2025-01-01")).toBeUndefined()
  })
})

describe("accruing periods", () => {
  const today = new Date("2026-09-28T08:00:00Z")
  const accruing = { kind: "RATE_X_PERIOD" as const, monthlyRate: 27000, fromDate: "2025-03-28", untilDate: "asOf" }

  it("runs an accruing period to today, the way the API computes it", () => {
    expect(basisMonths(accruing, today)).toBe(18)
    expect(previewAmount(accruing, null, {}, today)).toBe(486000)
    expect(previewAmount(accruing, null, {}, new Date("2026-10-28T08:00:00Z"))).toBe(27000 * 19)
  })

  it("prefers stated months, and needs a start date otherwise", () => {
    expect(basisMonths({ kind: "RATE_X_PERIOD", monthlyRate: 1, months: 4 }, today)).toBe(4)
    expect(basisMonths({ kind: "RATE_X_PERIOD", monthlyRate: 1, untilDate: "asOf" }, today)).toBeUndefined()
  })
})

describe("sameFigures", () => {
  const rate = (monthlyRate: number, extra = {}) => ({ basis: { kind: "RATE_X_PERIOD" as const, monthlyRate, ...extra }, amount: null })
  it("matches the API's figuresDiffer", () => {
    expect(sameFigures(rate(27000, { fromDate: "2025-03-28", untilDate: "asOf" }), rate(27000))).toBe(true)
    expect(sameFigures(rate(27000), rate(28500))).toBe(false)
    expect(sameFigures({ basis: null, amount: 5 }, { basis: { kind: "FIXED" }, amount: 5 })).toBe(true)
    expect(sameFigures({ basis: null, amount: 5 }, rate(5))).toBe(false)
  })
})
