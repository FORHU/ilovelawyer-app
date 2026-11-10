// Renders the real AssistantMessage with Confidence view on/off. Named .spec.ts like
// citation-rank-render.spec.ts (the default `vitest run` has no JSX support). Run with:
//   npx vitest run -c vitest.render.config.ts
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, describe, expect, it, vi } from "vitest"
import AssistantMessage from "../assistant-message"

// Server rendering reads a zustand store's INITIAL state (so SSR and hydration agree), which makes
// setState invisible to renderToStaticMarkup. Swap in a tiny controllable store for this test.
const view = vi.hoisted(() => ({ on: false }))
vi.mock("@/lib/store/confidence-view.store", () => ({
  useConfidenceViewStore: <T,>(selector: (s: { on: boolean }) => T) => selector({ on: view.on }),
}))
import type { ConfidenceSpan } from "@/lib/chat/confidence"
import type { DecisionRecordPayload } from "@/lib/terminal/types"

const HREF = "/homepage/library/laws/64d885b2-dc5a-4a67-8ba7-0d1757659a5a?category=uk-legislation"
const CONTENT = [
  "## The test",
  "",
  "The usual limit is **three years** from the date of knowledge.",
  "",
  `The court will apply it strictly. [Limitation Act 1980, s 11 Law](${HREF})`,
  "",
  "- Keep every letter you receive.",
].join("\n")

const SPANS: ConfidenceSpan[] = [
  { quote: "The test", tier: "SOURCED", source: "provenance", why: "64% of its distinctive terms appear in the available sources" },
  { quote: "The usual limit is three years from the date of knowledge.", tier: "QUOTED", source: "provenance", why: "near-verbatim match" },
  { quote: "The court will apply it strictly.", tier: "SOURCED", source: "provenance", why: "52%" },
  { quote: "Keep every letter you receive.", tier: "UNSOURCED", source: "provenance", why: "no source" },
  { quote: "Limitation Act 1980, s 11 Law", tier: "QUOTED", source: "citation", ref: HREF, why: "citation link resolves" },
]

// A decision anchor that sits inside a shaded sentence (assistant-message.tsx's mark renderer
// must keep it clickable).
const DECISION = {
  anchor: "The court will apply it strictly.",
  wouldChangeIf: [],
  evidenceFor: [],
  evidenceAgainst: [],
} as unknown as DecisionRecordPayload

function render(on: boolean, props: Partial<React.ComponentProps<typeof AssistantMessage>> = {}) {
  view.on = on
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(AssistantMessage, {
        content: CONTENT,
        confidenceSpans: SPANS,
        confidenceTurnIndex: 3,
        ...props,
      }),
    ),
  )
}

// Visible text only: screen-reader-only notes (the ringed link's "quoted from a source") are
// deliberately added while the view is on.
const textOf = (html: string) => html.replace(/<span class="sr-only">[^<]*<\/span>/g, "").replace(/<[^>]+>/g, "")

afterEach(() => {
  view.on = false
})

describe("AssistantMessage with Confidence view", () => {
  it("shows no shading while the view is off", () => {
    const html = render(false)
    expect(html).not.toContain("conf-span")
    expect(html).not.toContain("data-tier")
    expect(html).not.toContain("data-confidence")
  })

  it("shades every sentence with its tier when on, headings included", () => {
    const html = render(true)
    expect(html).toContain('data-tier="SOURCED"')
    expect(html).toContain('data-tier="QUOTED"')
    expect(html).toContain('data-tier="UNSOURCED"')
    expect(html).toMatch(/<mark[^>]*data-tier="SOURCED"[^>]*>The test<\/mark>/)
    expect(html).toContain('id="conf-3-1"')
  })

  it("keeps bold inside a shaded sentence, coloured like the sentence", () => {
    const html = render(true)
    expect(html).toMatch(/<strong class="font-bold"><mark[^>]*data-tier="QUOTED"[^>]*>three years<\/mark><\/strong>/)
  })

  it("rings the citation link instead of recolouring it, and never shades inside it", () => {
    const html = render(true)
    expect(html).toMatch(/data-confidence="QUOTED"[^>]*class="[^"]*ring-emerald-500/)
    expect(html).not.toMatch(/<a[^>]*>[^]*?<mark[^]*?<\/a>/)
  })

  it("keeps a decision anchor clickable inside a shaded sentence", () => {
    const html = render(true, { decisions: [DECISION], onOpenDecision: () => {}, messageIndex: 3 })
    // The anchor span carries the sentence (its trailing period stays outside, after the help icon).
    expect(html).toMatch(/<mark[^>]*data-tier="SOURCED"[^>]*><span[^>]*role="button"[^>]*>The court will apply it strictly/)
  })

  it("never changes the visible text", () => {
    expect(textOf(render(true))).toBe(textOf(render(false)))
  })

  it("renders nothing extra when the turn has no spans, even with the view on", () => {
    expect(render(true, { confidenceSpans: undefined })).toBe(render(false, { confidenceSpans: undefined }))
  })
})
