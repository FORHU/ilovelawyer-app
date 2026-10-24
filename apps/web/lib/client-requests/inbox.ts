import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { clientRequestKeys } from "@/lib/query-keys"
import { claimClientRequest, listClientRequests, passClientRequest } from "./api"
import type { ClientRequestForLawyer, ClientRequestInboxView, ClientRequestListResponse } from "./types"

export type { ClientRequestForLawyer, ClientRequestInboxView, ClientRequestListResponse }

const DEFAULT_LIMIT = 10

export function useClientRequestInboxQuery(view: ClientRequestInboxView, page = 1, limit = DEFAULT_LIMIT, enabled = true) {
  return useQuery({
    queryKey: clientRequestKeys.list(view, page, limit),
    queryFn: () => listClientRequests(view, page, limit),
    enabled,
  })
}

/** Cheap count for the nav tab's badge — just the inbox's first page, read for its `total`. */
export function useClientRequestInboxCountQuery(enabled: boolean) {
  const query = useClientRequestInboxQuery("inbox", 1, 1, enabled)
  return query.data?.total ?? 0
}

export function useClaimClientRequestMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => claimClientRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.all }),
  })
}

export function usePassClientRequestMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => passClientRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.lists() }),
  })
}

/** An apiFetch rejection carrying CARD_REQUIRED (claim(), #505): no card on the organization yet
 * — the caller opens the add-card modal (components/client-requests/add-card-modal.tsx) instead
 * of showing it as a plain error. */
export function isCardRequiredError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "CARD_REQUIRED"
}
