import { describe, expect, it } from "vitest"
import { claimEndedKey } from "../claim-ended"

describe("claimEndedKey", () => {
  it("is null while the lawyer's claim is open or engaged, or isn't theirs", () => {
    expect(claimEndedKey(null)).toBe(null)
    expect(claimEndedKey({ byMe: true, outcome: null })).toBe(null)
    expect(claimEndedKey({ byMe: true, outcome: "ENGAGED" })).toBe(null)
    expect(claimEndedKey({ byMe: false, outcome: "LAPSED" })).toBe(null)
  })

  it("names how their claim ended, so the page doesn't show the request as still open to them", () => {
    expect(claimEndedKey({ byMe: true, outcome: "NOT_CHOSEN" })).toBe("detail.notChosen")
    for (const outcome of ["RELEASED", "LAPSED", "DECLINED", "WITHDRAWN", "REASSIGNED"] as const) {
      expect(claimEndedKey({ byMe: true, outcome })).toBe(`detail.ended.${outcome}`)
    }
  })
})
