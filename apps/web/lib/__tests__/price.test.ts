import { describe, it, expect } from "vitest"
import { currencyDecimals, formatAmount, formatPrice, toMajor } from "../money"

describe("plan prices", () => {
  it("knows won has no decimals and dollars have two", () => {
    expect(currencyDecimals("KRW")).toBe(0)
    expect(currencyDecimals("USD")).toBe(2)
  })

  it("reads a minor-unit amount in its own currency", () => {
    expect(toMajor({ amountMinor: 2000, currency: "USD" })).toBe(20)
    expect(toMajor({ amountMinor: 29_000, currency: "KRW" })).toBe(29_000)
  })

  it("shows a dollar plan without cents unless it has some", () => {
    expect(formatPrice({ amountMinor: 2000, currency: "USD" })).toBe("$20")
    expect(formatPrice({ amountMinor: 2050, currency: "USD" })).toBe("$20.50")
  })

  it("shows a won plan in whole won, in Korean or English", () => {
    expect(formatPrice({ amountMinor: 29_000, currency: "KRW" }, { locale: "ko-KR" })).toBe("₩29,000")
    expect(formatPrice({ amountMinor: 139_000, currency: "KRW" })).toBe("₩139,000")
  })

  it("shows a charge with cents for dollars and none for won", () => {
    expect(formatAmount(15, "USD", { cents: true })).toBe("$15.00")
    expect(formatAmount(40_000, "KRW", { locale: "ko-KR", cents: true })).toBe("₩40,000")
  })
})
