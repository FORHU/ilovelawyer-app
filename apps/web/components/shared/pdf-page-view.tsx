"use client"

import { useEffect, useRef, useState } from "react"
import { AlertCircle, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { PDFDocumentProxy } from "pdfjs-dist"
import type { TextItem } from "pdfjs-dist/types/src/display/api"
import { loadPdfDocument } from "@/lib/terminal/pdf-load"
import { buildPageText, findQuote, itemSliceRect, itemsInRange } from "@/lib/terminal/quote-match"

interface Box {
  left: number
  top: number
  width: number
  height: number
}

type HighlightState = "found" | "notFound" | "none"

let pdfjsLoading: Promise<typeof import("pdfjs-dist")> | null = null

/** pdf.js, loaded once for the whole app and pointed at its worker once — not per file. Loaded on
 * demand because it is large. A failed load is forgotten so the next file can try again. */
function loadPdfjs() {
  pdfjsLoading ??= import("pdfjs-dist")
    .then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()
      return pdfjs
    })
    .catch((err) => {
      pdfjsLoading = null
      throw err
    })
  return pdfjsLoading
}

/** Pads a highlight a little so it sits around the glyphs rather than clipping them. */
const BOX_PAD = 2

const iconBtnClass =
  "flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-40 dark:hover:bg-overlay-hover"

/** One PDF page drawn with pdf.js, with the cited passage highlighted. The browser's own PDF
 * viewer (an iframe) can open at a page but cannot be told to mark text, so the cited page is drawn
 * here instead — and pdf.js is loaded only when this mounts, since it is large.
 *
 * Opens at `page`; with only a `quote` it searches the document for it. When the passage cannot be
 * found on the page (the extracted text we quoted from differs from the file's own text layer, or
 * the page is a scan with none) it still opens there and says so. `onError` fires when the file
 * cannot be drawn at all, so the caller can fall back to the plain viewer. */
export default function PdfPageView({
  docId,
  url,
  name,
  page,
  quote,
  onError,
}: {
  /** Identifies the document. The file is (re)loaded only when this changes — not when `url`
   * does: the URL is a signed link that is re-issued on every refetch of the documents list, and
   * reloading the PDF each time would reset the page and keep the worker busy. */
  docId: string
  url: string
  name: string
  page?: number | null
  quote?: string | null
  onError?: () => void
}) {
  const { t } = useTranslation("terminal")
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const itemsCache = useRef(new Map<number, TextItem[]>())
  const onErrorRef = useRef(onError)
  // The newest URL, read when a load starts (see `docId`).
  const urlRef = useRef(url)
  useEffect(() => {
    onErrorRef.current = onError
    urlRef.current = url
  })

  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [width, setWidth] = useState(0)
  // Set once the first page is drawn, so the spinner covers the wait for pdf.js and the file.
  const [drawn, setDrawn] = useState(false)
  const [highlight, setHighlight] = useState<{ page: number; state: HighlightState; boxes: Box[] }>({
    page: 0,
    state: "none",
    boxes: [],
  })
  // The page the reader moved to by hand, and the target it was relative to — a new target
  // (another document, another contradiction side) discards it.
  const [nav, setNav] = useState<{ target: number | null; page: number } | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)

  const wantedQuote = quote?.trim() || null

  // Load the file. The page text is read lazily, one page at a time, and cached.
  useEffect(() => {
    itemsCache.current = new Map()
    let cancelled = false
    // loadPdfDocument owns the cancel rules (see lib/terminal/pdf-load.ts): cancel() destroys the
    // loading task — never the loaded document — and starts nothing if pdf.js hadn't loaded yet.
    const load = loadPdfDocument(loadPdfjs, urlRef.current)
    load.promise
      .then((loaded) => {
        if (loaded && !cancelled) setDoc(loaded)
      })
      .catch(() => {
        if (!cancelled) onErrorRef.current?.()
      })
    return () => {
      cancelled = true
      setDoc(null)
      setDrawn(false)
      load.cancel()
    }
  }, [docId])

  const pageItems = async (loaded: PDFDocumentProxy, n: number): Promise<TextItem[]> => {
    const cached = itemsCache.current.get(n)
    if (cached) return cached
    const content = await (await loaded.getPage(n)).getTextContent()
    const items = content.items.filter((item): item is TextItem => "str" in item)
    itemsCache.current.set(n, items)
    return items
  }

  // With a quote but no page, look for the quote across the document (exact matches only — this
  // reads every page, and the tolerant match is for the one page we were pointed at).
  const searchKey = `${docId}\n${wantedQuote ?? ""}`
  const [searched, setSearched] = useState<{ key: string; page: number | null } | null>(null)
  useEffect(() => {
    if (!doc || page || !wantedQuote) return
    let cancelled = false
    ;(async () => {
      let found: number | null = null
      for (let n = 1; n <= doc.numPages && !cancelled; n++) {
        const { text } = buildPageText(await pageItems(doc, n))
        if (findQuote(text, wantedQuote, { approximate: false })) {
          found = n
          break
        }
      }
      if (!cancelled) setSearched({ key: searchKey, page: found })
    })().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [doc, page, wantedQuote, searchKey])

  const searching = !!doc && !page && !!wantedQuote && searched?.key !== searchKey
  const target = !doc || searching ? null : page ? Math.min(page, doc.numPages) : (searched?.page ?? 1)
  const shown = target !== null && nav && nav.target === target ? nav.page : target
  const total = doc?.numPages ?? 0

  // Measure the area the page is fitted to.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.round(entry.contentRect.width)))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Draw the page, fitted to the width, and work out where the passage sits on it.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!doc || !shown || !canvas || width <= 0) return
    let cancelled = false
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null = null
    ;(async () => {
      try {
        const pageProxy = await doc.getPage(shown)
        const base = pageProxy.getViewport({ scale: 1 })
        const viewport = pageProxy.getViewport({ scale: Math.max(0.3, (width - 24) / base.width) })

        let state: HighlightState = "none"
        const boxes: Box[] = []
        if (wantedQuote && shown === target) {
          const items = await pageItems(doc, shown)
          const { text, spans } = buildPageText(items)
          const match = findQuote(text, wantedQuote)
          state = match ? "found" : "notFound"
          if (match) {
            for (const { index, from, to } of itemsInRange(spans, match.start, match.end)) {
              const item = items[index]
              const rect = item && itemSliceRect(item, from, to)
              if (!rect) continue
              const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect)
              boxes.push({
                left: Math.min(x1, x2) - BOX_PAD,
                top: Math.min(y1, y2) - BOX_PAD,
                width: Math.abs(x2 - x1) + BOX_PAD * 2,
                height: Math.abs(y2 - y1) + BOX_PAD * 2,
              })
            }
          }
        }
        if (cancelled) return

        const ratio = window.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        setHighlight({ page: shown, state, boxes })

        const context = canvas.getContext("2d")
        if (!context) throw new Error("no canvas context")
        renderTask = pageProxy.render({
          canvasContext: context,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        })
        await renderTask.promise
        if (!cancelled) setDrawn(true)
      } catch (err) {
        // A render cancelled by a newer one (resize, page change) is expected.
        if (!cancelled && (err as { name?: string })?.name !== "RenderingCancelledException") onErrorRef.current?.()
      }
    })()
    return () => {
      cancelled = true
      renderTask?.cancel()
    }
  }, [doc, shown, target, width, wantedQuote])

  // Bring the highlight into view; a page with none starts at its top.
  useEffect(() => {
    const scroller = scrollRef.current
    if (!scroller || highlight.page !== shown) return
    const first = highlight.boxes[0]
    scroller.scrollTo({ top: first ? Math.max(0, first.top - 96) : 0, behavior: first ? "smooth" : "auto" })
  }, [highlight, shown])

  const go = (next: number) => {
    if (target !== null && next >= 1 && next <= total) setNav({ target, page: next })
  }

  const outOfRange = !!doc && !!page && page > total
  const onCitedPage = highlight.page === shown && shown === target
  const notice =
    outOfRange && shown === target
      ? t("pdfPageNotInDocument", { page, total })
      : onCitedPage && highlight.state === "notFound"
        ? t(page ? "pdfQuoteNotHighlighted" : "pdfQuoteNotFound", { page: shown })
        : null
  const noticeKey = `${docId}|${page ?? ""}|${wantedQuote ?? ""}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
        <button type="button" className={iconBtnClass} onClick={() => go((shown ?? 1) - 1)} disabled={!shown || shown <= 1} aria-label={t("pdfPrevPage")} title={t("pdfPrevPage")}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-24 text-center tabular-nums" aria-live="polite">
          {shown ? t("pdfPageOf", { page: shown, total }) : " "}
        </span>
        <button type="button" className={iconBtnClass} onClick={() => go((shown ?? 0) + 1)} disabled={!shown || shown >= total} aria-label={t("pdfNextPage")} title={t("pdfNextPage")}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      {notice && dismissed !== noticeKey ? (
        <div role="status" className="flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          <p className="min-w-0 flex-1">{notice}</p>
          <button type="button" onClick={() => setDismissed(noticeKey)} aria-label={t("pdfDismiss")} title={t("pdfDismiss")} className="shrink-0 rounded-sm p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/40">
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* Stable gutter: a scrollbar appearing would narrow this area, which resizes the page to fit,
       * which can make the scrollbar disappear again. */}
      <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto p-3 [scrollbar-gutter:stable]">
        {!drawn ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-muted/30 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("pdfLoadingPage")}
          </div>
        ) : null}
        <div className="relative mx-auto w-fit shadow-sm">
          <canvas ref={canvasRef} className="block bg-white" role="img" aria-label={name} />
          {highlight.page === shown
            ? highlight.boxes.map((box, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className="pointer-events-none absolute rounded-[2px] bg-yellow-300/60 mix-blend-multiply"
                  style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
                />
              ))
            : null}
        </div>
        {highlight.page === shown && highlight.state === "found" ? <p className="sr-only">{t("pdfPassageHighlighted")}</p> : null}
      </div>
    </div>
  )
}
