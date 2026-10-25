import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { accountAiAllowanceKey } from "@/lib/account/ai-allowance"

// A lawyer's monthly subscription to one of their tenant's tiers (ilovelawyer-api's
// PaymentPlanBillingSvc). The tiers are admin-edited per tenant, so they're always read from the API.

export interface PaymentPlan {
  code: string
  name: string
  /** What this tier is for — set by the admin, shown on the plan picker. */
  description: string | null
  level: number
  /** Per month, in US dollars. */
  feeUsd: number
  /** The AI usage included each month, in dollars of token consumption. */
  includedAllowanceUsd: number
  /** How many cases the account can own. 0 = no limit. */
  caseLimit: number
  /** Client requests (the UK client hand-off) the lawyer can take on per calendar month. 0 = no limit. */
  clientRequestLimit: number
}

export interface PaymentPlanOptions {
  /** The tenant's active tiers, cheapest first. */
  plans: PaymentPlan[]
  /** The tier the account is on now (a new account starts on the cheapest, unpaid), or null. */
  currentPlanCode: string | null
  /** Whether the lawyer already pays for a subscription. */
  subscribed: boolean
  /** When a solo lawyer's free trial ends or ended (ISO), null with no trial. */
  trialEndsAt: string | null
  /** The trial is over and nothing is paid: the account is read-only until they subscribe. */
  trialEnded: boolean
  /** When the paid period ends (ISO): the next charge, and when a scheduled downgrade happens. */
  renewsAt: string | null
  /** The cheaper tier the lawyer moves to at renewsAt, or null. */
  scheduledPlanCode: string | null
}

/** What choosing another tier does to a live subscription (ilovelawyer-api's PlanChangeKind). */
export type PlanChangeKind = "UPGRADE" | "DOWNGRADE" | "KEEP"

export interface PlanChangePreview {
  kind: PlanChangeKind
  planCode: string
  /** Charged to the saved card now, for an upgrade (the prorated rest of this period); 0 otherwise. */
  amountDueNow: number
  currency: string
  /** When a downgrade takes effect (ISO); null for an upgrade, which is immediate. */
  effectiveAt: string | null
  renewsAt: string | null
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

/** What moving to `planCode` would cost or when it would happen, for the confirm dialog. Not cached
 * for long: an upgrade's prorated amount shrinks as the period goes on. */
export function usePlanChangePreviewQuery(planCode: string | null) {
  return useQuery({
    queryKey: ["account", "payment-plan-change", planCode],
    queryFn: () => apiFetch<PlanChangePreview>(`/api/payment-plans/change?planCode=${encodeURIComponent(planCode!)}`),
    enabled: !!planCode,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  })
}

/** Changes the live subscription's tier. The response is the lawyer's plans as they now stand; an
 * upgrade also raises the AI allowance at once, so that's refetched too. */
export function useChangePlanMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (planCode: string) =>
      apiFetch<PaymentPlanOptions>("/api/payment-plans/change", { method: "POST", body: JSON.stringify({ planCode }) }),
    onSuccess: (options) => {
      queryClient.setQueryData(paymentPlansKey, options)
      void queryClient.invalidateQueries({ queryKey: accountAiAllowanceKey })
    },
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
