import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { accountAiAllowanceKey } from "@/lib/account/ai-allowance"

// A lawyer's monthly subscription to one of their tenant's tiers (ilovelawyer-api's
// PaymentPlanBillingSvc). The tiers are admin-edited per tenant, so they're always read from the API.

export interface PaymentPlan {
  code: string
  name: string
  level: number
  /** Per month, in US dollars. */
  feeUsd: number
  /** The AI usage included each month, in dollars of token consumption. */
  includedAllowanceUsd: number
  /** How many cases the account can own. 0 = no limit. */
  caseLimit: number
}

export interface PaymentPlanOptions {
  /** The tenant's active tiers, cheapest first. */
  plans: PaymentPlan[]
  /** The tier the account is on now (a new account starts on the cheapest, unpaid), or null. */
  currentPlanCode: string | null
  /** Whether the lawyer already pays for a subscription. */
  subscribed: boolean
}

export type PaymentPlanSubscriptionStatus = "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED"

export interface PaymentPlanCheckoutResult {
  subscriptionId: string
  status: PaymentPlanSubscriptionStatus
  planCode: string
  checkout: { provider: "STRIPE"; clientSecret: string; publishableKey: string } | null
}

export interface PaymentPlanCheckoutStatus {
  subscriptionId: string
  status: PaymentPlanSubscriptionStatus
  planCode: string
  failureReason: string | null
}

export const paymentPlansKey = ["account", "payment-plans"] as const

const STATUS_POLL_MS = 2000

export function usePaymentPlansQuery() {
  return useQuery({
    queryKey: paymentPlansKey,
    queryFn: () => apiFetch<PaymentPlanOptions>("/api/payment-plans"),
  })
}

export function useStartPaymentPlanCheckoutMutation() {
  return useMutation({
    mutationFn: (planCode: string) =>
      apiFetch<PaymentPlanCheckoutResult>("/api/payment-plans/checkout", { method: "POST", body: JSON.stringify({ planCode }) }),
  })
}

/** Polls while PENDING, like the account top-up: the API checks with Stripe on each read, so the
 * lawyer sees the plan start the moment they've paid, not on the next reload. Once ACTIVE the plans
 * and the AI allowance are refetched (a new allowance period has started). */
export function usePaymentPlanCheckoutStatusQuery(subscriptionId: string | null) {
  const queryClient = useQueryClient()
  return useQuery({
    // Not under paymentPlansKey: invalidating the plans below would refetch this query too, which
    // invalidates them again, forever.
    queryKey: ["account", "payment-plan-checkout", subscriptionId],
    queryFn: async () => {
      const result = await apiFetch<PaymentPlanCheckoutStatus>(`/api/payment-plans/checkout/${subscriptionId}`)
      if (result.status === "ACTIVE") {
        void queryClient.invalidateQueries({ queryKey: paymentPlansKey })
        void queryClient.invalidateQueries({ queryKey: accountAiAllowanceKey })
      }
      return result
    },
    enabled: !!subscriptionId,
    refetchInterval: (query) => (query.state.data?.status === "PENDING" ? STATUS_POLL_MS : false),
  })
}
