import { describe, expect, it } from "vitest"
import { QUOTE_MAX_VALIDITY_DAYS, dateInputValue, endOfDayIso } from "@/lib/client-requests/quote-terms"

const DAY_MS = 24 * 60 * 60 * 1000

describe("endOfDayIso", () => {
  it("is the end of the chosen day", () => {
    const now = new Date(2026, 10, 3, 10, 0, 0)
    expect(endOfDayIso(dateInputValue(7, now), now)).toBe(new Date(2026, 10, 10, 23, 59, 59).toISOString())
  })

  it("keeps the picker's last day within the API's limit of the maximum days from now", () => {
    const now = new Date(2026, 10, 3, 10, 0, 0)
    const iso = endOfDayIso(dateInputValue(QUOTE_MAX_VALIDITY_DAYS, now), now)!
    expect(new Date(iso).getTime() - now.getTime()).toBe(QUOTE_MAX_VALIDITY_DAYS * DAY_MS)
  })

  it("is null for an empty or unreadable value", () => {
    expect(endOfDayIso("")).toBeNull()
    expect(endOfDayIso("3 Nov")).toBeNull()
  })
})
