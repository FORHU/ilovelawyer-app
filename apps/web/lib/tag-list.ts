/**
 * Adds what was typed or pasted to a tag list: split on commas, trimmed, cut to `maxLength`,
 * and without any tag already there (ignoring case, so "english" doesn't sit beside "English").
 * Stops at `max` tags. Returns the same array when nothing was added.
 */
export function addTags(list: readonly string[], raw: string, { max, maxLength }: { max: number; maxLength: number }): string[] {
  const next = [...list]
  for (const piece of raw.split(",")) {
    const tag = piece.trim().slice(0, maxLength).trim()
    if (!tag || next.length >= max) continue
    if (next.some((t) => t.toLowerCase() === tag.toLowerCase())) continue
    next.push(tag)
  }
  return next.length === list.length ? (list as string[]) : next
}
