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
}

export const accountAiAllowanceKey = ["account", "ai-allowance"] as const

export function useAccountAiAllowanceQuery() {
  return useQuery({
    queryKey: accountAiAllowanceKey,
    queryFn: () => apiFetch<AccountAiAllowance>("/api/users/me/ai-allowance"),
  })
}

export interface AccountTopUpQuote {
  topUpAmountUsd: number
  feeAmountUsd: number
  totalChargedUsd: number
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

export function useAccountTopUpQuoteQuery(topUpAmountUsd: number | null) {
  return useQuery({
    queryKey: ["account-topup", "quote", topUpAmountUsd],
    queryFn: () => apiFetch<AccountTopUpQuote>("/api/account-topups/quote", { method: "POST", body: JSON.stringify({ topUpAmountUsd }) }),
    enabled: topUpAmountUsd !== null && topUpAmountUsd > 0,
    retry: false,
  })
}

export function useStartAccountTopUpMutation() {
  return useMutation({
    mutationFn: (topUpAmountUsd: number) =>
      apiFetch<AccountTopUpStartResult>("/api/account-topups/checkout", { method: "POST", body: JSON.stringify({ topUpAmountUsd }) }),
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
