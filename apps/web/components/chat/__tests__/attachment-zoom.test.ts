import { describe, expect, it } from "vitest"
import { isZoomableAttachment } from "../attachment-preview"

const file = (name: string, mimeType: string | null = null) => ({ name, mimeType })

describe("isZoomableAttachment", () => {
  it("scales the formats the preview draws itself", () => {
    for (const name of ["photo.png", "scan.JPG", "contract.docx", "budget.xlsx", "old-letter.doc"]) {
      expect(isZoomableAttachment(file(name)), name).toBe(true)
    }
  })

  it("leaves PDFs to the browser's own viewer zoom", () => {
    expect(isZoomableAttachment(file("agreement.pdf"))).toBe(false)
    expect(isZoomableAttachment(file("agreement", "application/pdf"))).toBe(false)
  })

  it("has no zoom for audio, video or unsupported files", () => {
    for (const name of ["call.mp3", "clip.mp4", "slides.pptx", "legacy.xls"]) {
      expect(isZoomableAttachment(file(name)), name).toBe(false)
    }
  })
})
