import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { userKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"
import { accountAiAllowanceKey } from "@/lib/account/ai-allowance"
import { paymentPlansKey } from "@/lib/account/payment-plans"
import type { CurrentUser } from "@/lib/user/mutations"

/**
 * Verify before plan (ilovelawyer-api's PlanGateSvc, UK only): a solo lawyer or firm founder who
 * signed up since it gets into the app once their Lawyer Application is verified, then chooses a
 * plan. OPEN: in, as before. AWAITING_VERIFICATION: the /verification page's waiting step.
 * CHOOSE_PLAN: its plan step. GET /api/users/me carries it as `planGate`, which the protected layout
 * and onboarding route by; /verification polls this endpoint while it waits.
 */
export type PlanGateState = "OPEN" | "AWAITING_VERIFICATION" | "CHOOSE_PLAN"

/** Keeps the cached /me's planGate in step with a fresher answer, so the layout routes by it. */
function syncCurrentUser(queryClient: QueryClient, state: PlanGateState) {
  queryClient.setQueryData<CurrentUser>(userKeys.me(), (old) => (old ? { ...old, planGate: state } : old))
}

export function usePlanGateQuery(enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: userKeys.planGate(),
    queryFn: async () => {
      const gate = await apiFetch<{ state: PlanGateState }>("/api/users/me/plan-gate")
      syncCurrentUser(queryClient, gate.state)
      return gate
    },
    enabled: !!accessToken && enabled,
    // Waiting on the admin: notice the verification without a reload.
    refetchInterval: (query) => (query.state.data?.state === "AWAITING_VERIFICATION" ? 60_000 : false),
  })
}

/** The plan step's "go on without paying": a solo lawyer's free trial starts now, a founder's firm
 * stays on the unpaid plan. Only for skipping: after subscribing the gate is already open. The trial
 * shows on the plans and the AI allowance, so those are fetched again. */
export function useStartWithoutPayingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ state: PlanGateState }>("/api/users/me/plan-gate/start", { method: "POST" }),
    onSuccess: (gate) => {
      queryClient.setQueryData(userKeys.planGate(), gate)
      syncCurrentUser(queryClient, gate.state)
      void queryClient.invalidateQueries({ queryKey: paymentPlansKey })
      void queryClient.invalidateQueries({ queryKey: accountAiAllowanceKey })
    },
  })
}
