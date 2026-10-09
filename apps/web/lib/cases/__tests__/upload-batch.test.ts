import { describe, expect, it } from "vitest"
import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  isWithinSizeLimit,
  maxFileSizeBytes,
  oversizedFilesLabel,
} from "@/lib/cases/upload-batch"

/** A File that reports `size` without allocating it. */
const file = (name: string, size: number) => {
  const f = new File([], name)
  Object.defineProperty(f, "size", { value: size })
  return f
}

describe("upload size limits — mirror ilovelawyer-api's DOCUMENT_MAX_BYTES / IMAGE_DOCUMENT_MAX_BYTES", () => {
  it("gives documents and media the document cap", () => {
    expect(maxFileSizeBytes(file("bundle.pdf", 0))).toBe(MAX_FILE_SIZE_BYTES)
    expect(maxFileSizeBytes(file("hearing.mp4", 0))).toBe(MAX_FILE_SIZE_BYTES)
  })

  it("gives images the smaller OCR cap, whatever the extension's case", () => {
    expect(maxFileSizeBytes(file("scan.jpg", 0))).toBe(MAX_IMAGE_FILE_SIZE_BYTES)
    expect(maxFileSizeBytes(file("SCAN.PNG", 0))).toBe(MAX_IMAGE_FILE_SIZE_BYTES)
  })

  it("allows a file exactly at its cap and refuses one byte over", () => {
    expect(isWithinSizeLimit(file("bundle.pdf", MAX_FILE_SIZE_BYTES))).toBe(true)
    expect(isWithinSizeLimit(file("bundle.pdf", MAX_FILE_SIZE_BYTES + 1))).toBe(false)
    expect(isWithinSizeLimit(file("scan.png", MAX_IMAGE_FILE_SIZE_BYTES + 1))).toBe(false)
  })

  it("names each oversized file with its own limit", () => {
    expect(oversizedFilesLabel([file("bundle.pdf", 0), file("scan.png", 0)])).toBe(
      "bundle.pdf (25MB limit), scan.png (5MB limit)",
    )
  })
})
