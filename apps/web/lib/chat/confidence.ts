// Confidence view: where each sentence of a legal answer came from.
//
// chat-wonder-v2-api's confidence.py classifies every sentence of a legal/legal_uk answer against
// the sources actually retrieved that turn (deterministic IDF-weighted overlap, no LLM judge) and
// sends one `{"type":"confidence"}` envelope after `__END__`. ilovelawyer-api persists it per turn
// (MessageConfidence, on the turn's LAST assistant message, like reasoning/decisions) and returns it
// on GET .../messages as `ChatMessage.confidence`. See ilovelawyer-api
// docs/plans/confidence-view-integration.md for the full contract.
//
// The tiers say where a sentence came from, never whether it is correct.

export type ConfidenceTier = "QUOTED" | "SOURCED" | "UNSOURCED"

export const CONFIDENCE_TIERS: readonly ConfidenceTier[] = ["QUOTED", "SOURCED", "UNSOURCED"]

export interface ConfidenceSpan {
  /** One sentence / heading / list item / table cell as it RENDERS (markdown already stripped). */
  quote: string
  tier: ConfidenceTier
  /** "citation" spans style a link (matched by `ref`); "provenance" spans shade text. */
  source: "provenance" | "citation" | string
  /** Human-readable reason, shown on hover. */
  why?: string
  /** For `source: "citation"`: the link's href (the API remaps it to the Library href it rewrote
   * the link to). Null otherwise. */
  ref?: string | null
}

export interface ConfidencePayload {
  type?: "confidence"
  v: number
  persona?: string
  model?: string | null
  coverage?: "none" | "partial" | "full"
  spans: ConfidenceSpan[]
}

const SCHEMA_VERSION = 1

/** The payload's spans, or `[]` for anything absent, from a newer schema, or malformed. Never
 * throws: confidence is an overlay, so bad data just means "no shading". */
export function confidenceSpansOf(payload: unknown): ConfidenceSpan[] {
  if (!payload || typeof payload !== "object") return []
  const p = payload as Partial<ConfidencePayload>
  if (p.v !== SCHEMA_VERSION || !Array.isArray(p.spans)) return []
  return p.spans.filter(
    (s): s is ConfidenceSpan =>
      !!s &&
      typeof s === "object" &&
      typeof (s as ConfidenceSpan).quote === "string" &&
      (s as ConfidenceSpan).quote.trim().length > 0 &&
      CONFIDENCE_TIERS.includes((s as ConfidenceSpan).tier),
  )
}

/** Citation spans keyed by link href — looked up by the markdown `a` renderer, the same way
 * citationRanking is keyed by href. */
export function citationConfidenceByHref(spans: readonly ConfidenceSpan[]): ReadonlyMap<string, ConfidenceSpan> {
  const map = new Map<string, ConfidenceSpan>()
  for (const s of spans) {
    if (s.source === "citation" && s.ref && !map.has(s.ref)) map.set(s.ref, s)
  }
  return map
}

export interface ConfidenceCounts {
  QUOTED: number
  SOURCED: number
  UNSOURCED: number
  total: number
}

export function countConfidence(spans: readonly ConfidenceSpan[]): ConfidenceCounts {
  const counts: ConfidenceCounts = { QUOTED: 0, SOURCED: 0, UNSOURCED: 0, total: 0 }
  for (const s of spans) {
    counts[s.tier]++
    counts.total++
  }
  return counts
}

/** DOM id of one shaded span — set by the rehype plugin on the span's first <mark>, read by the
 * Studio summary to jump to that sentence. `turnIndex` is the visibleMessages index of the message
 * that CARRIES the payload (a split reply's last bubble), so two turns never share an id even when
 * the sentence itself sits in an earlier sibling bubble. `spanIndex` is the span's index in the
 * payload, unchanged by any sorting. */
export function confidenceSpanElementId(turnIndex: number, spanIndex: number): string {
  return `conf-${turnIndex}-${spanIndex}`
}

/** Tailwind classes per tier. No horizontal padding: a sentence split around bold/italics renders as
 * several adjacent marks, and padding showed as stray gaps between them. Emphasis inside a mark inherits the tier colour — markdown `em`
 * carries `text-primary` and would otherwise show in a different colour mid-sentence. */
export const CONFIDENCE_MARK_CLASS: Record<ConfidenceTier, string> = {
  QUOTED:
    "rounded-[2px] box-decoration-clone bg-emerald-500/15 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200 [&_em]:text-inherit [&_strong]:text-inherit",
  SOURCED:
    "rounded-[2px] box-decoration-clone bg-amber-400/25 text-amber-950 dark:bg-amber-400/15 dark:text-amber-100 [&_em]:text-inherit [&_strong]:text-inherit",
  UNSOURCED:
    "rounded-[2px] box-decoration-clone bg-slate-400/20 text-slate-700 dark:bg-slate-400/15 dark:text-slate-300 [&_em]:text-inherit [&_strong]:text-inherit",
}

/** Legend chip / summary bar colours (solid enough to read as a swatch). */
export const CONFIDENCE_SWATCH_CLASS: Record<ConfidenceTier, string> = {
  QUOTED: "bg-emerald-500/80 dark:bg-emerald-400/70",
  SOURCED: "bg-amber-400/90 dark:bg-amber-400/70",
  UNSOURCED: "bg-slate-400/70 dark:bg-slate-400/60",
}
