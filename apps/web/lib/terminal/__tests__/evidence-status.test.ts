import { describe, it, expect } from "vitest"
import { countByStatus, documentSizeLabel, ingestTone, timelineDotTone } from "../evidence-status"
import { fileTypeIcon, isSpreadsheet } from "@/lib/cases/file-type-icon"
import { File, FileImage, FileSpreadsheet, FileText, Mail } from "lucide-react"

describe("ingestTone / countByStatus", () => {
  it("maps READY and FAILED, and treats anything else as pending", () => {
    expect(ingestTone("READY")).toBe("ready")
    expect(ingestTone("FAILED")).toBe("failed")
    expect(ingestTone("PENDING")).toBe("pending")
    expect(ingestTone(null)).toBe("pending")
  })

  it("counts documents per status", () => {
    const docs = ["READY", "PENDING", "READY", "FAILED", "READY", "PENDING"].map((ragStatus) => ({ ragStatus }))
    expect(countByStatus(docs)).toEqual({ ready: 3, pending: 2, failed: 1 })
  })
})

describe("timelineDotTone", () => {
  const docs = new Map([
    ["a", { ragStatus: "READY" }],
    ["b", { ragStatus: "PENDING" }],
  ])

  it("takes the source document's status", () => {
    expect(timelineDotTone("a", docs)).toBe("ready")
    expect(timelineDotTone("b", docs)).toBe("pending")
  })

  it("is 'none' with no source document or one that no longer resolves", () => {
    expect(timelineDotTone(null, docs)).toBe("none")
    expect(timelineDotTone("deleted", docs)).toBe("none")
  })
})

describe("fileTypeIcon", () => {
  it("uses the MIME type first", () => {
    expect(fileTypeIcon({ mimeType: "application/pdf", name: "x" })).toBe(FileText)
    expect(fileTypeIcon({ mimeType: "image/png", name: "x" })).toBe(FileImage)
    expect(
      fileTypeIcon({ mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", name: "x" }),
    ).toBe(FileSpreadsheet)
  })

  it("falls back to the extension when the MIME type is blank", () => {
    expect(fileTypeIcon({ mimeType: null, name: "payroll.xlsx" })).toBe(FileSpreadsheet)
    expect(fileTypeIcon({ mimeType: "", name: "thread.eml" })).toBe(Mail)
    expect(fileTypeIcon({ mimeType: null, name: "letter.DOCX" })).toBe(FileText)
  })

  it("uses a generic file icon otherwise", () => {
    expect(fileTypeIcon({ mimeType: "application/zip", name: "a.zip" })).toBe(File)
  })

  it("detects spreadsheets", () => {
    expect(isSpreadsheet({ mimeType: null, name: "a.csv" })).toBe(true)
    expect(isSpreadsheet({ mimeType: "application/pdf", name: "a.pdf" })).toBe(false)
  })
})

describe("documentSizeLabel", () => {
  const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  it("uses the worksheet count for spreadsheets, one sheet when unknown or 1", () => {
    expect(documentSizeLabel({ name: "a.xlsx", mimeType: xlsx, pageCount: 3 })).toEqual({ key: "sheetCount", n: 3 })
    expect(documentSizeLabel({ name: "a.xlsx", mimeType: xlsx, pageCount: 1 })).toEqual({ key: "sheetLabel" })
    expect(documentSizeLabel({ name: "a.xlsx", mimeType: xlsx, pageCount: null })).toEqual({ key: "sheetLabel" })
  })
  it("shows pages for other documents and nothing when the count is unknown", () => {
    expect(documentSizeLabel({ name: "a.pdf", mimeType: "application/pdf", pageCount: 12 })).toEqual({ key: "pageCountShort", n: 12 })
    expect(documentSizeLabel({ name: "a.pdf", mimeType: "application/pdf", pageCount: null })).toBeNull()
  })
})

describe("timelineDotTone with an archived document", () => {
  it("is none when the id is not in the active-only documents map", () => {
    expect(timelineDotTone("archived-doc", new Map([["other", { ragStatus: "READY" }]]))).toBe("none")
  })
})
