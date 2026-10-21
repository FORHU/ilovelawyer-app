import { useEffect } from "react"
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { clientRequestKeys } from "@/lib/query-keys"
import type { ClientRequestInboxView } from "@/lib/client-requests/types"
import {
  ClientRequestApiError,
  mockClaimClientRequest,
  mockListClientRequests,
  mockPassClientRequest,
  scheduleDemoTakenEvent,
  subscribeMockClientRequestEvents,
} from "@/lib/client-requests/mock-backend"

export type { ClientRequestForLawyer, ClientRequestInboxView, ClientRequestListResponse } from "@/lib/client-requests/types"
export { ClientRequestApiError }

const DEFAULT_LIMIT = 10

export function useClientRequestInboxQuery(view: ClientRequestInboxView, page = 1, limit = DEFAULT_LIMIT, enabled = true) {
  return useQuery({
    queryKey: clientRequestKeys.list(view, page, limit),
    // ilovelawyer-api#511 isn't built yet — see mock-backend.ts's header comment. Swap for
    // apiFetch<ClientRequestListResponse>(`/client-requests?view=${view}&page=${page}&limit=${limit}`)
    // once it lands; the response shape already matches.
    queryFn: () => mockListClientRequests(view, page, limit),
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
    mutationFn: (id: string) => mockClaimClientRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.all }),
  })
}

export function usePassClientRequestMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => mockPassClientRequest(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.lists() }),
  })
}

/** `client-request:taken` handling, shared by the real socket registrar (socket.ts, wired into
 * useNotificationSocket for once ilovelawyer-api#511/#509 start emitting it) and the mock
 * BroadcastChannel transport below — same invalidation either way, since the REST routes stay
 * the source of truth and a push is just a refetch trigger. */
export function invalidateOnClientRequestTaken(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: clientRequestKeys.lists() })
}

/** Keeps the inbox honest while someone's looking at it: drops a request the instant it's
 * taken, instead of waiting for the next manual refresh. Mounted once by the inbox page.
 * registerClientRequestSocketHandlers (socket.ts) covers the same event over the real socket,
 * mounted app-wide in useNotificationSocket — this hook additionally covers the mock
 * BroadcastChannel transport (mock-backend.ts) used until ilovelawyer-api#511/#509 ship. */
export function useClientRequestLiveUpdates(): void {
  const queryClient = useQueryClient()

  useEffect(() => {
    scheduleDemoTakenEvent()
    return subscribeMockClientRequestEvents(() => invalidateOnClientRequestTaken(queryClient))
  }, [queryClient])
}

export function isCardRequiredError(error: unknown): boolean {
  return error instanceof ClientRequestApiError && error.code === "CARD_REQUIRED"
}
