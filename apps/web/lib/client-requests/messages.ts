import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { clientRequestKeys } from "@/lib/query-keys"
import type { EngagementMessage, EngagementThreadPage } from "@/lib/client-handoff"

// The lawyer's thread with the client (ilovelawyer-api#517): from joining the request (phase 5b), and
// still readable once their claim ends or the engagement closes. New client messages arrive as
// engagement:message on the shared socket, which refetches this query (socket.ts). A thread is
// short, so it's read whole.

const THREAD_LIMIT = 200

export function useEngagementMessagesQuery(requestId: string, enabled = true) {
  return useQuery({
    queryKey: clientRequestKeys.messages(requestId),
    queryFn: () => apiFetch<EngagementThreadPage>(`/api/client-requests/${requestId}/messages?limit=${THREAD_LIMIT}`),
    enabled,
  })
}

export function usePostEngagementMessageMutation(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      apiFetch<EngagementMessage>(`/api/client-requests/${requestId}/messages`, { method: "POST", body: JSON.stringify({ body }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: clientRequestKeys.messages(requestId) }),
  })
}

/** The client's messages up to now stop counting as unread. */
export function useMarkEngagementMessagesReadMutation(requestId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>(`/api/client-requests/${requestId}/messages/read`, { method: "POST" }),
    onSuccess: () =>
      queryClient.setQueryData<EngagementThreadPage>(clientRequestKeys.messages(requestId), (page) => (page ? { ...page, unread: 0 } : page)),
  })
}
