// Research-trace labels (the "Looking up UK law: …" rows) can arrive as a long paragraph. The UI
// shows the leading sentence instead of clipping or hiding the rest behind a tooltip — however
// long that sentence is.

/** Below this many characters the first sentence is treated as a fragment, so the second is kept. */
const SHORT_FIRST_SENTENCE = 40

// Words whose trailing "." does not end a sentence in legal text ("Smith v. Jones", "s. 5",
// "Acme Ltd. v ..."). Single letters (initials) and dotted forms ("e.g.") are handled separately.
const ABBREVIATIONS = new Set([
  "v", "vs", "no", "nos", "s", "ss", "c", "cl", "art", "arts", "para", "paras", "reg", "regs",
  "sch", "ch", "pt", "sec", "cap", "ltd", "plc", "inc", "co", "corp", "mr", "mrs", "ms", "dr",
  "prof", "hon", "st", "jr", "sr", "ors", "anor", "cf", "approx", "re", "ibid", "eg", "ie",
])

function endsWithAbbreviation(before: string): boolean {
  const word = before.match(/(\S+)$/)?.[1]?.toLowerCase().replace(/^[("'“‘[]+/, "")
  if (!word) return false
  if (/^[a-z]$/.test(word)) return true // an initial: "J. Smith"
  if (/^([a-z]\.)+[a-z]$/.test(word)) return true // "e.g", "i.e"
  return ABBREVIATIONS.has(word)
}

/** Index just past each real sentence end in `text` (already whitespace-normalised). */
function sentenceEnds(text: string): number[] {
  const ends: number[] = []
  for (const m of text.matchAll(/[.!?]+["')\]”’]*\s+/g)) {
    const next = text[m.index + m[0].length]
    // A sentence starts with a capital, quote or bracket — not a number ("s. 5", "No. 3").
    if (!next || !/[A-Z"'“‘([]/.test(next)) continue
    const terminator = m[0].trimEnd()
    if (terminator.startsWith(".") && !terminator.startsWith("..") && endsWithAbbreviation(text.slice(0, m.index))) continue
    ends.push(m.index + terminator.length)
  }
  return ends
}

/**
 * The first sentence of `label`, whatever its length; the second as well only when the first is a
 * short fragment. Never more than two. A label with no sentence break comes back whole.
 */
export function leadingSentences(label: string): string {
  const text = label.replace(/\s+/g, " ").trim()
  const ends = sentenceEnds(text)
  if (ends.length === 0) return text
  const first = ends[0]!
  const cut = first < SHORT_FIRST_SENTENCE && ends.length > 1 ? ends[1]! : first
  return text.slice(0, cut).trim()
}
