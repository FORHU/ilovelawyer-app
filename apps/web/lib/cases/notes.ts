/** One line of a case's notes for the list row: newlines and runs of spaces collapse to one space. */
export function flattenNotes(notes: string | null | undefined): string {
  return (notes ?? "").replace(/\s+/g, " ").trim()
}
