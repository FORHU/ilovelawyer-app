import { describe, expect, it } from "vitest"
import { plainEmphasis } from "../plain-emphasis"

describe("plainEmphasis", () => {
  it("drops the marks around an italic case name and keeps the words", () => {
    expect(plainEmphasis("*BPY v MXV* [2023] EWHC (Comm) 82")).toBe("BPY v MXV [2023] EWHC (Comm) 82")
  })

  it("drops bold marks too", () => {
    expect(plainEmphasis("Arbitration Act 1996, **section 34** applies")).toBe("Arbitration Act 1996, section 34 applies")
  })

  it("handles several pairs in one line", () => {
    expect(plainEmphasis("The case *BPY v MXV* and *Wood v Capita* illustrate it.")).toBe("The case BPY v MXV and Wood v Capita illustrate it.")
  })

  it("leaves a lone asterisk and text without emphasis alone", () => {
    expect(plainEmphasis("Footnote*")).toBe("Footnote*")
    expect(plainEmphasis("A 5 * 3 sum")).toBe("A 5 * 3 sum")
    expect(plainEmphasis("Plain text")).toBe("Plain text")
  })

  it("does not join emphasis across lines", () => {
    expect(plainEmphasis("*one\ntwo*")).toBe("*one\ntwo*")
  })
})
