import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { ReasoningPanel } from "../reasoning-panel"

// The text is the "How I got this" box as the sample case on uk-dev printed it: the legal persona's
// markdown emphasis (`*BPY v MXV*`) showed as literal asterisks.
const reasoning = {
  reasoning:
    "I looked up relevant English authorities. The Arbitration Act 1996 provides the framework. The case *BPY v MXV* illustrates how procedural rules can be flexible, so Meridian should cite **section 34**.",
  citationReasons: [
    { title: "Arbitration Act 1996, section 34", why_cited: "It grants the tribunal control over procedural matters." },
    { title: "*BPY v MXV* [2023] EWHC (Comm) 82", why_cited: "It emphasizes the importance of *procedural flexibility* for fair dispute resolution." },
  ],
} as never

describe("ReasoningPanel", () => {
  const html = renderToStaticMarkup(createElement(ReasoningPanel, { reasoning }))

  it("prints the words, not the markdown marks around them", () => {
    expect(html).not.toContain("*")
    expect(html).toContain("The case BPY v MXV illustrates how procedural rules can be flexible")
    expect(html).toContain("BPY v MXV [2023] EWHC (Comm) 82")
    expect(html).toContain("cite section 34.")
    expect(html).toContain("for fair dispute resolution")
  })

  it("renders nothing when there is no reasoning", () => {
    expect(renderToStaticMarkup(createElement(ReasoningPanel, { reasoning: undefined }))).toBe("")
  })
})
