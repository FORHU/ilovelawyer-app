import type { QueryClient } from "@tanstack/react-query"
import { chatKeys } from "@/lib/query-keys"
import type { ChatMessage } from "@/lib/chat/mutations"

/** Writes the just-sent user prompt into the messages query cache (as a PENDING turn) instead of
 * leaving it only in ConsultationChat's local `pendingTurn` state. `pendingTurn` dies with the
 * component, and the query cache is considered fresh for 5 minutes (see providers.tsx), so a
 * remount — switching tabs/consultations mid-generation, then coming back — would otherwise read
 * a stale history with no trace of the prompt until the reply finished and the final refetch
 * landed. Living in the cache means any instance, mounted or not, sees "prompt sent, reply
 * pending", which is exactly what ConsultationChat's isResumedGenerating keys off.
 *
 * The temp id is swapped for the server's id by resolveOptimisticMessageId once the POST returns,
 * and the whole entry is replaced by the real one on the next refetch. Returns the temp id. */
export function appendOptimisticUserMessage(
  queryClient: QueryClient,
  consultationId: string,
  content: string,
): string {
  const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(consultationId), (prev) => [
    ...(prev ?? []),
    {
      id: tempId,
      consultationId,
      role: "user",
      content,
      createdAt: new Date().toISOString(),
      replyStatus: "PENDING",
      pendingReplyContent: null,
    },
  ])
  return tempId
}

/** Swaps an optimistic message's temp id for the server-assigned one, so anything that subscribes
 * by message id (ConsultationChat's resumed-generation socket subscription) targets the real job. */
export function resolveOptimisticMessageId(
  queryClient: QueryClient,
  consultationId: string,
  tempId: string,
  realId: string,
) {
  queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(consultationId), (prev) =>
    prev?.map((m) => (m.id === tempId ? { ...m, id: realId } : m)),
  )
}

export function isOptimisticMessageId(id: string | undefined): boolean {
  return !!id && id.startsWith("optimistic-")
}
