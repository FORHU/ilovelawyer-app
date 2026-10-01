// Renders real components with a real ranking. Named .spec.ts so the repo's default `vitest run`
// (which only matches *.test.ts and has no JSX support) does not pick it up. Run it with:
//   npx vitest run -c vitest.render.config.ts
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"
import AssistantMessage from "../assistant-message"
import { CitationRankNote } from "../citation-preview-card"
import type { CitationRankItem } from "@/lib/chat/mutations"

// The href below is the one the API stored for a real reply (Limitation Act 1980, UK).
const HREF = "/homepage/library/laws/64d885b2-dc5a-4a67-8ba7-0d1757659a5a?category=uk-legislation"
const CONTENT = `The usual limit is three years. [Limitation Act 1980, s 11 Law](${HREF}) Ask a lawyer.`

const item = (over: Partial<CitationRankItem> = {}): CitationRankItem => ({
  href: HREF,
  tier: "MEDIUM",
  relevance: "MEDIUM",
  importance: "HIGH",
  reason: "",
  namedByUser: false,
  ...over,
})

function renderMessage(citationRanking?: CitationRankItem[]) {
  return renderToStaticMarkup(
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(AssistantMessage, { content: CONTENT, citationRanking }),
    ),
  )
}

describe("CitationLink tier rendering", () => {
  it("renders the link with no rank attribute when the message has no ranking", () => {
    const html = renderMessage(undefined)
    expect(html).toContain("Limitation Act 1980, s 11")
    expect(html).not.toContain("data-rank")
  })

  it("marks the link with its tier when the ranking holds that exact href", () => {
    const html = renderMessage([item()])
    expect(html).toContain('data-rank="MEDIUM"')
    expect(html).toContain("decoration-dashed")
  })

  it("does not mark a link whose href differs from the ranking's", () => {
    expect(renderMessage([item({ href: HREF + "x", tier: "HIGH" })])).not.toContain("data-rank")
  })
})

describe("citation pill: kind badge and label", () => {
  const JURIS = "/homepage/library/laws/ph-123?category=jurisprudence"
  const renderContent = (content: string) =>
    renderToStaticMarkup(
      React.createElement(QueryClientProvider, { client: new QueryClient() }, React.createElement(AssistantMessage, { content })),
    )

  it("shows a Law badge and takes the duplicate ' Law' off the visible label", () => {
    const html = renderMessage(undefined)
    expect(html).toContain('data-kind="law"')
    expect(html).toContain("citationBadge.law")
    expect(html).not.toContain("s 11 Law")
  })

  it("shows a Jurisprudence badge for a case and strips its suffix", () => {
    const html = renderContent(`See [Republic v. Gallo (2018) Jurisprudence](${JURIS}).`)
    expect(html).toContain('data-kind="jurisprudence"')
    expect(html).toContain("citationBadge.jurisprudence")
    expect(html).toContain("Republic v. Gallo (2018)")
    expect(html).not.toContain("(2018) Jurisprudence")
  })

  it("uses the italic serif pill style", () => {
    const html = renderMessage(undefined)
    expect(html).toContain("italic")
    expect(html).toContain("Source_Serif_4")
    expect(html).toContain("rounded-md")
  })

  it("gives a ranked link a badge in a deeper shade of its own tier colour", () => {
    const html = renderMessage([item({ tier: "HIGH" })])
    expect(html).toContain("bg-emerald-200")
    expect(html).toContain("bg-emerald-600")
    expect(html).toContain("citationBadge.law")
    expect(html).not.toContain("bg-sky-600")
  })

  it("uses blue for an unranked law and indigo for an unranked case, and never pink", () => {
    const law = renderMessage(undefined)
    expect(law).toContain("bg-sky-200")
    expect(law).toContain("bg-sky-600")
    const juris = renderContent(`See [X v. Y Jurisprudence](${JURIS}).`)
    expect(juris).toContain("bg-indigo-200")
    expect(juris).toContain("bg-indigo-600")
    expect(law + juris).not.toMatch(/pink|fuchsia/)
  })

  it("sets the citation text in bold with extra letter and word spacing for readability", () => {
    const html = renderMessage(undefined)
    expect(html).toContain("font-bold")
    expect(html).toContain("tracking-[0.02em]")
    expect(html).toContain("word-spacing:0.08em")
  })

  it("is a solid, saturated pill in dark mode and a deep badge in light mode", () => {
    const html = renderMessage([item({ tier: "HIGH" })])
    expect(html).toContain("dark:bg-emerald-800")
    expect(html).toContain("dark:text-white")
    expect(html).toContain("bg-emerald-600 text-white")
  })
})

describe("CitationRankNote (the hover explanation)", () => {
  const render = (rank: CitationRankItem) => renderToStaticMarkup(React.createElement(CitationRankNote, { rank }))

  it("explains both relevance and importance, and carries the disclaimer", () => {
    const html = render(item({ relevance: "HIGH", importance: "MEDIUM" }))
    expect(html).toContain("citationRank.relevance.high")
    expect(html).toContain("citationRank.importance.medium")
    expect(html).toContain("citationRank.disclaimer")
  })

  it("shows the facts the levels cannot carry", () => {
    expect(render(item({ reason: "You named it in your question · Court of Appeal" }))).toContain("You named it in your question · Court of Appeal")
  })

  it("leaves out an axis Jev gave no usable verdict for, and an empty reason", () => {
    const html = render(item({ relevance: "HIGH", importance: null, reason: "" }))
    expect(html).toContain("citationRank.relevance.high")
    expect(html).not.toContain("citationRank.importance")
  })
})
