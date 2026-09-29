import { DAMAGE_AS_OF, type DamageBasis, type DamageCategory, type DamageClaim, type DamagesSummary } from "@/lib/terminal/types"

// Pure helpers behind the Damages & Remedies panel: money formatting per tenant currency, the
// ring's segment geometry, and the order heads are shown in. The figures themselves always come
// from the server's damagesSummary — nothing here re-derives an amount.

type Currency = DamagesSummary["currency"]

const LOCALE_FOR: Record<Currency, string> = { PHP: "en-PH", GBP: "en-GB" }

/** ₱486,000 / £486,000 — cents only when there are any. */
export function formatMoney(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE_FOR[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

/** ₱918.6K / ₱1.24M — for the ring's centre and the exposure bar's labels. */
export function formatMoneyCompact(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE_FOR[currency], {
    style: "currency",
    currency,
    notation: "compact",
    maximumSignificantDigits: 4,
  }).format(value)
}

/** 0.529 → "53%"; a sliver that would round to 0 reads "<1%" so it never looks like nothing. */
export function formatShare(share: number): string {
  if (!(share > 0)) return "0%"
  const pct = Math.round(share * 100)
  return pct === 0 ? "<1%" : `${pct}%`
}

/** The order heads appear in, both around the ring and down the list: the mockup's category
 * order, then oldest first within a category. */
export const DAMAGE_CATEGORY_ORDER: DamageCategory[] = ["ACTUAL", "MORAL", "EXEMPLARY", "ATTORNEYS_FEES", "OTHER"]

export function sortDamageHeads<T extends Pick<DamageClaim, "category" | "createdAt">>(heads: T[]): T[] {
  return [...heads].sort(
    (a, b) =>
      DAMAGE_CATEGORY_ORDER.indexOf(a.category) - DAMAGE_CATEGORY_ORDER.indexOf(b.category) ||
      a.createdAt.localeCompare(b.createdAt),
  )
}

export interface RingSegment {
  id: string
  /** Visible arc length, as a fraction of the circle (0..1). */
  length: number
  /** Where the arc starts, as a fraction of the circle from 12 o'clock, clockwise. */
  offset: number
}

/**
 * Lays heads around the ring in the order given. `gap` is the blank space left between two
 * neighbouring arcs, as a fraction of the circle; a head too small to survive its gap still
 * keeps a hairline so it doesn't vanish. A single head gets the full circle with no gap.
 */
export function ringSegments(heads: { id: string; share: number }[], gap = 0.008): RingSegment[] {
  const visible = heads.filter((h) => h.share > 0)
  if (visible.length === 1) return [{ id: visible[0]!.id, length: 1, offset: 0 }]
  let offset = 0
  return visible.map((h) => {
    const segment = { id: h.id, length: Math.max(h.share - gap, 0.002), offset: offset + gap / 2 }
    offset += h.share
    return segment
  })
}

/** Where a value sits on the exposure bar, as a 0..100 percentage clamped to the track. */
export function rangePercent(value: number, scaleMax: number): number {
  if (!(scaleMax > 0)) return 0
  return Math.min(100, Math.max(0, (value / scaleMax) * 100))
}

/** Months for a RATE_X_PERIOD basis as the server computes them — for the editor's preview
 * only. Mirrors monthsBetween in the API's damages-compute.ts. */
export function monthsBetween(from: string, until: string): number | undefined {
  const a = new Date(from)
  const b = new Date(until)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return undefined
  const addMonths = (n: number) => {
    const lastDay = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + n + 1, 0)).getUTCDate()
    return new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + n, Math.min(a.getUTCDate(), lastDay)))
  }
  let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth())
  let anchor = addMonths(months)
  if (anchor > b) {
    months -= 1
    anchor = addMonths(months)
  }
  const days = Math.round((b.getTime() - anchor.getTime()) / 86_400_000)
  return Math.round((months + days / 30) * 100) / 100
}

/** Months a RATE_X_PERIOD basis covers, with an accruing period (untilDate "asOf") run to `today`. */
export function basisMonths(
  basis: Extract<DamageBasis, { kind: "RATE_X_PERIOD" }>,
  today: Date = new Date(),
): number | undefined {
  if (basis.months !== undefined) return basis.months
  if (!basis.fromDate || !basis.untilDate) return undefined
  const until = basis.untilDate === DAMAGE_AS_OF ? today.toISOString().slice(0, 10) : basis.untilDate
  return monthsBetween(basis.fromDate, until)
}

/**
 * The amount the editor shows while the lawyer types — a preview; the server's recompute is
 * what gets stored. `baseAmounts` is each non-derived head's current amount by category, for a
 * PERCENT_OF basis. Undefined when the inputs aren't complete yet.
 */
export function previewAmount(
  basis: DamageBasis,
  fixedAmount: number | null,
  baseAmounts: Partial<Record<DamageCategory, number>>,
  today: Date = new Date(),
): number | undefined {
  if (basis.kind === "FIXED") return fixedAmount ?? undefined
  if (basis.kind === "RATE_X_PERIOD") {
    const months = basisMonths(basis, today)
    return months === undefined ? undefined : Math.round(basis.monthlyRate * months * 100) / 100
  }
  const sum = basis.categories.reduce((total, c) => total + (baseAmounts[c] ?? 0), 0)
  return Math.round(sum * basis.percent) / 100
}

/** Do two sets of figures a document can state match — a FIXED amount, a monthly rate (and stated
 * months), a percentage and what it's of? Mirrors figuresDiffer in the API's damages-proposal.ts,
 * so the panel can tell "confirms the figure" from "states a new one" without comparing text. */
export function sameFigures(
  a: { basis: DamageBasis | null; amount: number | null },
  b: { basis: DamageBasis | null; amount: number | null },
): boolean {
  const x = a.basis ?? { kind: "FIXED" as const }
  const y = b.basis ?? { kind: "FIXED" as const }
  if (x.kind !== y.kind) return false
  if (x.kind === "FIXED") return a.amount === b.amount
  if (x.kind === "RATE_X_PERIOD" && y.kind === "RATE_X_PERIOD") {
    return x.monthlyRate === y.monthlyRate && (y.months === undefined || x.months === y.months)
  }
  if (x.kind === "PERCENT_OF" && y.kind === "PERCENT_OF") {
    return x.percent === y.percent && [...x.categories].sort().join() === [...y.categories].sort().join()
  }
  return false
}
