import { afterEach, describe, expect, it, vi } from "vitest"
import {
  assertWithinBatchLimit,
  checkUploadSelection,
  formatBytes,
  MAX_BATCH_SIZE_BYTES,
  putFileToS3,
} from "@/lib/cases/upload-batch"

const MB = 1024 * 1024

/** A File that reports `size` without allocating it. */
function fakeFile(name: string, size: number): File {
  const file = new File([], name)
  Object.defineProperty(file, "size", { value: size })
  return file
}

describe("checkUploadSelection", () => {
  it("accepts a selection of exactly 1 GB", () => {
    const files = [fakeFile("a.pdf", MAX_BATCH_SIZE_BYTES / 2), fakeFile("b.pdf", MAX_BATCH_SIZE_BYTES / 2)]
    const result = checkUploadSelection(files)
    expect(result.batchTooLarge).toBe(false)
    expect(result.accepted).toEqual(files)
    expect(result.totalBytes).toBe(MAX_BATCH_SIZE_BYTES)
  })

  it("rejects the whole selection 1 byte over — nothing is accepted", () => {
    const files = [fakeFile("a.pdf", MAX_BATCH_SIZE_BYTES / 2), fakeFile("b.pdf", MAX_BATCH_SIZE_BYTES / 2 + 1)]
    const result = checkUploadSelection(files)
    expect(result.batchTooLarge).toBe(true)
    expect(result.accepted).toEqual([])
    expect(result.totalBytes).toBe(MAX_BATCH_SIZE_BYTES + 1)
  })

  it("has no per-file cap: one 900 MB file is accepted", () => {
    const result = checkUploadSelection([fakeFile("hearing.mp4", 900 * MB)])
    expect(result.batchTooLarge).toBe(false)
    expect(result.accepted).toHaveLength(1)
  })

  it("counts files already queued: 600 MB queued + 500 MB added is rejected", () => {
    const result = checkUploadSelection([fakeFile("b.pdf", 500 * MB)], 600 * MB)
    expect(result.batchTooLarge).toBe(true)
    expect(result.totalBytes).toBe(1100 * MB)
    expect(result.accepted).toEqual([])
  })

  it("drops unsupported types before taking the total", () => {
    const exe = fakeFile("setup.exe", 2 * MAX_BATCH_SIZE_BYTES)
    const pdf = fakeFile("brief.pdf", 10 * MB)
    const result = checkUploadSelection([exe, pdf])
    expect(result.unsupported).toEqual([exe])
    expect(result.batchTooLarge).toBe(false)
    expect(result.accepted).toEqual([pdf])
    expect(result.totalBytes).toBe(10 * MB)
  })

  it("allows zero-byte files", () => {
    const result = checkUploadSelection([fakeFile("empty.txt", 0)])
    expect(result.accepted).toHaveLength(1)
  })
})

describe("assertWithinBatchLimit", () => {
  it("throws only over 1 GB", () => {
    expect(() => assertWithinBatchLimit([fakeFile("a.pdf", MAX_BATCH_SIZE_BYTES)])).not.toThrow()
    expect(() => assertWithinBatchLimit([fakeFile("a.pdf", MAX_BATCH_SIZE_BYTES + 1)])).toThrow(/limit is 1 GB/)
  })
})

describe("formatBytes", () => {
  it("uses binary units", () => {
    expect(formatBytes(0)).toBe("0 B")
    expect(formatBytes(1536)).toBe("1.5 KB")
    expect(formatBytes(350 * MB)).toBe("350 MB")
    expect(formatBytes(1.4 * MAX_BATCH_SIZE_BYTES)).toBe("1.4 GB")
  })
})

describe("putFileToS3", () => {
  /** Minimal XMLHttpRequest stand-in: records the request, then plays back `script`. */
  class FakeXhr {
    static last: FakeXhr
    static script: (xhr: FakeXhr) => void
    method = ""
    url = ""
    headers: Record<string, string> = {}
    status = 0
    responseText = ""
    upload: { onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null } = {
      onprogress: null,
    }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    open(method: string, url: string) {
      this.method = method
      this.url = url
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value
    }
    send() {
      FakeXhr.last = this
      FakeXhr.script(this)
    }
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("PUTs with the signed Content-Type and reports progress up to 1", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    FakeXhr.script = (xhr) => {
      xhr.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 })
      xhr.status = 200
      xhr.onload?.()
    }
    const progress: number[] = []
    await putFileToS3("https://s3.example/k", fakeFile("a.pdf", 100), "application/pdf", (f) => progress.push(f))

    expect(FakeXhr.last.method).toBe("PUT")
    expect(FakeXhr.last.headers["Content-Type"]).toBe("application/pdf")
    expect(progress).toEqual([0.5, 1])
  })

  it("rejects with S3's status, e.g. a 403 for a size that doesn't match the signed one", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    FakeXhr.script = (xhr) => {
      xhr.status = 403
      xhr.responseText = "<Error><Code>SignatureDoesNotMatch</Code></Error>"
      xhr.onload?.()
    }
    await expect(putFileToS3("https://s3.example/k", fakeFile("a.pdf", 1), "application/pdf")).rejects.toThrow(
      /Upload to storage failed \(403\): <Error><Code>SignatureDoesNotMatch/,
    )
  })

  it("rejects on a network error", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr)
    FakeXhr.script = (xhr) => xhr.onerror?.()
    await expect(putFileToS3("https://s3.example/k", fakeFile("a.pdf", 1), "application/pdf")).rejects.toThrow(
      "Network error uploading to storage",
    )
  })
})
