import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { userKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"

/**
 * Verify before plan (ilovelawyer-api's PlanGateSvc, UK only): a solo lawyer or firm founder who
 * signed up since it gets into the app once their Lawyer Application is verified, then chooses a
 * plan. OPEN: in, as before. AWAITING_VERIFICATION: the /verification page's waiting step.
 * CHOOSE_PLAN: its plan step.
 */
export type PlanGateState = "OPEN" | "AWAITING_VERIFICATION" | "CHOOSE_PLAN"

export function usePlanGateQuery(enabled = true) {
  const accessToken = useAuthStore((s) => s.accessToken)
  return useQuery({
    queryKey: userKeys.planGate(),
    queryFn: () => apiFetch<{ state: PlanGateState }>("/api/users/me/plan-gate"),
    enabled: !!accessToken && enabled,
    // Waiting on the admin: notice the verification without a reload.
    refetchInterval: (query) => (query.state.data?.state === "AWAITING_VERIFICATION" ? 60_000 : false),
  })
}

/** The plan step's "go on without paying": a solo lawyer's free trial starts now, a founder's firm
 * stays on the unpaid plan. After subscribing it changes nothing, and still returns OPEN. */
export function useStartWithoutPayingMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<{ state: PlanGateState }>("/api/users/me/plan-gate/start", { method: "POST" }),
    onSuccess: (gate) => queryClient.setQueryData(userKeys.planGate(), gate),
  })
}
