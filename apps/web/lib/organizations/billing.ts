import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys } from "@/lib/query-keys"
import type { ChargeKind, ChargeStatus, Money } from "@/lib/client-handoff"

/** One row of the organization's fee history (ilovelawyer-api#513's Charge) — a per-case fee or
 * an AI top-up charged to the organization's card, with whatever's been refunded of it. */
export interface ChargeRecord {
  id: string
  kind: ChargeKind
  status: ChargeStatus
  amount: Money
  refunded: Money
  requestId: string | null
  lawyer: { id: string; name: string } | null
  failureReason: string | null
  /** Stripe's receipt for a paid charge — the invoice link; null for a DUMMY test card or before
   * it's paid. */
  receiptUrl: string | null
  provider: "STRIPE" | "DUMMY" | null
  createdAt: string
}

export interface ChargePage {
  total: number
  data: ChargeRecord[]
}

/** Matches the API's default limit for GET /organizations/:id/billing/fees. */
export const FEE_HISTORY_PAGE_SIZE = 20

/** The organization's fee history, newest first. Owners and Admins only — the API answers 403
 * for anyone else. Keeps the previous page on screen while the next one loads, so the table
 * doesn't collapse between pages (same as the audit log). */
export function useOrganizationFeesQuery(
  organizationId: string,
  filters: { kind?: ChargeKind },
  page: number
) {
  return useQuery({
    queryKey: organizationKeys.fees(organizationId, { ...filters, page }),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters.kind) params.set("kind", filters.kind)
      params.set("page", String(page))
      params.set("limit", String(FEE_HISTORY_PAGE_SIZE))
      return apiFetch<ChargePage>(`/api/organizations/${organizationId}/billing/fees?${params.toString()}`)
    },
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  })
}
