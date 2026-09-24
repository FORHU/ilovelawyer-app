import { isSpreadsheet } from "@/lib/cases/file-type-icon"

export type IngestTone = "ready" | "pending" | "failed" | "none"

/** Documents with no ragStatus yet count as pending, same as the panel's badge. */
export function ingestTone(ragStatus: string | null | undefined): Exclude<IngestTone, "none"> {
  if (ragStatus === "READY") return "ready"
  if (ragStatus === "FAILED") return "failed"
  return "pending"
}

export function countByStatus(documents: { ragStatus: string | null }[]) {
  const counts = { ready: 0, pending: 0, failed: 0 }
  for (const doc of documents) counts[ingestTone(doc.ragStatus)]++
  return counts
}

/** Tone of a timeline event's dot: its source document's ingest status, or "none" when the event
 * has no source document (or it no longer resolves, e.g. it was deleted). */
export function timelineDotTone(
  documentId: string | null | undefined,
  documentsById: Map<string, { ragStatus: string | null }>,
): IngestTone {
  const doc = documentId ? documentsById.get(documentId) : undefined
  return doc ? ingestTone(doc.ragStatus) : "none"
}

export const TONE_TEXT_CLASS: Record<IngestTone, string> = {
  ready: "text-ok",
  pending: "text-warn",
  failed: "text-danger",
  none: "text-muted-foreground",
}

export const TONE_BG_CLASS: Record<IngestTone, string> = {
  ready: "bg-ok",
  pending: "bg-warn",
  failed: "bg-danger",
  none: "bg-muted-foreground/50",
}

/** Size label key for a document row. The API sends pageCount = worksheet count for spreadsheets,
 * and null when extraction never ran or failed early — a spreadsheet then falls back to one sheet,
 * anything else shows no label rather than a made-up page count. */
export function documentSizeLabel(doc: {
  mimeType: string | null
  name: string
  pageCount: number | null
}): { key: "sheetLabel" | "sheetCount" | "pageCountShort"; n?: number } | null {
  if (isSpreadsheet(doc)) {
    return doc.pageCount && doc.pageCount > 1 ? { key: "sheetCount", n: doc.pageCount } : { key: "sheetLabel" }
  }
  return doc.pageCount == null ? null : { key: "pageCountShort", n: doc.pageCount }
}
