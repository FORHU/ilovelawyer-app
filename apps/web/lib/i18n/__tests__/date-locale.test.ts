import { describe, it, expect } from "vitest"
import { dateLocaleFor } from "../date-locale"

describe("dateLocaleFor", () => {
  it("formats English on the UK site as en-GB — day before month", () => {
    expect(dateLocaleFor("en", "UK")).toBe("en-GB")
    const date = new Date(Date.UTC(2026, 9, 2))
    expect(date.toLocaleDateString(dateLocaleFor("en", "UK"), { timeZone: "UTC" })).toBe("02/10/2026")
  })

  it("uses en-PH on the PH site", () => {
    expect(dateLocaleFor("en", "PH")).toBe("en-PH")
  })

  it("keeps Korean and Tagalog in their own locale", () => {
    expect(dateLocaleFor("ko", "UK")).toBe("ko")
    expect(dateLocaleFor("tl", "PH")).toBe("tl")
  })

  it("leaves the browser default when the tenant is unknown", () => {
    expect(dateLocaleFor("en", null)).toBeUndefined()
  })
})
