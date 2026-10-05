import { isUuidLike } from "@/lib/chat/document-label"

/** The Document Viewer tab for one case document — opened from a Decision Record's evidence.
 * Query params rather than a path segment because an older record can carry only the file's
 * name (`docId` null), and the viewer then finds the document by that name instead. */
export function documentViewerHref(caseId: string, ref: { docId: string | null; doc: string }): string | null {
  const params = new URLSearchParams()
  if (ref.docId) params.set("id", ref.docId)
  // A bare id in `doc` names nothing a lookup by name could match (see displayDocumentLabel).
  const name = ref.doc?.trim()
  if (name && !isUuidLike(name)) params.set("name", name)
  if (!params.size) return null
  return `/homepage/terminal/${encodeURIComponent(caseId)}/document?${params.toString()}`
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
