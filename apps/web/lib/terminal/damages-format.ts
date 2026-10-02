import type { DamageClaim, DamagesSummary } from "@/lib/terminal/types"

// Pure helpers behind the Damages & Remedies panel: money formatting per tenant currency and the
// order entries are shown in. Totals always come from the server's damagesSummary.

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

/** ₱918.6K / ₱1.24M — for the panel's headline total. */
export function formatMoneyCompact(value: number, currency: Currency): string {
  return new Intl.NumberFormat(LOCALE_FOR[currency], {
    style: "currency",
    currency,
    notation: "compact",
    maximumSignificantDigits: 4,
  }).format(value)
}

/**
 * The order entries are listed in: AI suggestions waiting to be accepted first, then what is
 * still open, soonest due date first (undated last), then what is already awarded or received.
 * Oldest first among equals.
 */
export function sortDamageHeads<T extends Pick<DamageClaim, "accepted" | "done" | "dueDate" | "createdAt">>(heads: T[]): T[] {
  const rank = (h: T) => (!h.accepted ? 0 : h.done ? 2 : 1)
  const due = (h: T) => (h.dueDate ? h.dueDate : "￿")
  return [...heads].sort(
    (a, b) => rank(a) - rank(b) || due(a).localeCompare(due(b)) || a.createdAt.localeCompare(b.createdAt),
  )
}

/**
 * Deadlines across the entries still to win: how many have passed, and the nearest one still
 * ahead (today counts as ahead). Done entries and AI suggestions not yet accepted are left out.
 */
export function deadlineStats(
  heads: Pick<DamageClaim, "accepted" | "done" | "dueDate">[],
  today: Date = new Date(),
): { overdue: number; next: { dueDate: string; days: number } | null } {
  let overdue = 0
  let next: { dueDate: string; days: number } | null = null
  for (const h of heads) {
    if (!h.accepted || h.done || !h.dueDate) continue
    const days = daysUntil(h.dueDate, today)
    if (days < 0) overdue += 1
    else if (!next || days < next.days) next = { dueDate: h.dueDate, days }
  }
  return { overdue, next }
}

/** Days from `today` to an ISO date (negative once it has passed), counted in whole calendar days. */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const day = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return Math.round((day(new Date(iso)) - day(today)) / 86_400_000)
}
