import { describe, expect, it } from "vitest"
import { convertHtmlAnchors } from "../html-anchors"

describe("convertHtmlAnchors", () => {
  it("turns a Chat Wonder legal-ref anchor into a markdown link", () => {
    const input =
      'remain unpleaded. <a href="https://www.legislation.gov.uk/ukpga/1980/58/section/5" class="legal-ref law" target="_blank">Limitation Act 1980, s 5 Law</a>'
    expect(convertHtmlAnchors(input)).toBe(
      "remain unpleaded. [Limitation Act 1980, s 5 Law](https://www.legislation.gov.uk/ukpga/1980/58/section/5)",
    )
  })

  it("converts every anchor in the text", () => {
    const input = '<a href="/a">A</a> and <a class="legal-ref jurisprudence" href="/b">B</a>'
    expect(convertHtmlAnchors(input)).toBe("[A](/a) and [B](/b)")
  })

  it("leaves text without anchors untouched", () => {
    const input = "See [Limitation Act 1980](https://www.legislation.gov.uk/ukpga/1980/58) for detail."
    expect(convertHtmlAnchors(input)).toBe(input)
  })
})
