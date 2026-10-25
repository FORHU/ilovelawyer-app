import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { clientRequestKeys } from "@/lib/query-keys"
import type { AiBudgetState, Money } from "@/lib/client-handoff"
import type { ChargeRecord } from "@/lib/organizations/billing"
import { listClientRequests } from "./api"

// An engagement's own AI budget (ilovelawyer-api#515): what came with the introduction fee plus any
// top-ups (#516), metered on the lawyer's workspace copy of the client's case. The meter
// (FORHU/ilovelawyer-app#883) and the top-up modal (#885) read and buy through these. The API sends
// engagement:ai-budget when it crosses 80% or 100% or is topped up, which refetches the meter
// (socket.ts); AI work refused at 100% answers 403 ENGAGEMENT_AI_BUDGET_SPENT.

export interface AiBudget {
  included: Money
  toppedUp: Money
  used: Money
  remaining: Money
  percentUsed: number
  state: AiBudgetState
}

export interface TopUpPack {
  id: string
  name: string
  price: Money
  credit: Money
}

export function useEngagementAiBudgetQuery(requestId: string | null) {
  return useQuery({
    queryKey: clientRequestKeys.aiBudget(requestId ?? ""),
    queryFn: () => apiFetch<AiBudget>(`/api/client-requests/${requestId}/ai-budget`),
    enabled: !!requestId,
  })
}

export function useTopUpPacksQuery(enabled: boolean) {
  return useQuery({
    queryKey: clientRequestKeys.topUpPacks(),
    queryFn: () => apiFetch<TopUpPack[]>("/api/billing/top-up-packs"),
    enabled,
  })
}

/** Buys a pack, with the lawyer's approval (`approved: true` is what the API requires). Resolves to
 * the charge: SUCCEEDED, or PENDING while the bank decides (the credit lands with the webhook). */
export function useBuyTopUpMutation(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (packId: string) =>
      apiFetch<ChargeRecord>(`/api/client-requests/${requestId}/ai-top-ups`, { method: "POST", body: JSON.stringify({ packId, approved: true }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.aiBudget(requestId) }),
  })
}

/**
 * The engagement whose workspace copy `caseId` is, or null: the meter shows in that case's
 * Terminal. Read from the lawyer's own engaged requests (each carries its copyCaseId), so a case
 * that isn't one, or a lawyer who doesn't take client requests (the list answers 403), shows none.
 */
export function useEngagementForCopy(caseId: string) {
  const query = useQuery({
    queryKey: [...clientRequestKeys.lists(), "engaged-copies"],
    queryFn: () => listClientRequests("mine", 1, 100),
    retry: false,
    staleTime: 60_000,
  })
  const request = query.data?.data.find((r) => r.status === "ENGAGED" && r.engagement?.copyCaseId === caseId)
  return request ? { requestId: request.id, clientName: request.engagement!.clientName } : null
}

/** Whether an error is the engagement's AI budget being spent (403 ENGAGEMENT_AI_BUDGET_SPENT). */
export function isEngagementBudgetSpent(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "ENGAGEMENT_AI_BUDGET_SPENT"
}
