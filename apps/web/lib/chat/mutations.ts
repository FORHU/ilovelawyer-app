import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"

export interface ChatSession {
  session_id: string
}

export interface Consultation {
  id: string
  userId: string
  title: string | null
  caseId: string | null
  createdAt: string
}

export type MessageRole = "user" | "assistant" | "system"

export interface ChatMessage {
  id: string
  consultationId: string
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

export function useCreateConsultationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ title, caseId }: { title?: string; caseId?: string } = {}) =>
      apiFetch<Consultation>("/api/chat/consultations", {
        method: "POST",
        body: JSON.stringify({ title, caseId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.consultationsAll() })
    },
  })
}

/** Lists the current user's consultations, most recently created first. Pass `caseId` to
 * scope the list to a single case's consultations instead of every consultation. */
export function useConsultationsQuery(caseId?: string) {
  return useQuery({
    queryKey: chatKeys.consultations(caseId),
    queryFn: () => apiFetch<Consultation[]>(`/api/chat/consultations${caseId ? `?caseId=${caseId}` : ""}`),
  })
}

export function useRenameConsultationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ consultationId, title }: { consultationId: string; title: string }) =>
      apiFetch<Consultation>(`/api/chat/consultations/${consultationId}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.consultationsAll() })
    },
  })
}

export function useDeleteConsultationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (consultationId: string) =>
      apiFetch<void>(`/api/chat/consultations/${consultationId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.consultationsAll() })
    },
  })
}

export function useMessagesQuery(consultationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.messages(consultationId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/api/chat/consultations/${consultationId}/messages`),
    enabled: !!consultationId,
  })
}

/** Legal precedent citations (title, case number, snippet, source url) the AI surfaced
 * while composing the consultation's latest assistant reply — not the user's own cases.
 * Empty until at least one message has been sent in the consultation. */
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

export function useRelatedCasesQuery(consultationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.relatedCases(consultationId ?? ""),
    queryFn: () => apiFetch<{ relatedCases: RelatedCase[] }>(`/api/chat/consultations/${consultationId}/related-cases`),
    enabled: !!consultationId,
  })
}

/** Sends a message and streams the assistant's reply, invoking onChunk as text arrives.
 * Returns `newSessionId` if the backend had to silently rotate to a fresh Chat Wonder
 * session_id mid-request (see ilovelawyer-api's ChatCtrl.sendMessage/streamWithSessionRetry) —
 * callers should update their cached session_id with it so the next message doesn't
 * repeat the same failed-then-retried round trip. */
export async function sendChatMessage({
  consultationId,
  sessionId,
  message,
  documentContext,
  caseDocumentId,
  caseId,
  onChunk,
}: {
  consultationId: string
  sessionId: string
  message: string
  documentContext?: string
  /** Single attached document — backend ranks its chunks for chat-wonder. */
  caseDocumentId?: string
  /** Case scope fallback when consultation docs aren't READY yet / not linked. */
  caseId?: string
  onChunk: (text: string) => void
}): Promise<{ newSessionId?: string }> {
  const res = await apiFetchRaw(`/api/chat/consultations/${consultationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, sessionId, documentContext, caseDocumentId, caseId }),
  })

  const newSessionId = res.headers.get("X-Chat-Session-Id") ?? undefined

  const reader = res.body?.getReader()
  if (!reader) return { newSessionId }

  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    onChunk(decoder.decode(value, { stream: true }))
  }

  return { newSessionId }
}
