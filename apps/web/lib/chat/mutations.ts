import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"

export interface ChatSession {
  session_id: string
}

export interface Conversation {
  id: string
  userId: string
  title: string | null
  caseId: string | null
  createdAt: string
}

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  createdAt: string
}

export function useChatSessionQuery() {
  return useQuery({
    queryKey: chatKeys.session(),
    queryFn: () => apiFetch<ChatSession>("/api/chat/session"),
    staleTime: Infinity,
  })
}

export function useCreateConversationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ title, caseId }: { title?: string; caseId?: string } = {}) =>
      apiFetch<Conversation>("/api/chat/conversations", {
        method: "POST",
        body: JSON.stringify({ title, caseId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsAll() })
    },
  })
}

/** Lists the current user's conversations, most recently created first. Pass `caseId` to
 * scope the list to a single case's conversations instead of every conversation. */
export function useConversationsQuery(caseId?: string) {
  return useQuery({
    queryKey: chatKeys.conversations(caseId),
    queryFn: () => apiFetch<Conversation[]>(`/api/chat/conversations${caseId ? `?caseId=${caseId}` : ""}`),
  })
}

export function useRenameConversationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, title }: { conversationId: string; title: string }) =>
      apiFetch<Conversation>(`/api/chat/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsAll() })
    },
  })
}

export function useDeleteConversationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) =>
      apiFetch<void>(`/api/chat/conversations/${conversationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsAll() })
    },
  })
}

export function useMessagesQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages`),
    enabled: !!conversationId,
  })
}

/** Legal precedent citations (title, case number, snippet, source url) the AI surfaced
 * while composing the conversation's latest assistant reply — not the user's own cases.
 * Empty until at least one message has been sent in the conversation. */
export interface RelatedCase {
  type: string
  title: string | null
  url: string | null
  case_number: string | null
  ra_number: string | null
  year: unknown
  snippet: string | null
  relevance: number | null
  vetted: boolean
}

export function useRelatedCasesQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.relatedCases(conversationId ?? ""),
    queryFn: () => apiFetch<{ relatedCases: RelatedCase[] }>(`/api/chat/conversations/${conversationId}/related-cases`),
    enabled: !!conversationId,
  })
}

/** Sends a message and streams the assistant's reply, invoking onChunk as text arrives. */
export async function sendChatMessage({
  conversationId,
  sessionId,
  message,
  documentContext,
  onChunk,
}: {
  conversationId: string
  sessionId: string
  message: string
  documentContext?: string
  onChunk: (text: string) => void
}): Promise<void> {
  const res = await apiFetchRaw(`/api/chat/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, sessionId, documentContext }),
  })

  const reader = res.body?.getReader()
  if (!reader) return

  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }
}
