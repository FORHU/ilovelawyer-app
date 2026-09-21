import { describe, it, expect } from "vitest"
import { displayDocumentLabel, isUuidLike } from "../document-label"

const FILE_ID = "5dee588a-2398-4452-9f02-01e21b90bf93"

describe("isUuidLike", () => {
  it("recognises a file id, in any case and with surrounding space", () => {
    expect(isUuidLike(FILE_ID)).toBe(true)
    expect(isUuidLike(`  ${FILE_ID.toUpperCase()}  `)).toBe(true)
  })

  it("does not treat names, short codes, partial ids or empty values as ids", () => {
    for (const v of ["Letter before claim.pdf", "D01", "5dee588a", "", null, undefined]) {
      expect(isUuidLike(v)).toBe(false)
    }
  })
})

describe("displayDocumentLabel", () => {
  it("shows a file name as written", () => {
    expect(displayDocumentLabel("Letter before claim.pdf", "Document")).toBe("Letter before claim.pdf")
    expect(displayDocumentLabel("  D01_Report.pdf ", "Document")).toBe("D01_Report.pdf")
  })

  it("never shows a raw id: the exact case from the bug report (the evidence label is the file id)", () => {
    expect(displayDocumentLabel(FILE_ID, "Document")).toBe("Document")
  })

  it("uses the fallback for an empty or missing label", () => {
    expect(displayDocumentLabel("", "Document")).toBe("Document")
    expect(displayDocumentLabel(undefined, "Document")).toBe("Document")
    expect(displayDocumentLabel(null, "Document")).toBe("Document")
  })

  it("uses the caller's (translated) fallback text", () => {
    expect(displayDocumentLabel(FILE_ID, "Dokumento")).toBe("Dokumento")
  })
})
