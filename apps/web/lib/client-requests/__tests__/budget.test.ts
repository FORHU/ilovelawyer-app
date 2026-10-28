import { describe, expect, it } from "vitest"
import { budgetChip } from "../budget"

describe("budgetChip", () => {
  it("is null when the client set no budget, including on a brief written before budgets", () => {
    expect(budgetChip(null)).toBe(null)
    expect(budgetChip(undefined)).toBe(null)
  })

  it("names a range, an open top, a capped bottom and the client's own amount", () => {
    expect(budgetChip({ minMinor: 50_000, maxMinor: 150_000, feePreference: null })).toEqual({ amount: { key: "range", values: { min: "£500", max: "£1,500" } }, fee: null })
    expect(budgetChip({ minMinor: 500_000, maxMinor: null, feePreference: null })!.amount).toEqual({ key: "over", values: { min: "£5,000" } })
    expect(budgetChip({ minMinor: 0, maxMinor: 50_000, feePreference: null })!.amount).toEqual({ key: "under", values: { max: "£500" } })
    expect(budgetChip({ minMinor: 275_050, maxMinor: 275_050, feePreference: null })!.amount).toEqual({ key: "amount", values: { amount: "£2,750.50" } })
  })

  it("carries the fee preference, with or without an amount", () => {
    expect(budgetChip({ minMinor: 50_000, maxMinor: 150_000, feePreference: "FIXED_FEE" })!.fee).toBe("fixedFee")
    expect(budgetChip({ minMinor: null, maxMinor: null, feePreference: "FIRST_CONSULTATION" })).toEqual({ amount: null, fee: "firstConsultation" })
  })
})
