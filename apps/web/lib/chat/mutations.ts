import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { chatKeys } from "@/lib/query-keys"
import { getNotificationSocket } from "@/lib/notifications/socket"
import type { MindMapItem, TraceStep } from "@/lib/chat/mind-map-parser"
import type { MindMapEditRequest } from "@/components/chat/mind-map/types"
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
  /** The user message that triggered this reply (null/absent on a user message itself). Already
   * present on the wire (ilovelawyer-api spreads the full Message row) — typed here so the
   * latest-turn logic in use-topic-navigator.ts can anchor on the parent's createdAt (set
   * synchronously at submission time) instead of this message's own, which is only set once
   * generation finishes and can land out of submission order under concurrent turns. */
  parentMessageId?: string | null
  /** Populated by GET .../messages (handoff doc §5). Absent/undefined on messages sent before
   * the backend shipped this — always treat as `?? []`. */
  documents?: MessageDocument[]
  /** The AI's mind map for this message, persisted server-side (ilovelawyer-api's
   * chat.service.ts). `null`/absent on messages with no map. `data` is always the current tree
   * (after any "Expand with AI"/undo); `version` counts those edits, 1 = as generated — absent on
   * responses from an API that predates it, treat as 1. */
  mindMap?: { data: MindMapItem; version?: number } | null
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
  replyStatus?: "PENDING" | "DONE" | "FAILED" | "CANCELLED" | null
  /** The reply's raw accumulated text as of the last checkpoint, while replyStatus is still
   * PENDING — see Message.pendingReplyContent's doc comment. Null once DONE/FAILED. */
  pendingReplyContent?: string | null
  /** What the grounding verifier found when it checked THIS answer's claims against the case
   * bundle (ilovelawyer-api docs/plans/grounding-verifier.md). Written after the answer is
   * persisted, so a freshly streamed reply has none until the next messages fetch — and absent
   * entirely unless the verifier is enabled on the API. Empty is not a clean bill of health.
   * `passage` is excluded server-side: it is a slab of bundle text, fetched per-row only when a
   * verdict is actually being audited. */
  groundingChecks?: MessageGroundingCheck[]
  /** Jev triage for a user turn (ilovelawyer-api message-triage.ts): whether the message reads as
   * time-critical, and what it is asking for. Written on send when USE_JEV_MESSAGE_TRIAGE is on;
   * absent otherwise and on assistant messages. */
  urgent?: boolean | null
  intent?: string | null
}

export interface MessageGroundingCheck {
  id: string
  kind: "ABSENCE_CLAIM" | "ASSERTION"
  assertion: string
  citation: string | null
  documentId: string | null
  verdict: "FALSE_ABSENCE" | "NOT_SUPPLIED" | "CORRECT_ABSENCE" | "UNRESOLVED" | "SUPPORTED" | "UNSUPPORTED" | "CONTRADICTED"
  /** Null when the verdict was settled by lookup rather than by the model. */
  confidence: number | null
  evidenceKind: "ASSERTED_BY_PARTY" | "STATED_BY_WITNESS" | "SHOWN_BY_DOCUMENT" | "ESTABLISHED" | null
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

/** A generating reply's live progress comes from Socket.IO (chat:started/chat:chunk/chat:done/
 * chat:error, see subscribeChatGeneration) — that's the fast path and stays the primary way this
 * updates. But that push can be missed (a dropped connection while backgrounded, or this exact
 * consultation not being the active query when the socket reconnects — see useNotificationSocket),
 * and nothing else was re-asking the server when it was. `refetchInterval` below is the real,
 * server-truth fallback for that gap: active ONLY while the last known message is still PENDING,
 * so this stays a no-op (no interval at all) the rest of the time. `replyStatus: "PENDING"`/
 * `pendingReplyContent` on the last message are the durable ground truth consultation-chat.tsx
 * reads to render a "still generating" state after a cold load or remount; this interval is what
 * keeps that state from being able to hang indefinitely on a missed push. */
export function useMessagesQuery(consultationId: string | undefined) {
  return useQuery({
    queryKey: chatKeys.messages(consultationId ?? ""),
    queryFn: () => apiFetch<ChatMessage[]>(`/api/chat/consultations/${consultationId}/messages`),
    enabled: !!consultationId,
    refetchInterval: (query) => {
      const messages = query.state.data as ChatMessage[] | undefined
      const last = messages?.filter((m) => m.role !== "system").at(-1)
      return last?.role === "user" && last.replyStatus === "PENDING" ? 3000 : false
    },
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

export interface CancelChatMessageResult {
  messageId: string
  /** The turn's status after the call — "CANCELLED" if this call stopped it, otherwise whatever
   * it already was (DONE/FAILED/CANCELLED): stopping a finished turn is a harmless no-op. */
  replyStatus: "PENDING" | "DONE" | "FAILED" | "CANCELLED" | null
  /** The partial reply saved as a normal assistant message — absent if nothing had streamed. */
  assistantMessageId?: string
}

/** Stops a turn that is still generating (the composer's Stop button). The API flips the turn to
 * CANCELLED, saves whatever had streamed so far as the reply, and stops the worker — see
 * ilovelawyer-api's ChatSvc.cancelChatGeneration. Idempotent. */
export function cancelChatGeneration(consultationId: string, messageId: string): Promise<CancelChatMessageResult> {
  return apiFetch<CancelChatMessageResult>(`/api/chat/consultations/${consultationId}/messages/${messageId}/cancel`, {
    method: "POST",
  })
}

/** What sendChatMessageAndWait rejects with when the turn was stopped (by this tab's Stop button,
 * another tab's, or a poll noticing replyStatus CANCELLED) — distinct from a failure, so
 * ConsultationChat can show "Response stopped" instead of an error. Other callers just see a
 * rejected promise, same as any turn that didn't complete. */
export class ChatGenerationCancelledError extends Error {
  constructor() {
    super("Generation cancelled")
    this.name = "ChatGenerationCancelledError"
  }
}

export interface ChatGenerationHandlers {
  /** The worker (ilovelawyer-api's ChatGenerationQueue) confirmed the job is real and is about
   * to start RAG/AI generation — fires before the first chat:chunk. Purely a live-UX signal
   * (e.g. flip straight to a "generating" indicator); nothing waits on it. */
  onStarted?: () => void
  onChunk?: (chunk: string) => void
  onDone?: (assistantMessageId: string) => void
  onError?: (message: string) => void
  /** The answer text has fully streamed (chat:answer-complete) but the turn is still finishing
   * its extras (timeline, mind map, reasoning, decisions) before chat:done - see composerAction. */
  onAnswerComplete?: () => void
  /** The turn was stopped (chat:cancelled) — from this tab or any other. */
  onCancelled?: () => void
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
  const onCancelled = (payload: { messageId: string }) => {
    if (payload.messageId === messageId) handlers.onCancelled?.()
  }
  const onAnswerComplete = (payload: { messageId: string }) => {
    if (payload.messageId === messageId) handlers.onAnswerComplete?.()
  }
  const onSessionRotated = (payload: { messageId: string; sessionId: string }) => {
    if (payload.messageId === messageId) handlers.onSessionRotated?.(payload.sessionId)
  }

  socket.on("chat:started", onStarted)
  socket.on("chat:chunk", onChunk)
  socket.on("chat:done", onDone)
  socket.on("chat:error", onError)
  socket.on("chat:cancelled", onCancelled)
  socket.on("chat:answer-complete", onAnswerComplete)
  socket.on("chat:session-rotated", onSessionRotated)

  return () => {
    socket.off("chat:started", onStarted)
    socket.off("chat:chunk", onChunk)
    socket.off("chat:done", onDone)
    socket.off("chat:error", onError)
    socket.off("chat:cancelled", onCancelled)
    socket.off("chat:answer-complete", onAnswerComplete)
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
 * their existing try/catch's error handling for free instead of needing their own. Rejects with
 * ChatGenerationCancelledError if the turn is stopped instead: via `handlers.signal` (this
 * caller's own Stop button), a chat:cancelled event (another tab's Stop), or the poll below
 * seeing the user message's replyStatus flip to CANCELLED (a missed event).
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
    /** The answer text is complete; extras and saving are still to come (see subscribeChatGeneration). */
    onAnswerComplete?: () => void
    /** The persisted-message count before this turn, when the caller has already put an
     * optimistic user message in the cache (optimistic-messages.ts) — otherwise the
     * "grew by two" poll below would be off by one. */
    messagesBefore?: number
    /** The POST returned — `messageId` is the real id of the user message just enqueued. */
    onEnqueued?: (messageId: string) => void
    /** Aborting stops waiting (rejects with ChatGenerationCancelledError) — it does NOT stop the
     * turn on the server by itself; the caller pairs it with cancelChatGeneration. Works before
     * the POST returns too: the wait then ends as soon as the message is enqueued. */
    signal?: AbortSignal
  },
): Promise<{ messageId: string; sessionId: string }> {
  const messagesBefore =
    handlers?.messagesBefore ??
    queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(args.consultationId))?.length ??
    0

  const { messageId, sessionId } = await sendChatMessage(args)
  handlers?.onEnqueued?.(messageId)

  const signal = handlers?.signal
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      unsubscribe();
      clearInterval(pollTimer);
      signal?.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve();
    };

    const unsubscribe = subscribeChatGeneration(messageId, {
      onChunk: handlers?.onChunk,
      onSessionRotated: handlers?.onSessionRotated,
      onAnswerComplete: handlers?.onAnswerComplete,
      onDone: () => finish(),
      onError: (message) => finish(new Error(message)),
      onCancelled: () => finish(new ChatGenerationCancelledError()),
    });

    // Piggybacks on the query cache rather than issuing its own fetch — useMessagesQuery's own
    // refetchInterval (while the turn is PENDING) is what actually keeps this cache current if
    // the socket events above are missed; this just re-checks it on a tighter cadence so
    // sendChatMessageAndWait's own callers don't wait a full refetchInterval tick to notice.
    const pollTimer = setInterval(() => {
      const history = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(args.consultationId));
      // Checked before the "grew by two" test: a stopped turn with a saved partial reply also
      // grows by two, and must still read as cancelled, not done.
      if (history?.some((m) => m.id === messageId && m.replyStatus === "CANCELLED")) {
        finish(new ChatGenerationCancelledError());
      } else if (history?.some((m) => m.id === messageId && m.replyStatus === "FAILED")) {
        // A FAILED turn only ever updates the user message (see ChatMessage.replyStatus) —
        // no assistant reply is persisted, so the "grew by two" check below would never fire
        // on its own. Without this, a missed chat:error (e.g. the socket dropping while the
        // tab was backgrounded) left this promise — and doSend's isSending/spinner — hung
        // forever with no way to retry.
        finish(new Error("Generation failed"));
      } else if ((history?.length ?? 0) >= messagesBefore + 2) finish();
    }, 1500);

    const onAbort = () => finish(new ChatGenerationCancelledError());
    if (signal?.aborted) onAbort();
    else signal?.addEventListener("abort", onAbort, { once: true });
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

/** Result of POST .../mind-map/expand and .../mind-map/revert (ilovelawyer-api's MindMapSvc):
 * the whole updated tree, so the caller can swap it into the messages cache immediately. */
export interface MindMapChangeResult {
  /** "message" = a consultation's chat map; "case" = the case's document-built map
   * (lib/case-workspace/case-mind-map.ts). */
  kind?: "message" | "case"
  caseId?: string
  /** Message maps only. */
  messageId?: string
  version: number
  mindMap: MindMapItem
  /** expand only — the node the children were added under, as a path id. */
  expandedNodeId?: string
  /** edit only — the renamed node, the new point, or (delete) the removed node's parent. */
  editedNodeId?: string
}

/** Asks the AI for 2–5 new children under one node of a consultation's mind map. Synchronous on
 * the API side (a few seconds). Fails with `status` 422 and `code` "MAX_DEPTH"/"MAX_NODES" when
 * the node or map is at a MIND_MAP_LIMITS cap, and 409 when the same node is already expanding. */
export function expandMindMapNode(
  consultationId: string,
  body: { messageId?: string; nodeId: string; count?: number },
): Promise<MindMapChangeResult> {
  return apiFetch<MindMapChangeResult>(`/api/chat/consultations/${consultationId}/mind-map/expand`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** A manual rename / add / delete on a consultation's map, saved as an undoable revision.
 * `code` "MAX_DEPTH"/"MAX_NODES" (422) when an add would pass MIND_MAP_LIMITS. */
export function editMindMapNode(
  consultationId: string,
  body: { messageId?: string } & MindMapEditRequest,
): Promise<MindMapChangeResult> {
  return apiFetch<MindMapChangeResult>(`/api/chat/consultations/${consultationId}/mind-map`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

/** "Undo expand": steps the map back one version. `version` is the one the user is looking at —
 * the API refuses (409) if the map has moved on since, rather than undoing someone else's change. */
export function revertMindMap(
  consultationId: string,
  body: { messageId?: string; version?: number },
): Promise<MindMapChangeResult> {
  return apiFetch<MindMapChangeResult>(`/api/chat/consultations/${consultationId}/mind-map/revert`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

/** Writes an expand/undo result straight into the cached messages so the canvas updates without
 * waiting on a refetch (the caller still invalidates, to pick up anything else that changed). */
export function applyMindMapChange(queryClient: QueryClient, consultationId: string, result: MindMapChangeResult) {
  queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(consultationId), (messages) =>
    messages?.map((m) =>
      m.id === result.messageId ? { ...m, mindMap: { ...m.mindMap, data: result.mindMap, version: result.version } } : m,
    ),
  )
}
