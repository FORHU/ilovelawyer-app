const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** True for an internal id (a UUID) - never something a reader should see as a file's name. */
export function isUuidLike(value: string | null | undefined): boolean {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

/**
 * The text to show for a document reference (a Decision Record's evidence `doc`).
 *
 * ilovelawyer-api now turns file ids into file names before a record is saved or returned, so
 * this is the last line of defence: an id that still gets through (an older cached response, a
 * record shape the API did not clean) is shown as a neutral label, never as the raw id.
 */
export function displayDocumentLabel(label: string | null | undefined, fallback: string): string {
  const trimmed = (label ?? "").trim()
  if (!trimmed || isUuidLike(trimmed)) return fallback
  return trimmed
}
