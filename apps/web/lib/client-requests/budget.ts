import type { QuoteType } from "@/lib/client-handoff"

/** What the client can spend on a lawyer (the API's Client Budget), in pence. Set on the client's
 * Create case: a range, their own amount (low = high) or "Not sure" (null). */
export interface ClientBudget {
  minMinor: number | null
  /** Null: open-ended ("Over £5,000"). */
  maxMinor: number | null
  /** The kind of quote the client would rather get. Null: either. */
  feePreference: QuoteType | null
}

const wholePounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })
const withPence = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

/** £500, or £2,750.50 when there are pence. */
function pounds(minor: number): string {
  return (minor % 100 === 0 ? wholePounds : withPence).format(minor / 100)
}

type BudgetAmount = { key: "range" | "under" | "over" | "amount"; values: Record<string, string> }
type FeeKey = "fixedFee" | "firstConsultation"

/** The budget chip's parts, as keys under `budget.` in the client-request namespace. Null when
 * there's no budget: briefs written before budgets have no `budget` at all. */
export function budgetChip(budget: ClientBudget | null | undefined): { amount: BudgetAmount | null; fee: FeeKey | null } | null {
  if (!budget) return null
  const { minMinor: min, maxMinor: max } = budget
  const amount: BudgetAmount | null =
    min !== null && max !== null && min === max
      ? { key: "amount", values: { amount: pounds(min) } }
      : min !== null && max !== null && min > 0
        ? { key: "range", values: { min: pounds(min), max: pounds(max) } }
        : max !== null
          ? { key: "under", values: { max: pounds(max) } }
          : min !== null
            ? { key: "over", values: { min: pounds(min) } }
            : null
  const fee: FeeKey | null = budget.feePreference === "FIXED_FEE" ? "fixedFee" : budget.feePreference === "FIRST_CONSULTATION" ? "firstConsultation" : null
  return amount || fee ? { amount, fee } : null
}
