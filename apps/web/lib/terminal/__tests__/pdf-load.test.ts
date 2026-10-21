import { describe, it, expect, vi } from "vitest"
import { loadPdfDocument, type LoadingTaskLike, type PdfjsLike } from "../pdf-load"

interface FakeDoc {
  name: string
  destroy: ReturnType<typeof vi.fn>
}

/** A stand-in for pdf.js whose load the test finishes (or fails) by hand. */
function fakePdfjs(opts: { destroyRejects?: boolean } = {}) {
  const doc: FakeDoc = { name: "doc", destroy: vi.fn(async () => {}) }
  let resolveLoad!: (d: FakeDoc) => void
  let rejectLoad!: (e: Error) => void
  const task = {
    promise: new Promise<FakeDoc>((resolve, reject) => {
      resolveLoad = resolve
      rejectLoad = reject
    }),
    destroy: vi.fn(async () => {
      if (opts.destroyRejects) throw new Error("destroy failed")
      // Like the real thing, destroying a task that is still loading makes it reject.
      rejectLoad(new Error("Loading aborted"))
    }),
  }
  task.promise.catch(() => {})
  const getDocument = vi.fn((): LoadingTaskLike<FakeDoc> => task)
  const pdfjs: PdfjsLike<FakeDoc> = { getDocument }
  return { pdfjs, task, doc, getDocument, resolveLoad: () => resolveLoad(doc), rejectLoad: (e: Error) => rejectLoad(e) }
}

/** A pdf.js loader the test releases by hand, to cancel while the import is still pending. */
function deferredImport<T>(value: T) {
  let release!: () => void
  const load = vi.fn(() => new Promise<T>((resolve) => (release = () => resolve(value))))
  return { load, release: () => release() }
}

describe("loadPdfDocument", () => {
  it("resolves with the document and destroys nothing on a normal load", async () => {
    const f = fakePdfjs()
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalledWith({ url: "/files/a" }))
    f.resolveLoad()
    await expect(load.promise).resolves.toBe(f.doc)
    expect(f.task.destroy).not.toHaveBeenCalled()
  })

  it("starts no request when cancelled before pdf.js has finished importing", async () => {
    const f = fakePdfjs()
    const imp = deferredImport(f.pdfjs)
    const load = loadPdfDocument(imp.load, "/files/a")
    load.cancel()
    imp.release()
    await expect(load.promise).resolves.toBeNull()
    expect(f.getDocument).not.toHaveBeenCalled()
    expect(f.task.destroy).not.toHaveBeenCalled()
  })

  it("destroys the loading task exactly once when cancelled mid-load, and resolves null", async () => {
    const f = fakePdfjs()
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
    load.cancel()
    load.cancel() // a second cancel (e.g. cleanup running twice) does nothing more
    await expect(load.promise).resolves.toBeNull()
    expect(f.task.destroy).toHaveBeenCalledTimes(1)
  })

  it("never uses a document that finished loading after the cancel, nor destroys it directly", async () => {
    const f = fakePdfjs({ destroyRejects: true }) // destroy doesn't abort the promise here
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
    load.cancel()
    f.resolveLoad() // the load wins the race anyway
    await expect(load.promise).resolves.toBeNull()
    expect(f.task.destroy).toHaveBeenCalledTimes(1)
    expect(f.doc.destroy).not.toHaveBeenCalled()
  })

  it("swallows a failing destroy instead of leaving an unhandled rejection", async () => {
    const unhandled = vi.fn()
    process.on("unhandledRejection", unhandled)
    try {
      const f = fakePdfjs({ destroyRejects: true })
      const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
      await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
      expect(() => load.cancel()).not.toThrow()
      f.resolveLoad()
      await load.promise
      await new Promise((r) => setTimeout(r, 10))
      expect(unhandled).not.toHaveBeenCalled()
    } finally {
      process.off("unhandledRejection", unhandled)
    }
  })

  it("destroys the task once when cancelled after a successful load (the viewer closing)", async () => {
    const f = fakePdfjs()
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
    f.resolveLoad()
    await expect(load.promise).resolves.toBe(f.doc)
    load.cancel()
    expect(f.task.destroy).toHaveBeenCalledTimes(1)
    expect(f.doc.destroy).not.toHaveBeenCalled()
  })

  it("rejects on a real failure, so the caller can fall back", async () => {
    const f = fakePdfjs()
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
    f.rejectLoad(new Error("InvalidPDFException"))
    await expect(load.promise).rejects.toThrow("InvalidPDFException")
  })

  it("rejects when pdf.js itself cannot be loaded", async () => {
    const load = loadPdfDocument<FakeDoc>(async () => {
      throw new Error("chunk failed")
    }, "/files/a")
    await expect(load.promise).rejects.toThrow("chunk failed")
  })

  it("treats a failure after cancelling as a cancel, not an error", async () => {
    const f = fakePdfjs()
    const load = loadPdfDocument(async () => f.pdfjs, "/files/a")
    await vi.waitFor(() => expect(f.getDocument).toHaveBeenCalled())
    load.cancel()
    f.rejectLoad(new Error("anything"))
    await expect(load.promise).resolves.toBeNull()
  })
})
