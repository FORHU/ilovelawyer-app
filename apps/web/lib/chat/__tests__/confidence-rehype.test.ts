import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { describe, expect, it } from "vitest"
import { rehypeConfidence } from "../confidence-rehype"
import {
  citationConfidenceByHref,
  confidenceSpanElementId,
  confidenceSpansOf,
  countConfidence,
  type ConfidenceSpan,
} from "../confidence"

// Rendered through the same ReactMarkdown + remark-gfm pipeline assistant-message.tsx uses.
function render(markdown: string, spans: ConfidenceSpan[], idFor?: (i: number) => string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm], rehypePlugins: [[rehypeConfidence, { spans, idFor }]] },
      markdown,
    ),
  )
}

const span = (quote: string, tier: ConfidenceSpan["tier"] = "SOURCED", why = "why"): ConfidenceSpan => ({
  quote,
  tier,
  source: "provenance",
  why,
})

const textOf = (html: string) => html.replace(/<[^>]+>/g, "")

describe("rehypeConfidence", () => {
  it("shades a plain sentence with its tier and reason", () => {
    const html = render("The employee must have two years' service.", [span("The employee must have two years' service.", "QUOTED", "verbatim")])
    expect(html).toContain('<mark class="conf-span" data-tier="QUOTED" title="verbatim">')
  })

  it("shades a sentence that crosses bold, without splitting the <strong>", () => {
    const md = "The leading case is **Davis Contractors v Fareham** from 1956."
    const html = render(md, [span("The leading case is Davis Contractors v Fareham from 1956.")])
    expect(html).toMatch(/<mark[^>]*>The leading case is <\/mark><strong><mark[^>]*>Davis Contractors v Fareham<\/mark><\/strong><mark[^>]*> from 1956\.<\/mark>/)
  })

  it("shades headings, nested list items and ordered list items", () => {
    const md = "## Overview\n\n- Outer item text.\n  - Nested item text.\n\n1. Ordered item text."
    const html = render(md, [span("Overview"), span("Outer item text."), span("Nested item text."), span("Ordered item text.")])
    expect((html.match(/class="conf-span"/g) ?? []).length).toBe(4)
    // The outer <li> owns only its own text: the nested item is not swallowed into its mark.
    expect(html).toMatch(/<mark[^>]*>Outer item text\.<\/mark>/)
  })

  it("shades a blockquote's paragraph inside the paragraph, never around it", () => {
    const md = "> “…frustration occurs whenever the law recognises **that** without default.”"
    const html = render(md, [span("“…frustration occurs whenever the law recognises that without default.”", "QUOTED")])
    expect(html).toContain("<blockquote>")
    expect(html).not.toMatch(/<mark[^>]*>\s*<p>/)
    expect(html).toMatch(/<p><mark/)
  })

  it("never wraps link text, but matches the prose around a link", () => {
    // chat-wonder drops markdown links from the sentence it sends, so the quote has no label.
    const md = "This test appears in [Gold Group [2010] EWHC 323](https://example.org/case) ."
    const html = render(md, [span("This test appears in .")])
    expect(html).toMatch(/<a href="https:\/\/example\.org\/case">Gold Group \[2010\] EWHC 323<\/a>/)
    expect(html).not.toMatch(/<a[^>]*>[^<]*<mark/)
    expect(html).toContain("<mark")
  })

  it("lets the longer quote win when a short one is contained in it", () => {
    const md = "Payment is due. Payment is due within thirty days of delivery."
    const html = render(md, [span("Payment is due.", "UNSOURCED"), span("Payment is due within thirty days of delivery.", "QUOTED")])
    expect(html).toContain('data-tier="QUOTED" title="why">Payment is due within thirty days of delivery.</mark>')
    expect(html).toContain('data-tier="UNSOURCED" title="why">Payment is due.</mark>')
  })

  it("shades both copies of a sentence that appears twice", () => {
    const md = "Seek advice.\n\nSeek advice."
    const html = render(md, [span("Seek advice."), span("Seek advice.")])
    expect((html.match(/<mark/g) ?? []).length).toBe(2)
  })

  it("matches across soft line breaks", () => {
    const html = render("A contract may end\nby mutual agreement.", [span("A contract may end by mutual agreement.")])
    expect(html).toContain("<mark")
  })

  it("leaves text untouched when nothing matches, and never changes the visible text", () => {
    const md = "## Title\n\nSome **bold** text with a [link](https://x.org/a).\n\n- one\n- two"
    const plain = render(md, [])
    const shaded = render(md, [span("Title"), span("Some bold text with a ."), span("one"), span("not in the answer")])
    expect(textOf(shaded)).toBe(textOf(plain))
    expect(render(md, [span("not in the answer")])).toBe(plain)
  })

  it("puts the span id on the first <mark> only", () => {
    const md = "Before **bold** after."
    const html = render(md, [span("Before bold after.")], (i) => confidenceSpanElementId(7, i))
    expect((html.match(/id="conf-7-0"/g) ?? []).length).toBe(1)
  })

  it("ignores citation spans (links are styled by href, not shaded)", () => {
    const md = "See [Act 1996](https://example.org/act)."
    const html = render(md, [{ quote: "Act 1996", tier: "QUOTED", source: "citation", ref: "https://example.org/act" }])
    expect(html).not.toContain("<mark")
  })
})

describe("confidence helpers", () => {
  it("accepts only schema v1 with valid tiers", () => {
    expect(confidenceSpansOf(null)).toEqual([])
    expect(confidenceSpansOf({ v: 2, spans: [span("x")] })).toEqual([])
    expect(confidenceSpansOf({ v: 1, spans: [span("ok"), { quote: "bad", tier: "MAYBE" }, { tier: "QUOTED" }] })).toHaveLength(1)
  })

  it("counts tiers and keys citations by href", () => {
    const spans: ConfidenceSpan[] = [
      span("a", "QUOTED"),
      span("b", "SOURCED"),
      span("c", "UNSOURCED"),
      { quote: "Act", tier: "QUOTED", source: "citation", ref: "/library/act" },
    ]
    expect(countConfidence(spans)).toEqual({ QUOTED: 2, SOURCED: 1, UNSOURCED: 1, total: 4 })
    expect(citationConfidenceByHref(spans).get("/library/act")?.tier).toBe("QUOTED")
  })
})
