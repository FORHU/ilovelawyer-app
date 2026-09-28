import { describe, it, expect } from "vitest"
import { isInternalLibraryHref, parseLibraryHref } from "../internal-library-link"

describe("isInternalLibraryHref", () => {
  it("accepts the Library laws detail route", () => {
    expect(isInternalLibraryHref("/homepage/library/laws/abc-123?category=uk-legislation")).toBe(true)
  })

  it("rejects an external URL", () => {
    expect(isInternalLibraryHref("https://www.legislation.gov.uk/ukpga/1967/87")).toBe(false)
  })

  it("rejects a different internal route", () => {
    expect(isInternalLibraryHref("/homepage/library/documents/abc-123")).toBe(false)
  })

  it("rejects null and undefined without throwing", () => {
    expect(isInternalLibraryHref(null)).toBe(false)
    expect(isInternalLibraryHref(undefined)).toBe(false)
  })

  it("rejects an empty string", () => {
    expect(isInternalLibraryHref("")).toBe(false)
  })
})

describe("parseLibraryHref", () => {
  it("splits a UK href into its category and Law.id", () => {
    expect(parseLibraryHref("/homepage/library/laws/abc-123?category=uk-legislation")).toEqual({
      category: "uk-legislation",
      id: "abc-123",
    })
  })

  it("decodes a percent-encoded juris.ph id", () => {
    expect(parseLibraryHref("/homepage/library/laws/gr%2012345?category=jurisprudence")).toEqual({
      category: "jurisprudence",
      id: "gr 12345",
    })
  })

  it("defaults a missing category to jurisprudence, like the detail page", () => {
    expect(parseLibraryHref("/homepage/library/laws/abc")?.category).toBe("jurisprudence")
  })

  it("rejects an unknown category", () => {
    expect(parseLibraryHref("/homepage/library/laws/abc?category=statutes")).toBeNull()
  })

  it("rejects a non-Library href and a Library href with no id", () => {
    expect(parseLibraryHref("https://juris.ph/case/123")).toBeNull()
    expect(parseLibraryHref("/homepage/library/laws/")).toBeNull()
  })
})
