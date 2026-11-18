import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

// A lawyer's account-wide AI usage allowance (ilovelawyer-api's AccountLimitsSvc) — cases aren't
// billed individually. Neither the ceiling nor the remaining balance in dollars is ever shown;
// only consumedPct is (product decision — a lawyer sees how much of their plan they've used, not
// a dollar figure to watch drain).

export interface AccountAiAllowance {
  limited: boolean
  locked: boolean
  consumedPct: number | null
  /** Locked because a solo lawyer's free trial is over and they don't subscribe: the way out is a
   * plan (/plans), not a top-up, which the API refuses then (PLAN_TRIAL_ENDED). */
  trialEnded: boolean
  /** When the free trial ends or ended (ISO), null with no trial. */
  trialEndsAt: string | null
}

export const accountAiAllowanceKey = ["account", "ai-allowance"] as const

export function useAccountAiAllowanceQuery() {
  return useQuery({
    queryKey: accountAiAllowanceKey,
    queryFn: () => apiFetch<AccountAiAllowance>("/api/users/me/ai-allowance"),
  })
}

/** What a lawyer can top up on their site (ilovelawyer-api's AccountTopUpPricingSvc.terms): in the
 * site's currency, major units — dollars on PH and UK, whole won on KR. */
export interface AccountTopUpTerms {
  currency: string
  minAmount: number
  maxAmount: number
  /** The amounts offered as buttons. */
  presets: number[]
}

/** A top-up's figures in the site's currency, major units. The AI usage it buys is counted in
 * dollars inside the app (creditUsd), never shown to the lawyer. */
export interface AccountTopUpQuote {
  currency: string
  topUpAmount: number
  feeAmount: number
  totalCharged: number
  creditUsd: number
}

export type AccountTopUpStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXPIRED"

export interface AccountTopUpCheckout {
  provider: "STRIPE"
  clientSecret: string
  publishableKey: string
}

export interface AccountTopUpStartResult extends AccountTopUpQuote {
  topUpId: string
  status: AccountTopUpStatus
  checkout: AccountTopUpCheckout | null
}

export interface AccountTopUpStatusResult extends AccountTopUpQuote {
  topUpId: string
  status: AccountTopUpStatus
  failureReason: string | null
}

const STATUS_POLL_MS = 2000

export function useAccountTopUpTermsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ["account-topup", "terms"],
    queryFn: () => apiFetch<AccountTopUpTerms>("/api/account-topups/terms"),
    enabled,
    staleTime: 5 * 60_000,
  })
}

/** `topUpAmount` is in the site's currency, major units. */
export function useAccountTopUpQuoteQuery(topUpAmount: number | null) {
  return useQuery({
    queryKey: ["account-topup", "quote", topUpAmount],
    queryFn: () => apiFetch<AccountTopUpQuote>("/api/account-topups/quote", { method: "POST", body: JSON.stringify({ topUpAmount }) }),
    enabled: topUpAmount !== null && topUpAmount > 0,
    retry: false,
  })
}

export function useStartAccountTopUpMutation() {
  return useMutation({
    mutationFn: (topUpAmount: number) =>
      apiFetch<AccountTopUpStartResult>("/api/account-topups/checkout", { method: "POST", body: JSON.stringify({ topUpAmount }) }),
  })
}

/** Polls while PENDING (mirrors ClientBillingSvc.paymentStatus's own "don't wait for the webhook"
 * rationale) — the lawyer sees the account unlock the moment Stripe confirms, not on the next
 * reload. Invalidates the allowance query once SUCCEEDED so the banner/dropdown clear. */
export function useAccountTopUpStatusQuery(topUpId: string | null) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: ["account-topup", "status", topUpId],
    queryFn: async () => {
      const result = await apiFetch<AccountTopUpStatusResult>(`/api/account-topups/${topUpId}`)
      if (result.status === "SUCCEEDED") void queryClient.invalidateQueries({ queryKey: accountAiAllowanceKey })
      return result
    },
    enabled: !!topUpId,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? STATUS_POLL_MS : false),
  })
}
