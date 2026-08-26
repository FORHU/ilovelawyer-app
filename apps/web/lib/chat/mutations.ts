import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"
import type { MindMapItem } from "@/lib/chat/mind-map-parser"

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

/** A Case Document attached to the specific message it was sent with (not just the
 * consultation) — see docs/adr/0012-message-scoped-document-attachments.md. `fileUrl` and this
 * whole field are live as of ilovelawyer-api@bfde68b (handoff doc §1, §5); still worth treating
 * a missing/empty array as "no attachments to show" rather than an error, for older messages
 * sent before the backend shipped this. */
export interface MessageDocument {
  id: string
  name: string
  fileUrl: string | null
  mimeType: string | null
}

export interface AudioOverviewTurn {
  speaker: "HOST_A" | "HOST_B"
  text: string
}

export interface MessageAudioOverview {
  turns: AudioOverviewTurn[]
  audioFileId: string | null
  audioStatus: "IN_PROGRESS" | "COMPLETED" | "FAILED" | null
}

export interface ChatMessage {
  id: string
  consultationId: string
  role: MessageRole
  content: string
  createdAt: string
  /** Populated by GET .../messages (handoff doc §5). Absent/undefined on messages sent before
   * the backend shipped this — always treat as `?? []`. */
  documents?: MessageDocument[]
  /** The AI's `[MINDMAP]...[/MINDMAP]` block for this message, extracted and persisted
   * server-side (ilovelawyer-api's chat.service.ts). `null`/absent on messages with no map. */
  mindMap?: { data: MindMapItem } | null
  /** The two-host script for this message, from Chat Wonder's `[AUDIO_OVERVIEW_DATA]` frame
   * (only present when the message matched the audio-overview trigger phrase) — persisted the
   * same way mindMap is. Rendering the script to actual speech is a separate, explicit action
   * (see useGenerateAudioOverviewAudioMutation) — audioFileId/audioStatus start null. */
  audioOverview?: MessageAudioOverview | null
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
  documentIds,
  caseId,
  onChunk,
}: {
  consultationId: string
  sessionId: string
  message: string
  documentContext?: string
  /** Single attached document — backend ranks its chunks for chat-wonder. */
  caseDocumentId?: string
  /** All documents attached to this send, for message-scoped attachment display (ADR 0012) —
   * distinct from caseDocumentId, which is grounding-only. Live as of ilovelawyer-api@bfde68b
   * (docs/message-attachments-backend-handoff.md §3). */
  documentIds?: string[]
  /** Case scope fallback when consultation docs aren't READY yet / not linked. */
  caseId?: string
  onChunk: (text: string) => void
}): Promise<{ newSessionId?: string }> {
  const res = await apiFetchRaw(`/api/chat/consultations/${consultationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, sessionId, documentContext, caseDocumentId, documentIds, caseId }),
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

/** Kicks off Audio Overview rendering for a message's already-generated script — the
 * separate, explicit "Generate Audio" action, never auto-triggered. Mirrors
 * useGenerateReconstructionAudioMutation's shape (start job, then poll). */
export function useGenerateAudioOverviewAudioMutation(consultationId: string) {
  return useMutation({
    mutationFn: (messageId: string) =>
      apiFetch<{ jobName?: string; status: string }>(
        `/api/chat/consultations/${consultationId}/messages/${messageId}/audio-overview/audio`,
        { method: "POST" },
      ),
  })
}

export interface AudioOverviewAudioPollResult {
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED"
  audioFile?: { id: string; fileUrl: string | null }
}

export function pollAudioOverviewAudio(consultationId: string, messageId: string) {
  return apiFetch<AudioOverviewAudioPollResult>(
    `/api/chat/consultations/${consultationId}/messages/${messageId}/audio-overview/audio/poll`,
  )
}
