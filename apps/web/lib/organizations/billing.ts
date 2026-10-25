import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { billingKeys, organizationKeys } from "@/lib/query-keys"
import type { ChargeKind, ChargeStatus, Money } from "@/lib/client-handoff"
import { OWN_WORKSPACE_ID } from "@/lib/store/auth.store"

/** Where a workspace's billing lives in the API: a firm's under /organizations/:id/billing, a solo
 * lawyer's own (OWN_WORKSPACE_ID: they have no organization, ilovelawyer-api's ADR 0022) under
 * /users/me/billing. Same shapes either way, so every hook below works for both. */
function billingPath(organizationId: string): string {
  return organizationId === OWN_WORKSPACE_ID ? "/api/users/me/billing" : `/api/organizations/${organizationId}/billing`
}

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
      return apiFetch<ChargePage>(`${billingPath(organizationId)}/fees?${params.toString()}`)
    },
    enabled: !!organizationId,
    placeholderData: keepPreviousData,
  })
}

/** The organization's card on file (ilovelawyer-api#505), which the client hand-off's per-case
 * fee and AI top-ups are charged to. Null when none is set up yet. */
export interface OrganizationCard {
  brand: string
  last4: string
  expMonth: number
  expYear: number
  /** DUMMY: a test card saved by the local/test payment provider, never charged for real. */
  provider: "STRIPE" | "DUMMY"
  updatedAt: string
}

/** GET /organizations/:id/billing/card[?setupSessionId=]. Passing the session the app just came
 * back from (useCardSetupReturn) finalizes it first, so the card shows without waiting on
 * Stripe's webhook — and locally, where none arrives at all. */
export function getOrganizationCard(organizationId: string, setupSessionId?: string): Promise<OrganizationCard | null> {
  const query = setupSessionId ? `?setupSessionId=${encodeURIComponent(setupSessionId)}` : ""
  return apiFetch<OrganizationCard | null>(`${billingPath(organizationId)}/card${query}`)
}

/** Owners and Admins only — the API answers 403 for anyone else, same as the fee history above. */
export function useOrganizationCardQuery(organizationId: string | undefined) {
  return useQuery({
    queryKey: billingKeys.card(organizationId ?? ""),
    queryFn: () => getOrganizationCard(organizationId!),
    enabled: !!organizationId,
  })
}

/** POST /organizations/:id/billing/card/setup-session — starts adding or replacing the card.
 * Resolves to where to send the browser: Stripe's hosted Checkout page (setup mode), or, with
 * the dummy provider used locally/in test, straight back to `returnUrl` with a test card already
 * saved. Either way the card itself never touches this app or its API. */
export function useStartCardSetupMutation(organizationId: string | undefined) {
  return useMutation({
    mutationFn: (returnUrl: string) =>
      apiFetch<{ url: string }>(`${billingPath(organizationId!)}/card/setup-session`, {
        method: "POST",
        body: JSON.stringify({ returnUrl }),
      }),
  })
}

/** Writes a freshly-finalized card straight into the cache (useCardSetupReturn, after the
 * round trip to Stripe) instead of waiting on a refetch. */
export function useSetOrganizationCardCache() {
  const queryClient = useQueryClient()
  return (organizationId: string, card: OrganizationCard | null) => queryClient.setQueryData(billingKeys.card(organizationId), card)
}
