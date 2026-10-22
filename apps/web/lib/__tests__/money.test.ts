import { describe, it, expect } from "vitest"
import { formatMoney } from "../money"

describe("formatMoney", () => {
  it("formats pence as a GBP string", () => {
    expect(formatMoney(8000)).toBe("£80.00")
    expect(formatMoney(0)).toBe("£0.00")
    expect(formatMoney(14950)).toBe("£149.50")
  })
})
