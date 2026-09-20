import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"
import { getNotificationSocket } from "@/lib/notifications/socket"
import type { MindMapItem, TraceStep } from "@/lib/chat/mind-map-parser"
import type { DecisionRecordPayload } from "@/lib/terminal/types"

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

export interface CitationReason {
  title: string
  why_cited: string
}

export interface MessageReasoning {
  reasoning: string
  citationReasons: CitationReason[]
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
  /** Set only when this reply is one topic of a split, multi-topic answer — see
   * ilovelawyer-api's MessageGroup. `groupTitle` is the topic heading; `groupOrder` its
   * position within the group. All three are null/undefined on an ordinary message. */
  groupId?: string | null
  groupOrder?: number | null
  groupTitle?: string | null
  /** This turn's audited Decision Records (chat-wonder-v2-api's legal_decisions.py), persisted
   * on MessageDecisionRecord — see docs/plans/differentiation-program.md Workstream A. Absent on
   * non-legal-persona messages, or a message sent before this shipped. */
  decisionRecords?: { records: DecisionRecordPayload[] } | null
  /** This turn's research/verification trace (ilovelawyer-api#119) — the persisted counterpart
   * of the live-only `[TRACE]` steps ResearchTraceList shows while streaming (see
   * ConsultationChat's doSend). Absent for turns that made no tool calls, or a message sent
   * before this shipped — not an error either way. */
  researchSteps?: { steps: TraceStep[] } | null
  /** The "why this answer" explanation for this turn (legal/legal_uk personas only),
   * generated server-side when the turn actually used tool calls or retrieved sources —
   * absent/null is normal for direct-answer turns or on generation failure, not an error. */
  reasoning?: MessageReasoning | null
  /** Only ever set on a `role: "user"` message — tracks whether ITS reply is still being
   * generated (ilovelawyer-api's Message.replyStatus). Null/absent on assistant/system
   * messages and on user messages sent before this shipped. Drives useMessagesQuery's
   * refetchInterval and consultation-chat.tsx's post-refresh "still generating" bubble —
   * durable, server-side truth for that state instead of relying on in-memory client flags
   * that a full page reload wipes. */
  replyStatus?: "PENDING" | "DONE" | "FAILED" | null
  /** The reply's raw accumulated text as of the last checkpoint, while replyStatus is still
   * PENDING — see Message.pendingReplyContent's doc comment. Null once DONE/FAILED. */
  pendingReplyContent?: string | null
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

/** No interval-based polling — a generating reply's live progress comes from Socket.IO
 * (chat:started/chat:chunk/chat:done/chat:error, see subscribeChatGeneration) instead of
 * refetching this on a timer. `replyStatus: "PENDING"`/`pendingReplyContent` on the last
 * message are still the durable, server-side ground truth consultation-chat.tsx reads to
 * render a "still generating" state after a cold load or remount (they just aren't polled for
 * anymore — a subscribeChatGeneration(pendingMessage.id, ...) subscription is what notices the
 * turn finishing and triggers the one-shot refetch instead). The socket's own "on (re)connect,
 * invalidate chat queries once" handling (useNotificationSocket) is the fallback for events
 * missed while disconnected, plus React Query's normal refetchOnMount/refetchOnWindowFocus. */
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

/** What POST /messages now returns — the API creates an AI generation job (the user Message
 * row itself, PENDING) and hands it to ilovelawyer-api's ChatGenerationQueue; it does NOT wait
 * for RAG/AI generation/persistence before responding. `sessionId` is the resolved (possibly
 * just-rotated) Chat Wonder session id — replaces the old X-Chat-Session-Id response header,
 * since there's no streamed response to attach a header to anymore. */
export interface SendChatMessageResult {
  messageId: string
  sessionId: string
  replyStatus: "PENDING"
}

/** Creates the AI job and returns immediately — it does NOT stream the reply itself anymore.
 * The worker that actually generates the reply runs independently of this call (and of this
 * browser tab staying open); live token-by-token updates arrive separately over the shared
 * notification socket as chat:chunk/chat:done/chat:error events keyed by the returned
 * `messageId` (see useChatGenerationSocket) — this function's only job is to enqueue the turn. */
export async function sendChatMessage({
  consultationId,
  sessionId,
  message,
  documentContext,
  caseDocumentId,
  documentIds,
  caseId,
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
}): Promise<SendChatMessageResult> {
  return apiFetch<SendChatMessageResult>(`/api/chat/consultations/${consultationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ message, sessionId, documentContext, caseDocumentId, documentIds, caseId }),
  })
}

export interface ChatGenerationHandlers {
  /** The worker (ilovelawyer-api's ChatGenerationQueue) confirmed the job is real and is about
   * to start RAG/AI generation — fires before the first chat:chunk. Purely a live-UX signal
   * (e.g. flip straight to a "generating" indicator); nothing waits on it. */
  onStarted?: () => void
  onChunk?: (chunk: string) => void
  onDone?: (assistantMessageId: string) => void
  onError?: (message: string) => void
  /** ilovelawyer-api rotated the Chat Wonder session_id mid-generation (an "Unknown session"
   * retry) — callers should update their cached session_id so the next send doesn't repeat
   * the same failed-then-retried round trip. Rare: only fires when this exact job hit that
   * path, not on every turn. */
  onSessionRotated?: (sessionId: string) => void
}

/** Subscribes to live chat:started/chat:chunk/chat:done/chat:error/chat:session-rotated events
 * for one specific `messageId` (the id sendChatMessage returned), filtered out of the app's
 * single shared notification socket (lib/notifications/socket.ts) — already connected whenever
 * the user is authenticated (see useNotificationSocket, mounted once in Providers), so this
 * reuses that connection/room rather than opening a second one.
 *
 * Purely a live-UX nicety: nothing here is required for correctness. The worker that actually
 * generates the reply (ilovelawyer-api's ChatGenerationQueue) runs independently of whether
 * this subscription exists at all — a refreshed/disconnected tab simply never sees these
 * events and instead falls back to the messages API (useMessagesQuery) for replyStatus/
 * pendingReplyContent, which reaches the same end state regardless (see that hook's doc
 * comment, and the socket's own "on (re)connect, invalidate chat queries once" handling in
 * useNotificationSocket for the no-events-missed guarantee). Returns an unsubscribe function;
 * callers must call it once the turn settles (done/error) or when abandoning the send
 * (navigating away), so listeners don't accumulate on the long-lived shared socket across many
 * sends in one session. */
export function subscribeChatGeneration(messageId: string, handlers: ChatGenerationHandlers): () => void {
  const socket = getNotificationSocket()

  const onStarted = (payload: { messageId: string }) => {
    if (payload.messageId === messageId) handlers.onStarted?.()
  }
  const onChunk = (payload: { messageId: string; chunk: string }) => {
    if (payload.messageId === messageId) handlers.onChunk?.(payload.chunk)
  }
  const onDone = (payload: { messageId: string; assistantMessageId: string }) => {
    if (payload.messageId === messageId) handlers.onDone?.(payload.assistantMessageId)
  }
  const onError = (payload: { messageId: string; message: string }) => {
    if (payload.messageId === messageId) handlers.onError?.(payload.message)
  }
  const onSessionRotated = (payload: { messageId: string; sessionId: string }) => {
    if (payload.messageId === messageId) handlers.onSessionRotated?.(payload.sessionId)
  }

  socket.on("chat:started", onStarted)
  socket.on("chat:chunk", onChunk)
  socket.on("chat:done", onDone)
  socket.on("chat:error", onError)
  socket.on("chat:session-rotated", onSessionRotated)

  return () => {
    socket.off("chat:started", onStarted)
    socket.off("chat:chunk", onChunk)
    socket.off("chat:done", onDone)
    socket.off("chat:error", onError)
    socket.off("chat:session-rotated", onSessionRotated)
  }
}

/** sendChatMessage, then wait for the worker to actually finish the turn — shared by every
 * caller that fires a chat turn and needs it durably persisted before continuing (Studio's
 * Mind Map generation, useAudioOverview's script generation, ConsultationChat's own doSend).
 * "Done" is chat:done/chat:error over the socket (the fast path) OR — the robust, refresh-safe
 * fallback for a socket that's disconnected, reconnecting, or missed the event across a
 * reconnect gap — noticing that useMessagesQuery's own query cache (kept warm by its polling
 * while a caller has a reason to poll) grew by the expected two messages. Sockets can silently
 * miss events; polling against the DB can't.
 *
 * Rejects (with the server's failure message) if the turn ends in chat:error — callers get
 * their existing try/catch's error handling for free instead of needing their own.
 *
 * `queryClient` isn't read from a hook here since this also has to be callable from a plain
 * async callback (ConsultationChat's doSend) — pass the one from the caller's own
 * useQueryClient(). */
export async function sendChatMessageAndWait(
  queryClient: QueryClient,
  args: Parameters<typeof sendChatMessage>[0],
  handlers?: {
    onChunk?: (chunk: string) => void
    onSessionRotated?: (sessionId: string) => void
    /** The persisted-message count before this turn, when the caller has already put an
     * optimistic user message in the cache (optimistic-messages.ts) — otherwise the
     * "grew by two" poll below would be off by one. */
    messagesBefore?: number
    /** The POST returned — `messageId` is the real id of the user message just enqueued. */
    onEnqueued?: (messageId: string) => void
  },
): Promise<{ messageId: string; sessionId: string }> {
  const messagesBefore =
    handlers?.messagesBefore ??
    queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(args.consultationId))?.length ??
    0

  const { messageId, sessionId } = await sendChatMessage(args)
  handlers?.onEnqueued?.(messageId)

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearInterval(pollTimer);
      if (err) reject(err);
      else resolve();
    };

    const unsubscribe = subscribeChatGeneration(messageId, {
      onChunk: handlers?.onChunk,
      onSessionRotated: handlers?.onSessionRotated,
      onDone: () => finish(),
      onError: (message) => finish(new Error(message)),
    });

    // Same 1500ms cadence as useMessagesQuery's own pollWhilePending refetch — piggybacks on
    // that same query cache rather than issuing a second, redundant fetch.
    const pollTimer = setInterval(() => {
      const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(args.consultationId));
      if ((history?.length ?? 0) >= messagesBefore + 2) finish();
    }, 1500);
  });

  return { messageId, sessionId };
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
