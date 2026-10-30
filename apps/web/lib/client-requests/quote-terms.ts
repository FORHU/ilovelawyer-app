import type { QuoteTerms } from "@/lib/client-handoff"

/** The longest a lawyer can give a client to accept and pay a quote (ilovelawyer-api's QUOTATION_MAX_VALIDITY_DAYS). */
export const QUOTE_MAX_VALIDITY_DAYS = 90
/** What the expiry picker starts at. */
export const QUOTE_DEFAULT_VALIDITY_DAYS = 7

/** The platform fee the client pays on top of a service fee, worked out the way the API does
 * (platformFeeOf): `platformFeeBps` of it rounded half-up, never below the minimum, none on a free
 * quote. The API prices it again when the quote is sent; this is the form's preview. */
export function platformFeeOf(serviceFeeMinor: number, terms: QuoteTerms): number {
  if (serviceFeeMinor <= 0) return 0
  return Math.max(Math.floor((serviceFeeMinor * terms.platformFeeBps + 5000) / 10000), terms.minPlatformFee.amountMinor)
}

/** "15%" from 1500 basis points; "12.5%" from 1250. */
export function formatRate(bps: number): string {
  return `${Number((bps / 100).toFixed(2))}%`
}

/** A yyyy-mm-dd for the date input, `days` from today, in the lawyer's own time zone. */
export function dateInputValue(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** The end of the chosen day, in the lawyer's own time zone, as the API's expiresAt. Null for an
 * empty or unreadable value. */
export function endOfDayIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
