import { describe, it, expect } from "vitest"
import { daysUntil, deadlineStats, formatMoney, formatMoneyCompact, sortDamageHeads } from "../damages-format"

describe("damages money formatting", () => {
  it("formats pesos and pounds in full, with cents only when present", () => {
    expect(formatMoney(486000, "PHP")).toBe("₱486,000")
    expect(formatMoney(78600.5, "PHP")).toBe("₱78,600.5")
    expect(formatMoney(486000, "GBP")).toBe("£486,000")
    expect(formatMoney(0, "PHP")).toBe("₱0")
  })

  it("compacts the headline total", () => {
    expect(formatMoneyCompact(918600, "PHP")).toBe("₱918.6K")
    expect(formatMoneyCompact(1240000, "PHP")).toBe("₱1.24M")
    expect(formatMoneyCompact(0, "PHP")).toBe("₱0")
    expect(formatMoneyCompact(1240000, "GBP")).toMatch(/^£1\.24m$/i)
  })
})

describe("sortDamageHeads", () => {
  const head = (id: string, extra: { accepted?: boolean; done?: boolean; dueDate?: string | null; createdAt?: string } = {}) => ({
    id,
    accepted: true,
    done: false,
    dueDate: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  })

  it("puts AI suggestions first, then open entries by due date (undated last), then done ones", () => {
    const sorted = sortDamageHeads([
      head("done", { done: true, dueDate: "2026-01-02" }),
      head("undated"),
      head("later", { dueDate: "2026-12-01" }),
      head("suggestion", { accepted: false }),
      head("sooner", { dueDate: "2026-10-15" }),
    ])
    expect(sorted.map((h) => h.id)).toEqual(["suggestion", "sooner", "later", "undated", "done"])
  })

  it("keeps the oldest first among equals", () => {
    const sorted = sortDamageHeads([head("b", { createdAt: "2026-02-01T00:00:00.000Z" }), head("a")])
    expect(sorted.map((h) => h.id)).toEqual(["a", "b"])
  })
})

describe("daysUntil", () => {
  const today = new Date("2026-10-01T15:00:00.000Z")
  it("counts whole calendar days, negative once passed", () => {
    expect(daysUntil("2026-10-01", today)).toBe(0)
    expect(daysUntil("2026-10-15", today)).toBe(14)
    expect(daysUntil("2026-09-28", today)).toBe(-3)
  })
})

describe("deadlineStats", () => {
  const today = new Date("2026-10-01T15:00:00.000Z")
  const h = (dueDate: string | null, extra: { done?: boolean; accepted?: boolean } = {}) => ({ accepted: true, done: false, dueDate, ...extra })

  it("counts passed deadlines and finds the nearest one ahead, today included", () => {
    expect(deadlineStats([h("2026-09-20"), h("2026-09-30"), h("2026-10-20"), h("2026-10-01"), h(null)], today)).toEqual({
      overdue: 2,
      next: { dueDate: "2026-10-01", days: 0 },
    })
  })

  it("leaves out done entries and AI suggestions not yet accepted", () => {
    expect(deadlineStats([h("2026-09-20", { done: true }), h("2026-10-05", { accepted: false })], today)).toEqual({
      overdue: 0,
      next: null,
    })
  })
})
