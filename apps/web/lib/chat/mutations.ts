import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"

export interface ChatSession {
  session_id: string
}

export interface Conversation {
  id: string
  userId: string
  caseId: string | null
  title: string | null
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
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    },
  })
}

/** Links (or unlinks, with caseId: null) an existing conversation to a case — surfaces the case hub inline. */
export function useLinkConversationCaseMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, caseId }: { conversationId: string; caseId: string | null }) =>
      apiFetch<Conversation>(`/api/chat/conversations/${conversationId}/case`, {
        method: "PATCH",
        body: JSON.stringify({ caseId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() })
    },
  })
}

/** Lists the current user's conversations, most recently created first. */
export function useConversationsQuery() {
  return useQuery({
    queryKey: chatKeys.conversations(),
    queryFn: () => apiFetch<Conversation[]>("/api/chat/conversations"),
  })
}

export function useMessagesQuery(conversationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.messages(conversationId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/api/chat/conversations/${conversationId}/messages`),
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
