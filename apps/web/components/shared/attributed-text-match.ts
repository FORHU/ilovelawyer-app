export type ClaimCategory = "GROUNDED" | "INFERENCE" | "UNSUPPORTED"

export interface Claim {
  text: string
  category: ClaimCategory
  sourceLabel?: string | null
}

export interface ClaimMatch {
  start: number
  end: number
  claim: Claim
}

/**
 * Finds each claim's exact text within `input`, longest-claim-first and non-overlapping (so a
 * short claim's text can't fragment a longer one), returning match spans in reading order.
 * Deliberately a plain, unnormalized substring search — not fuzzy — so a claim that no longer
 * matches verbatim (drift from the model, or the text having since been edited) simply produces
 * no match rather than risking a wrong attribution. Kept JSX-free so it's testable without a
 * component-rendering harness — see attributed-text.tsx for the <mark>-wrapping consumer.
 */
export function findClaimMatches(input: string, claims: Claim[]): ClaimMatch[] {
  if (!input || claims.length === 0) return []

  const sorted = [...claims].filter((c) => c.text.trim()).sort((a, b) => b.text.length - a.text.length)

  const matches: ClaimMatch[] = []
  for (const claim of sorted) {
    const needle = claim.text.trim()
    if (!needle) continue
    const start = input.indexOf(needle)
    if (start === -1) continue
    const end = start + needle.length
    const overlaps = matches.some((m) => start < m.end && end > m.start)
    if (!overlaps) matches.push({ start, end, claim })
  }

  return matches.sort((a, b) => a.start - b.start)
}
