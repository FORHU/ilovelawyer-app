/** Finds a contradiction's quoted passage in the text of one PDF page, so the viewer can highlight
 * it. The quote was captured from the document's extracted (and often OCR'd) text, while the page
 * is read from the PDF's own text layer, so the two rarely match character for character: spacing,
 * line breaks, hyphenated words, curly quotes, ligatures and stray OCR slips all differ. Pure and
 * DOM-free — pdf.js text items go in as plain objects. */

export interface QuoteMatch {
  /** Range in the page text that was passed in: [start, end). */
  start: number
  end: number
  /** True when the passage only matched after allowing for OCR-style slips. */
  approximate: boolean
}

/** Shortest quote (letters and digits only) we will look for at all. Below this a match is as
 * likely to be a coincidence as the cited passage ("the cameras", "14 Nov"). */
export const MIN_QUOTE_CHARS = 8
/** Shortest quote for the tolerant pass, which accepts a few wrong characters. */
export const MIN_APPROXIMATE_CHARS = 24
/** Share of the quote that may differ in the tolerant pass. */
const MAX_ERROR_RATIO = 0.15

const KEEP = /[\p{L}\p{N}]/u

/** Letters and digits only, lowercased and stripped of accents, with each kept character pointing
 * back at where it came from in the source. Dropping spaces and punctuation is what makes "exam-
 * ple", "14 November" and "14November" the same text, and "“quoted”" the same as "quoted". */
export function squash(source: string): { text: string; map: number[] } {
  let text = ""
  const map: number[] = []
  for (let i = 0; i < source.length; i++) {
    // NFKD splits ligatures ("ﬁ" -> "fi") and peels accents off into marks, which KEEP drops.
    for (const ch of source.charAt(i).normalize("NFKD").toLowerCase()) {
      if (!KEEP.test(ch)) continue
      text += ch
      map.push(i)
    }
  }
  return { text, map }
}

/** Characters OCR commonly swaps for one another, folded to one so they count as equal. Same
 * length in and out, so positions still line up. */
const CONFUSABLE: Record<string, string> = { "0": "o", "1": "l", i: "l", "5": "s", "8": "b" }
const fold = (s: string) => s.replace(/[01i58]/g, (c) => CONFUSABLE[c] ?? c)

/** The part of the quote worth searching for. Excerpts are clipped with "…" at either end or in
 * the middle; the longest unbroken piece is the most reliable anchor. */
export function quoteAnchor(quote: string): string {
  let best = ""
  for (const piece of quote.split(/…|\.{3,}/)) {
    if (squash(piece).text.length > squash(best).text.length) best = piece.trim()
  }
  return best
}

/** Cheapest alignment of `needle` against any stretch of `hay` (Sellers' approximate substring
 * match): the stretch's [start, end) and its edit distance, or null when nothing is within
 * `maxErrors`. The first of equally good stretches wins. */
function approximateSubstring(hay: string, needle: string, maxErrors: number): { start: number; end: number } | null {
  const m = needle.length
  let dist = Array.from({ length: m + 1 }, (_, i) => i)
  let from = new Array<number>(m + 1).fill(0)
  let best = maxErrors + 1
  let found: { start: number; end: number } | null = null
  for (let j = 1; j <= hay.length; j++) {
    const nextDist = new Array<number>(m + 1).fill(0)
    const nextFrom = new Array<number>(m + 1).fill(j)
    for (let i = 1; i <= m; i++) {
      const diag = dist[i - 1]! + (needle[i - 1] === hay[j - 1] ? 0 : 1)
      const skipNeedle = nextDist[i - 1]! + 1
      const skipHay = dist[i]! + 1
      if (diag <= skipNeedle && diag <= skipHay) {
        nextDist[i] = diag
        nextFrom[i] = from[i - 1]!
      } else if (skipNeedle <= skipHay) {
        nextDist[i] = skipNeedle
        nextFrom[i] = nextFrom[i - 1]!
      } else {
        nextDist[i] = skipHay
        nextFrom[i] = from[i]!
      }
    }
    if (nextDist[m]! < best) {
      best = nextDist[m]!
      found = { start: nextFrom[m]!, end: j }
    }
    dist = nextDist
    from = nextFrom
  }
  return found
}

/** Where `quote` sits in `pageText`, or null when it cannot be found with confidence. Tries an
 * exact match first (ignoring case, spacing and punctuation), then — unless turned off — one that
 * tolerates a few OCR slips. A repeated passage resolves to its first occurrence. */
export function findQuote(pageText: string, quote: string, opts: { approximate?: boolean } = {}): QuoteMatch | null {
  const needle = squash(quoteAnchor(quote)).text
  if (needle.length < MIN_QUOTE_CHARS) return null
  const page = squash(pageText)
  if (!page.text) return null

  const toRange = (start: number, end: number, approximate: boolean): QuoteMatch | null =>
    end > start ? { start: page.map[start]!, end: page.map[end - 1]! + 1, approximate } : null

  const at = page.text.indexOf(needle)
  if (at >= 0) return toRange(at, at + needle.length, false)

  if (opts.approximate === false || needle.length < MIN_APPROXIMATE_CHARS) return null
  const maxErrors = Math.floor(needle.length * MAX_ERROR_RATIO)
  const hit = approximateSubstring(fold(page.text), fold(needle), maxErrors)
  return hit ? toRange(hit.start, hit.end, true) : null
}

export interface TextItemLike {
  str: string
  hasEOL?: boolean
}

/** One page's text items as a single string, with where each item sits in it. */
export function buildPageText(items: readonly TextItemLike[]): { text: string; spans: { start: number; end: number }[] } {
  let text = ""
  const spans: { start: number; end: number }[] = []
  for (const item of items) {
    spans.push({ start: text.length, end: text.length + item.str.length })
    text += item.str
    if (item.hasEOL) text += "\n"
  }
  return { text, spans }
}

/** The items a matched range touches, each with the characters of it that are inside the range. */
export function itemsInRange(
  spans: readonly { start: number; end: number }[],
  start: number,
  end: number,
): { index: number; from: number; to: number }[] {
  const out: { index: number; from: number; to: number }[] = []
  spans.forEach((span, index) => {
    const from = Math.max(start, span.start) - span.start
    const to = Math.min(end, span.end) - span.start
    if (to > from) out.push({ index, from, to })
  })
  return out
}

/** The slice [from, to) of one text item as a rectangle in PDF user space ([x0, y0, x1, y1]),
 * assuming the characters are evenly spaced along the item's width. */
export function itemSliceRect(
  item: { str: string; width: number; height: number; transform: readonly number[] },
  from: number,
  to: number,
): [number, number, number, number] | null {
  const length = item.str.length
  if (!length || to <= from) return null
  const x = item.transform[4] ?? 0
  const baseline = item.transform[5] ?? 0
  const height = item.height || Math.abs(item.transform[3] ?? 0)
  // A little below the baseline so descenders (g, y, p) are inside the highlight.
  return [x + (item.width * from) / length, baseline - height * 0.2, x + (item.width * to) / length, baseline + height]
}
