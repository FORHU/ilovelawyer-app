export interface DecisionAnchor {
  id: string
  anchor: string
}

export interface AnchorMatch {
  start: number
  end: number
  decisionId: string
}

// Folds one character to a comparison form — typographic quotes/dashes to their ASCII twins and
// case dropped. Always exactly one output char per input char (a lowercase form that isn't a
// single char is kept as-is), so indexOfOriginal below stays a 1:1 map. An evidence quote
// pulled out of a PDF routinely differs from the reply's own text in just these ways (curly vs
// straight apostrophe, sentence-initial capital), which would otherwise leave it unhighlighted.
function foldChar(ch: string): string {
  if (ch === "‘" || ch === "’") return "'"
  if (ch === "“" || ch === "”") return '"'
  if (ch === "–" || ch === "—") return "-"
  const lower = ch.toLowerCase()
  return lower.length === 1 ? lower : ch
}

function foldText(text: string): string {
  let out = ""
  for (const ch of text) out += foldChar(ch)
  return out
}

function normalizeWhitespace(text: string): string {
  return foldText(text.replace(/\s+/g, " ").trim()).replace(/[.;,:]+$/, "")
}

/** Collapses runs of whitespace to a single space (and folds case/typographic punctuation, see
 * foldChar), recording for each character kept in the normalized string the index it came from
 * in the original — so a match found in the normalized text can be mapped back to the original
 * (unnormalized) span to highlight. */
function normalizeWithIndexMap(text: string): { normalized: string; indexOfOriginal: number[] } {
  let normalized = ""
  const indexOfOriginal: number[] = []
  let inRun = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (/\s/.test(ch)) {
      if (!inRun) {
        normalized += " "
        indexOfOriginal.push(i)
        inRun = true
      }
    } else {
      normalized += foldChar(ch)
      indexOfOriginal.push(i)
      inRun = false
    }
  }
  return { normalized, indexOfOriginal }
}

/**
 * Finds each Decision Record's `anchor` within `input`, matching whitespace-normalized (the
 * same tolerance chat-wonder-v2-api's `_normalize_anchor` uses to verify the anchor server-side
 * — a newline or double space inside the copied sentence shouldn't break the client-side
 * highlight). Longest-anchor-first and non-overlapping, like attributed-text-match.ts. A plain,
 * unnormalized approach would silently miss anchors that verified fine server-side; this stays
 * exact otherwise — an anchor with no whitespace-normalized match produces no highlight rather
 * than guessing.
 */
export function findAnchorMatches(input: string, anchors: DecisionAnchor[]): AnchorMatch[] {
  if (!input || anchors.length === 0) return []

  const { normalized, indexOfOriginal } = normalizeWithIndexMap(input)
  const sorted = [...anchors]
    .filter((a) => a.anchor.trim())
    .sort((a, b) => b.anchor.length - a.anchor.length)

  const matches: AnchorMatch[] = []
  for (const anchor of sorted) {
    const needle = normalizeWhitespace(anchor.anchor)
    if (!needle) continue
    const idx = normalized.indexOf(needle)
    if (idx === -1) continue
    const start = indexOfOriginal[idx]!
    const end = indexOfOriginal[idx + needle.length - 1]! + 1
    const overlaps = matches.some((m) => start < m.end && end > m.start)
    if (!overlaps) matches.push({ start, end, decisionId: anchor.id })
  }

  return matches.sort((a, b) => a.start - b.start)
}
