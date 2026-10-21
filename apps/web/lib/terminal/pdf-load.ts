/** Starting and stopping the load of one PDF with pdf.js, kept apart from the React component so
 * the cancel rules can be tested with a stand-in for pdf.js.
 *
 * What gets cancelled, and how: `getDocument()` returns a *loading task*, and
 * `PDFDocumentLoadingTask.destroy()` is its only cancel — it aborts the download and shuts down
 * the worker, and it also tears down the loaded document (the document's own `destroy()` just
 * forwards to it). A loading task has no `cancel()`; that name belongs to `RenderTask`. So this
 * calls `destroy()` on the task, once, and never on the loaded document. */

/** The part of a pdf.js loading task used here. The real `PDFDocumentLoadingTask` fits it. */
export interface LoadingTaskLike<Doc> {
  promise: Promise<Doc>
  destroy(): Promise<void>
}

/** The part of the pdf.js module used here. */
export interface PdfjsLike<Doc> {
  getDocument(source: { url: string }): LoadingTaskLike<Doc>
}

export interface PdfLoad<Doc> {
  /** The loaded document, or null when the load was cancelled first. Rejects on a real failure. */
  promise: Promise<Doc | null>
  /** Stops the load (or releases the document, if it already finished). Safe to call twice. */
  cancel(): void
}

export function loadPdfDocument<Doc>(loadPdfjs: () => Promise<PdfjsLike<Doc>>, url: string): PdfLoad<Doc> {
  let cancelled = false
  let task: LoadingTaskLike<Doc> | null = null

  const promise = (async () => {
    try {
      const pdfjs = await loadPdfjs()
      // Cancelled while pdf.js was still being fetched: start no request at all. Nothing awaits
      // between this check and `task` being set, so cancel() can't run in the gap and miss it.
      if (cancelled) return null
      task = pdfjs.getDocument({ url })
      const doc = await task.promise
      return cancelled ? null : doc
    } catch (err) {
      // A task destroyed by cancel() rejects too — that is not a failure.
      if (cancelled) return null
      throw err
    }
  })()

  return {
    promise,
    cancel() {
      if (cancelled) return
      cancelled = true
      // A failed destroy must not surface as an unhandled rejection.
      task?.destroy().catch(() => {})
    },
  }
}
