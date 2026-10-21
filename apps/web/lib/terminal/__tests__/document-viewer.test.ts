import { describe, it, expect } from "vitest"
import {
  MAX_QUOTE_LENGTH,
  documentViewerHref,
  findViewerDocument,
  normalizePage,
  normalizeQuote,
  parseViewerParams,
} from "../document-viewer"

const docs = [
  { id: "a1", name: "22_POLICE_Phone_Records.pdf" },
  { id: "b2", name: "19_DEFENSE_Proof_of_Evidence.pdf" },
]

describe("documentViewerHref", () => {
  it("links by id, carrying the name as a fallback", () => {
    expect(documentViewerHref("c1", { docId: "a1", doc: "22_POLICE_Phone_Records.pdf" })).toBe(
      "/homepage/terminal/c1/document?id=a1&name=22_POLICE_Phone_Records.pdf",
    )
  })

  it("links by name alone when the record has no id", () => {
    expect(documentViewerHref("c1", { docId: null, doc: "Report.pdf" })).toBe("/homepage/terminal/c1/document?name=Report.pdf")
  })

  it("has nothing to link when there is neither an id nor a real name", () => {
    expect(documentViewerHref("c1", { docId: null, doc: "" })).toBeNull()
    expect(documentViewerHref("c1", { docId: null, doc: "0f8fad5b-d9cb-469f-a165-70867728950e" })).toBeNull()
  })
})

describe("documentViewerHref with a page and quote", () => {
  const href = (extra: object) => documentViewerHref("c1", { docId: "a1", doc: "Bundle.pdf", ...extra })

  it("carries the page and quote after the document", () => {
    expect(href({ page: 31, quote: "closed on 3 November 2023" })).toBe(
      "/homepage/terminal/c1/document?id=a1&name=Bundle.pdf&page=31&q=closed+on+3+November+2023",
    )
  })

  it("carries the source's own label for the spot", () => {
    expect(href({ page: 31, label: "D13 p.2" })).toContain("loc=D13+p.2")
  })

  it("leaves old links unchanged when there is no page or quote", () => {
    expect(href({})).toBe("/homepage/terminal/c1/document?id=a1&name=Bundle.pdf")
    expect(href({ page: null, quote: null, label: null })).toBe("/homepage/terminal/c1/document?id=a1&name=Bundle.pdf")
  })

  it("drops a page that is not a positive whole number", () => {
    for (const page of [0, -3, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(href({ page })).not.toContain("page=")
    }
  })

  it("trims, collapses and caps the quote", () => {
    expect(href({ quote: "  two \n  lines  " })).toContain("q=two+lines")
    expect(href({ quote: "   " })).not.toContain("q=")
    const long = href({ quote: "a".repeat(MAX_QUOTE_LENGTH + 100) })
    expect(new URL(long!, "http://x").searchParams.get("q")).toHaveLength(MAX_QUOTE_LENGTH)
  })

  it("still has nothing to link when there is no document to name", () => {
    expect(documentViewerHref("c1", { docId: null, doc: "", page: 2, quote: "x" })).toBeNull()
  })
})

describe("parseViewerParams", () => {
  const parse = (href: string) => parseViewerParams(new URL(href, "http://x").searchParams)

  it("reads back what documentViewerHref wrote, including awkward characters", () => {
    const quote = "Paid £4,500 & \"agreed\" #1 — café?"
    const link = documentViewerHref("c1", { docId: "a1", doc: "Bundle & Co.pdf", page: 7, quote, label: "D13 p.2" })!
    expect(parse(link)).toEqual({ id: "a1", name: "Bundle & Co.pdf", page: 7, quote, label: "D13 p.2" })
  })

  it("reads an old link as having no page or quote", () => {
    expect(parse("/d?id=a1&name=X.pdf")).toEqual({ id: "a1", name: "X.pdf", page: null, quote: null, label: null })
  })

  it("ignores a page that is not a positive whole number", () => {
    for (const page of ["0", "-1", "2.5", "abc", "", "1e3"]) {
      expect(parse(`/d?id=a1&page=${page}`).page).toBeNull()
    }
    expect(parse("/d?id=a1&page=12").page).toBe(12)
  })

  it("caps an over-long quote in a hand-edited link", () => {
    expect(parse(`/d?id=a1&q=${"b".repeat(1000)}`).quote).toHaveLength(MAX_QUOTE_LENGTH)
  })
})

describe("normalizePage / normalizeQuote", () => {
  it("accepts numbers and numeric strings", () => {
    expect(normalizePage(4)).toBe(4)
    expect(normalizePage("4")).toBe(4)
    expect(normalizePage(" 4 ")).toBe(4)
    expect(normalizePage(undefined)).toBeNull()
  })

  it("turns a non-string quote into nothing", () => {
    expect(normalizeQuote(null)).toBeNull()
    expect(normalizeQuote(42)).toBeNull()
  })
})

describe("findViewerDocument", () => {
  it("prefers the id, then falls back to a case-insensitive name match", () => {
    expect(findViewerDocument(docs, { id: "b2", name: "22_POLICE_Phone_Records.pdf" })?.id).toBe("b2")
    expect(findViewerDocument(docs, { id: "gone", name: " 22_police_phone_records.PDF " })?.id).toBe("a1")
  })

  it("finds nothing for an unknown document", () => {
    expect(findViewerDocument(docs, { id: "gone", name: "Other.pdf" })).toBeUndefined()
    expect(findViewerDocument(docs, { id: null, name: null })).toBeUndefined()
  })
})
