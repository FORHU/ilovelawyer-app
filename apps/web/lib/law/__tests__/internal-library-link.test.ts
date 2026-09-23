import { describe, it, expect } from "vitest"
import { isInternalLibraryHref } from "../internal-library-link"

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
