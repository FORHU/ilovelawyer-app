import { isUuidLike } from "@/lib/chat/document-label"

/** A quote longer than this is cut: it rides in the URL, and the text on one page that is worth
 * matching is far shorter than a whole paragraph. */
export const MAX_QUOTE_LENGTH = 300

/** Where inside a document to open it: the PDF page (1-based) and the passage to highlight on it. */
export interface ViewerTarget {
  page?: number | null
  quote?: string | null
  /** How the source names the spot, e.g. "D13 p.2" — shown beside the PDF page, which differs
   * from it inside a merged bundle. */
  label?: string | null
}

/** A usable page number: a positive whole number. Anything else (0, negative, 2.5, "abc") means
 * the source gave no page, and the document opens at its start. */
export function normalizePage(value: unknown): number | null {
  const n = typeof value === "string" && /^\d+$/.test(value.trim()) ? Number(value) : value
  return typeof n === "number" && Number.isSafeInteger(n) && n > 0 ? n : null
}

/** The quote to carry, trimmed and capped; null when there is nothing to look for. */
export function normalizeQuote(value: unknown): string | null {
  if (typeof value !== "string") return null
  const quote = value.replace(/\s+/g, " ").trim()
  if (!quote) return null
  return quote.length > MAX_QUOTE_LENGTH ? quote.slice(0, MAX_QUOTE_LENGTH).trim() : quote
}

/** The Document Viewer tab for one case document — opened from a Decision Record's evidence.
 * Query params rather than a path segment because an older record can carry only the file's
 * name (`docId` null), and the viewer then finds the document by that name instead. `page` and
 * `quote` (written as `q`) are optional: with them the viewer opens at that page and highlights
 * the passage. */
export function documentViewerHref(
  caseId: string,
  ref: { docId: string | null; doc: string } & ViewerTarget,
): string | null {
  const params = new URLSearchParams()
  if (ref.docId) params.set("id", ref.docId)
  // A bare id in `doc` names nothing a lookup by name could match (see displayDocumentLabel).
  const name = ref.doc?.trim()
  if (name && !isUuidLike(name)) params.set("name", name)
  if (!params.size) return null
  const page = normalizePage(ref.page)
  if (page) params.set("page", String(page))
  const quote = normalizeQuote(ref.quote)
  if (quote) params.set("q", quote)
  const label = ref.label?.trim()
  if (label) params.set("loc", label)
  return `/homepage/terminal/${encodeURIComponent(caseId)}/document?${params.toString()}`
}

/** What a viewer link carries — the reverse of documentViewerHref. */
export function parseViewerParams(search: { get(name: string): string | null }): {
  id: string | null
  name: string | null
  page: number | null
  quote: string | null
  label: string | null
} {
  return {
    id: search.get("id"),
    name: search.get("name"),
    page: normalizePage(search.get("page")),
    quote: normalizeQuote(search.get("q")),
    label: search.get("loc")?.trim() || null,
  }
}

/** The document a viewer link points at: by id first, then by exact (case-insensitive) file name. */
export function findViewerDocument<T extends { id: string; name: string }>(
  documents: readonly T[],
  ref: { id: string | null; name: string | null },
): T | undefined {
  if (ref.id) {
    const byId = documents.find((d) => d.id === ref.id)
    if (byId) return byId
  }
  const name = ref.name?.trim().toLowerCase()
  if (!name) return undefined
  return documents.find((d) => d.name.trim().toLowerCase() === name)
}
