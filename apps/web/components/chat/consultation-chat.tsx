"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Paperclip, X, Plus, ArrowUpRight, Loader2, AlertCircle, CheckCircle2, RotateCcw, Workflow, MessageSquare, Clock, Grid2x2, PanelLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import AssistantMessage, { ThinkingIndicator } from "@/components/chat/assistant-message";
import ConsultationSidebar from "@/components/chat/consultation-sidebar";
import TopicNavigator from "@/components/chat/topic-navigator";
import VoiceDictate from "@/components/chat/voice-dictate";
import { AUTO_MINDMAP_PROMPT, AUTO_AUDIO_OVERVIEW_PROMPT } from "@/lib/chat/auto-prompts";
import { useTopicNavigator } from "@/lib/chat/use-topic-navigator";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";
import { ThreadPicker } from "@/components/chat/thread-picker";
import { HubRelatedCases } from "@/components/chat/case-hub-widget";
import { MessageAttachments, type MessageAttachment } from "@/components/chat/message-attachments";
import FilePreviewModal from "@/components/chat/file-preview-modal";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import {
  useChatSessionQuery,
  useConsultationsQuery,
  useCreateConsultationMutation,
  useMessagesQuery,
  useRelatedCasesQuery,
  sendChatMessage,
  type ChatMessage,
} from "@/lib/chat/mutations";
import { extractMindMap, extractTraceSteps, stripStructuredBlocks, getActiveMindMap, type MindMapItem, type TraceStep } from "@/lib/chat/mind-map-parser";
import { ResearchTraceList } from "@/components/chat/research-trace-list";
import { useCaseQuery, useCaseDocumentsQuery, useConsultationDocumentsQuery, useUploadDocumentsMutation } from "@/lib/cases/mutations";
import { useCaseSnapshotQuery, useAiJobStatus } from "@/lib/terminal/mutations";
import {
  useUploadAudioMutation,
  useCreateTranscriptionMutation,
  useStartTranscriptionJobMutation,
  pollTranscriptionJobUntilDone,
  chunkTranscription,
} from "@/lib/transcription/mutations";

import { chatKeys } from "@/lib/query-keys";
import { generateId } from "@/lib/id";
import { useMediaQueueStore, type TranscriptionStatus } from "@/lib/store/media-queue.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

// Copy for the composer's transcribing indicator, keyed off the same media-queue
// TranscriptionStatus values transcribeAndSend already writes via updateTranscript — no
// separate status vocabulary to keep in sync. Only the in-flight stages need copy here.
const TRANSCRIBE_STAGE_COPY: Partial<Record<TranscriptionStatus, { key: string; defaultValue: string }>> = {
  uploading: { key: "input.transcribeUploading", defaultValue: "Uploading recording…" },
  starting: { key: "input.transcribeStarting", defaultValue: "Starting transcription…" },
  in_progress: { key: "input.transcribing", defaultValue: "Transcribing…" },
};

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** Only ever set when `enableFileChips` is on (ADR 0012) — Case Chat never populates this. */
  attachments?: MessageAttachment[];
  /** The AI's case strategy map, extracted from `[MINDMAP]...[/MINDMAP]` — during streaming
   * this is recomputed from the raw accumulated text on every chunk (see doSend); once the
   * message is persisted it comes straight from the backend (see baseMessages below). */
  mindMap?: MindMapItem;
  /** Live research steps extracted from `[TRACE]...[/TRACE]` frames while this message is
   * streaming — see doSend. Never persisted; gone once the turn finishes. */
  researchSteps?: TraceStep[];
  /** Set only when this reply is one topic of a split, multi-topic answer (see
   * ilovelawyer-api's MessageGroup) — `groupTitle` is that topic's heading, used as the
   * TopicNavigator label (see use-topic-navigator.ts). Not rendered inside the bubble itself:
   * the reply's own markdown heading already carries the same title, so showing `groupTitle`
   * again above it just duplicated it. Never set while a message is still streaming; splits
   * only appear once persisted. */
  groupId?: string | null;
  groupTitle?: string | null;
}

// Matches the ChatGPT/Claude convention — generous for a batch of case exhibits without
// the attachment-chip row or upload/indexing time getting unwieldy.
const MAX_ATTACHED_FILES = 10;
// No backend size cap on the presigned-S3 case-document upload path either (unlike the
// /api/files/upload route the voice recorder uses, which multer caps at 25MB — see
// ilovelawyer-api/src/routes/files.route.ts). Matching that existing number here rather
// than inventing a new one: generous for a scanned legal PDF, but keeps a single attachment
// from stalling the browser upload / RAG indexing for minutes.
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

// How many pills show under the empty-state composer, and how many of those slots (at
// most) get pulled from the case's own uploaded documents / the user's consultation
// history rather than the predefined pool — see `suggestedPrompts` below. Document-backed
// pills take priority (most concretely actionable — "Summarize <the file just uploaded>"),
// then history, then the pool fills whatever's left.
const SUGGESTED_PROMPT_COUNT = 4;
const MAX_DOCUMENT_SUGGESTIONS = 2;
const MAX_HISTORY_SUGGESTIONS = 2;

// Fisher-Yates — used to randomize which predefined prompts show, and their order,
// instead of always showing the same static four (see `suggestedPrompts` below).
function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

type CaseChatTab = "chat" | "mindmap" | "timeline";

function tabFromSearch(searchParams: URLSearchParams, mindMapOnly: boolean, caseId?: string): CaseChatTab {
  if (mindMapOnly) return "mindmap";
  if (!caseId) return "chat";
  const tab = searchParams.get("tab");
  if (tab === "mindmap" || tab === "timeline") return tab;
  return "chat";
}

interface ConsultationChatProps {
  /** Route this chat lives at — consultation selection is driven by a `?c=<id>` query
   * param appended to this path, so the same component works at "/homepage" and at a
   * case's own route. */
  basePath: string;
  /** Scopes the sidebar's consultation list to this case, and tags new consultations
   * created here with it, so a case's chat only ever shows consultations about that case. */
  caseId?: string;
  /** Overrides for the empty-state copy shown before any consultation is picked/started. */
  emptyStateHeading?: string;
  emptyStateSubheading?: string;
  /** Full-bleed background image behind the empty-state landing (Consultation redesign only). */
  emptyStateHeroImage?: string;
  /** Fallback pool for the clickable example-prompt pills shown below the composer on the
   * empty-state landing — used to fill out slots `suggestedPrompts` can't cover from the
   * case's own documents or the user's consultation history (see there). */
  emptyStatePrompts?: string[];
  /** Shows the suggested-prompt pills on the empty-state landing. Defaults to `!embedded`
   * (the general /homepage chat) — Case Workspace opts back in explicitly despite being
   * `embedded` (it has the width for pills and, unlike a cramped Terminal split pane,
   * benefits from case-aware suggestions once a document's been uploaded); Terminal's
   * chat/mind-map panes stay opted out. */
  showSuggestedPrompts?: boolean;
  /** Rendered above the transcript, inside the centered chat column — e.g. a case details panel. */
  headerSlot?: React.ReactNode;
  /** Compact layout for a terminal pane. Case Portfolio does not pass this. */
  embedded?: boolean;
  /** Case Workspace only — the title header (case-workspace.tsx) and this chat's input dock
   * stay full-width with a `px-6` gutter (instead of `embedded`'s bare `px-2`), tracking
   * Sources/Studio's drag/collapse edge to edge like NotebookLM's own query bar. The message
   * transcript is deliberately decoupled from that: it gets its own centered `max-w-[850px]`
   * column regardless of sidebar state, so responses stay a comfortable, fixed reading width
   * — recentering as the sidebars move, but never stretching edge to edge — while the chatbox
   * below it still fills the full column. Terminal's chat/mind-map panes stay at `embedded`'s
   * existing `px-2` throughout — they're already narrow split panes with no room to spare. */
  centerContent?: boolean;
  /** Tracks the active consultation in local state instead of the page's `?c=` URL param.
   * Needed only when more than one ConsultationChat can be mounted on the same page at once
   * (Terminal's Chat and Mind Map panes) — otherwise they fight over the one shared param, and
   * one resolving/creating its consultation silently redirects the other's transcript out from
   * under it. Case Workspace's embedded chat is still URL-driven (its sibling ThreadPicker
   * navigates the same `?c=` param), so this defaults to false rather than following `embedded`. */
  isolateConsultation?: boolean;
  /** Terminal Visual Strategy Map pane — map canvas only, no chat transcript. */
  mindMapOnly?: boolean;
  /** Overrides the composer placeholder. Terminal panes pass a shorter prompt. */
  inputPlaceholder?: string;
  /** Shows uploaded files as clickable chips on the message they were sent with (ChatGPT-style),
   * instead of collapsing them into placeholder text. General Consultation page only — Case Chat
   * intentionally doesn't set this (see docs/adr/0012-message-scoped-document-attachments.md);
   * Case Documents already have a dedicated surface (case-details-panel.tsx) with separate,
   * already-planned changes of its own that this deliberately doesn't preempt. */
  enableFileChips?: boolean;
}

export default function ConsultationChat({
  basePath,
  caseId,
  emptyStateHeading,
  emptyStateSubheading,
  emptyStateHeroImage,
  emptyStatePrompts,
  showSuggestedPrompts,
  headerSlot,
  embedded = false,
  centerContent = false,
  isolateConsultation = false,
  mindMapOnly = false,
  inputPlaceholder,
  enableFileChips = false,
}: ConsultationChatProps) {
  const { t } = useTranslation("homepage");
  const router = useRouter();
  // Lifted out of ConsultationSidebar so the workspace below can reserve room for the
  // expanded rail (pushing content over) instead of letting it overlay whatever's at the
  // page's left edge — on the case page that's the back link/case chip header row, which
  // the expanded rail would otherwise cover.
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  // Mobile drawer open state, also lifted up (same reason as sidebarExpanded) — lets a
  // trigger button render inline with page content (the conversation title / empty-state
  // heading) instead of ConsultationSidebar's own floating circle being the only way in.
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  // Mirrors sidebarExpanded's reserve-room pattern below, but for TopicNavigator on the
  // right — defaults open since the panel only ever mounts for a split reply already on
  // screen (a rare, deliberate moment), unlike the always-present left sidebar.
  const [topicPanelExpanded, setTopicPanelExpanded] = useState(true);
  // Each selected/dropped file queues locally as "pending" — nothing uploads until Send is
  // clicked, since (unlike create-case) there's no earlier "creation" step to anchor an
  // eager upload to. "doc" is set once that entry's presign→PUT→confirm sequence resolves.
  const [queuedFiles, setQueuedFiles] = useState<
    Array<{
      id: string;
      file: File;
      status: "pending" | "uploading" | "uploaded" | "error";
      doc?: { id: string; name: string; aiSummary: string | null; ragStatus?: "PENDING" | "READY" | "FAILED" };
    }>
  >([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  // Set when a select/drop/paste got clipped by MAX_ATTACHED_FILES — cleared on the next
  // add attempt so it doesn't linger once the user's back under the cap.
  const [fileLimitHit, setFileLimitHit] = useState(false);
  // Names of any files a select/drop/paste dropped for exceeding MAX_FILE_SIZE_BYTES —
  // cleared on the next add attempt, same lifecycle as fileLimitHit.
  const [oversizedFileNames, setOversizedFileNames] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The attachment chip currently open in FilePreviewModal, or null when the modal is closed.
  const [previewAttachment, setPreviewAttachment] = useState<MessageAttachment | null>(null);
  // Blob URLs minted for just-sent attachments (see handleSendMessage) so this session's own
  // sends preview instantly without waiting on the backend's fileUrl (not live yet — ADR 0012).
  // Revoked on unmount only, not per-send, since a still-open preview modal or a message still
  // visible in the transcript may reference one after the send that created it has settled.
  const blobUrlsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);
  const queueDocument = useMediaQueueStore((s) => s.queueDocument);
  const queueTranscript = useMediaQueueStore((s) => s.queueTranscript);
  const updateTranscript = useMediaQueueStore((s) => s.updateTranscript);
  const startSending = useSendingConsultationsStore((s) => s.startSending);
  const stopSending = useSendingConsultationsStore((s) => s.stopSending);
  const uploadDocuments = useUploadDocumentsMutation();
  const uploadAudio = useUploadAudioMutation();
  const createTranscription = useCreateTranscriptionMutation();
  const startTranscriptionJob = useStartTranscriptionJobMutation();

  // Owned by VoiceDictate itself (mic/AudioContext/MediaRecorder) — this just mirrors its
  // recording state so the rest of the composer (+/textarea/Send) can hide while dictating.
  const [isRecording, setIsRecording] = useState(false);
  // Id of the media-queue row a just-stopped recording is running through the real AWS
  // Transcribe pipeline as (see transcribeAndSend below) — separate from isRecording, since
  // VoiceDictate itself has already settled back to idle by the time this resolves. The
  // *stage* shown in the composer is read straight off that row's own `status` below
  // (transcribeStatus) rather than tracked a second time here.
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const transcribeStatus = useMediaQueueStore((s) => s.transcripts.find((t) => t.id === transcribingId)?.status);
  const searchParams = useSearchParams();
  // See isolateConsultation's doc comment above — only set for panes that can be mounted
  // alongside another ConsultationChat sharing the same page URL.
  const [localConsultationId, setLocalConsultationId] = useState<string | null>(null);
  const urlConsultationId = isolateConsultation ? localConsultationId : searchParams.get("c");
  const queryClient = useQueryClient();

  const consultationId = urlConsultationId;
  // Centralizes every place that used to write `?c=` to the URL — routes through local
  // state instead when isolated, per isolateConsultation's doc comment. useCallback keeps this
  // referentially stable so the auto-select effect below can safely depend on it.
  const navigateToConsultation = useCallback(
    (id: string | null, opts?: { replace?: boolean }) => {
      if (isolateConsultation) {
        setLocalConsultationId(id);
        return;
      }
      const href = id ? `${basePath}?c=${id}` : basePath;
      if (opts?.replace) router.replace(href);
      else router.push(href);
    },
    [isolateConsultation, basePath, router],
  );
  // Key used to scope a pending (in-flight) send's local buffer to a consultation. A
  // brand-new chat (first message, no id yet) uses this placeholder until the backend
  // assigns a real id.
  const NEW_CONSULTATION_KEY = "__new__";

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Holds the user message + streaming assistant reply for a send that hasn't landed in
  // the consultation's saved history yet, keyed to the consultation it belongs to. The
  // rendered `messages` below only use it while `key` matches the consultation on screen,
  // so switching consultations mid-send stops showing it automatically — no manual
  // clearing/resetting required, which is what made the old version prone to getting
  // stuck showing stale or empty content until a full reload.
  const [pendingTurn, setPendingTurn] = useState<{ key: string; messages: DisplayMessage[] } | null>(null);
  // Bumped on every send and on every explicit navigation away from the consultation a
  // send belongs to, so a stale in-flight stream can recognize it's been abandoned and
  // stop writing chunks into whatever consultation is now on screen.
  const sendTokenRef = useRef(0);
  // Set right after a first-message send creates a brand-new consultation, to the id it
  // was just given — before `router.push(...?c=<id>)`'s URL change has actually landed in
  // `consultationId` (that takes an extra render). Without this, `consultationKey` below
  // would still read as "new" for that gap, `pendingTurn` (already re-keyed to the real
  // id) would stop matching it, and the reply being streamed into it would render as
  // missing — exactly for a brand-new consultation's first message, self-correcting on
  // every message after since `consultationId` is already resolved by then. Cleared once
  // the send settles or the user explicitly navigates elsewhere. State (not a ref) since
  // it has to affect what gets rendered.
  const [pendingUrlConsultationId, setPendingUrlConsultationId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // Synchronous mirror of a just-created consultation's id — state (pendingUrlConsultationId)
  // only reflects it a render later, which is too late for callers within the same
  // handleSendMessage call (upload needs the id before doSend runs). Cleared whenever the user
  // explicitly leaves this consultation (new chat / switch), so a stale id from the previous
  // chat never leaks into the next one's uploads.
  const resolvedConsultationIdRef = useRef<string | null>(null);
  // Dedupes concurrent ensureConsultationId() calls (e.g. an upload racing the send that
  // triggered it) onto a single create-consultation request instead of firing one each.
  const consultationCreationRef = useRef<Promise<string> | null>(null);

  const { data: session } = useChatSessionQuery();
  const createConsultation = useCreateConsultationMutation();
  const { data: history, isLoading: historyLoading } = useMessagesQuery(consultationId ?? undefined, {
    pollWhilePending: !!pendingTurn,
  });
  const { data: caseConsultations } = useConsultationsQuery(caseId);
  const snapshotQuery = useCaseSnapshotQuery(caseId ?? "");
  const mindMapJob = useAiJobStatus(caseId ?? "", "mindMap");
  const isGeneratingMindMap = isSending || mindMapJob.data?.status === "IN_PROGRESS";

  // Explicit case linkage for the sticky conversation header's linked-case chip. On a case's own chat
  // page the `caseId` prop already pins it; on the general /homepage chat, fall back to
  // whichever case the current consultation is tagged with, or a pending ?caseId= carried
  // over from a case's "Start Chat" action. Deliberately does NOT fall back further to
  // "the user's most recently active case" — that previously leaked one consultation's
  // case into every other unrelated consultation's hub.
  const pendingCaseId = searchParams.get("caseId") ?? "";
  const linkedCaseId =
    caseId ??
    (consultationId
      ? (caseConsultations?.find((c) => c.id === consultationId)?.caseId ?? null)
      : pendingCaseId || null);

  const { data: caseDocuments } = useCaseDocumentsQuery(linkedCaseId || caseId || "");
  const { data: consultationDocuments } = useConsultationDocumentsQuery(consultationId ?? undefined);
  const ragStatusById = new Map(
    [...(caseDocuments ?? []), ...(consultationDocuments ?? [])].map((doc) => [doc.id, doc.ragStatus]),
  );
  const resolvedRagStatus = (entry: (typeof queuedFiles)[number]) =>
    (entry.doc?.id ? ragStatusById.get(entry.doc.id) : undefined) ?? entry.doc?.ragStatus;

  // See showSuggestedPrompts' doc comment — Case Workspace opts back in explicitly despite
  // being `embedded`; Terminal's cramped split panes don't.
  const shouldShowSuggestedPrompts = showSuggestedPrompts ?? !embedded;

  // The transcript for the consultation currently on screen comes straight from the
  // React Query cache — keyed by consultationId, so switching consultations just means a
  // different query result, with no manual copy-into-local-state step to keep in sync.
  // Memoized: without this, every render (e.g. toggling either sidebar's expand/collapse,
  // or TopicNavigator's scroll-spy updating activeTopicIndex) rebuilt a brand-new array
  // here, which the scroll-to-bottom effect below (keyed on `messages`) mistook for new
  // chat content and jumped the transcript to the bottom on every single click.
  const baseMessages: DisplayMessage[] = useMemo(
    () =>
      consultationId
        ? (history ?? [])
            .filter((m) => m.role !== "system")
            .map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              // Empty on messages sent before the backend shipped message-scoped attachments
              // (handoff doc §5) — falls back to no chips for those, same as today.
              attachments: enableFileChips
                ? (m.documents ?? []).map((d) => ({ id: d.id, name: d.name, url: d.fileUrl, mimeType: d.mimeType }))
                : undefined,
              mindMap: m.mindMap?.data,
              groupId: m.groupId,
              groupTitle: m.groupTitle,
            }))
        : [],
    [consultationId, history, enableFileChips],
  );

  const consultationKey = consultationId ?? pendingUrlConsultationId ?? NEW_CONSULTATION_KEY;
  const isPendingTurnActive = pendingTurn?.key === consultationKey;
  const messages = isPendingTurnActive ? pendingTurn!.messages : baseMessages;

  // The assistant reply is persisted asynchronously after the stream ends (ilovelawyer-api's
  // MessagePersistenceQueue), so doSend's own post-stream refetch can settle a beat before the
  // rows land. useMessagesQuery keeps polling while a pendingTurn is on screen (pollWhilePending
  // above); once the persisted history is at least as long as the optimistic buffer, hand the
  // transcript back to it and refresh the related-cases panel that persisted alongside it.
  useEffect(() => {
    if (!pendingTurn || !consultationId || pendingTurn.key !== consultationKey) return;
    const persistedCount = (history ?? []).filter((m) => m.role !== "system").length;
    if (persistedCount >= pendingTurn.messages.length) {
      setPendingTurn(null);
      queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(consultationId) });
    }
  }, [history, pendingTurn, consultationId, consultationKey, queryClient]);

  // Also drivable via a `?tab=mindmap` URL param (case-details-panel.tsx's "MindMap" row
  // links here) — the lazy initializer covers a fresh mount from that link, and the effect
  // below covers the same-instance case (already on this page, no remount happens when only
  // the query string changes). Mind Map is Case-only (see CONTEXT.md), so both gate on the
  // `caseId` prop — a `?tab=mindmap` link on the general /homepage Consultation is ignored.
  const [activeTab, setActiveTab] = useState<CaseChatTab>(() =>
    tabFromSearch(searchParams, mindMapOnly, caseId),
  );
  useEffect(() => {
    if (mindMapOnly) return;
    setActiveTab(tabFromSearch(searchParams, mindMapOnly, caseId));
  }, [mindMapOnly, caseId, searchParams]);

  const handleTabChange = (tab: CaseChatTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "chat") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(`${basePath}${qs ? `?${qs}` : ""}`);
  };

  const { data: linkedCaseRecord } = useCaseQuery(linkedCaseId ?? "");
  const consultationTitle = caseConsultations?.find((c) => c.id === consultationId)?.title?.trim() || null;
  // Fetched once here so both the assistant byline's citation count and the
  // inline Related Cases card (rendered under the latest reply, not trailing the whole
  // transcript — see the message loop below) share one fetch instead of two.
  const { data: relatedCasesData, isLoading: isLoadingRelatedCases } = useRelatedCasesQuery(consultationId ?? undefined);
  const relatedCases = relatedCasesData?.relatedCases ?? [];

  // The mind map is a living document for the whole consultation, not any one message — so
  // this walks the transcript (including whatever's still streaming in) back-to-front and
  // surfaces the most recent one the AI actually populated, same as law-ph's `activeMindMap`.
  const activeMindMap = useMemo(() => getActiveMindMap(messages), [messages]);

  // The Mind Map tab's auto/manual "generate" turn is a system-driven request the user never
  // typed — it shouldn't clutter the Chat tab as an ordinary bubble. Drops that user message
  // and its paired assistant reply (both while streaming and once persisted); `activeMindMap`
  // above still walks the full `messages`, so the map itself is unaffected.
  const visibleMessages = useMemo(() => {
    const hidden = new Set<number>();
    messages.forEach((m, i) => {
      if (m.role === "user" && (m.content === AUTO_MINDMAP_PROMPT || m.content === AUTO_AUDIO_OVERVIEW_PROMPT)) {
        hidden.add(i);
        // A mind-map/audio-overview reply can come back long enough to get split into several
        // sibling topic messages (see ilovelawyer-api's MessageGroup) — every one of them
        // belongs to this hidden turn, not just the first, so keep hiding the whole run of
        // consecutive assistant messages rather than stopping after one.
        let j = i + 1;
        while (messages[j]?.role === "assistant") {
          hidden.add(j);
          j++;
        }
      }
    });
    return hidden.size > 0 ? messages.filter((_, i) => !hidden.has(i)) : messages;
  }, [messages]);

  // TopicNavigator's contents — the topic bubbles of every split AI reply in the thread so
  // far (see ilovelawyer-api's MessageGroup), appended turn over turn. Shared with the Case
  // Workspace's own left-panel TopicNavigator (which isn't inside this component's tree) via
  // use-topic-navigator.ts, so both derive identical topics/indices from the same persisted
  // history independently.
  const {
    topics: splitTopics,
    groups: splitTopicGroups,
    activeIndex: activeTopicIndex,
    scrollToTopic,
    isGenerating: isGeneratingTopics,
  } = useTopicNavigator(consultationId);

  // Empty-state composer pills, most relevant first: (1) the case's own uploaded documents
  // — the clearest signal of what this chat is actually for, so a fresh case with a file
  // already on it gets "Summarize <that file>" instead of a generic prompt; (2) the user's
  // own past consultation titles (auto-generated from that consultation's first message, so
  // they're already real legal prompts this user has asked before) — `caseConsultations` is
  // scoped to `caseId` when set, or every one of the user's consultations on the general
  // /homepage (see its useConsultationsQuery(caseId) call above); (3) a random draw from the
  // caller's predefined pool to fill whatever's left. Recomputes only when documents,
  // consultations, or the pool actually change, so pills don't reshuffle on every keystroke
  // while the empty state is showing.
  const suggestedPrompts = useMemo(() => {
    const pool = emptyStatePrompts ?? [];
    const documentPrompts = Array.from(
      new Set(
        (caseDocuments ?? [])
          .filter((d) => d.ragStatus !== "FAILED")
          .map((d) => t("emptyState.summarizeDocumentPrompt", { defaultValue: `Summarize "${d.name}"`, fileName: d.name })),
      ),
    );
    const historyTitles = Array.from(
      new Set(
        (caseConsultations ?? [])
          .map((c) => c.title?.trim())
          .filter((title): title is string => !!title),
      ),
    );

    const documentPicks = shuffle(documentPrompts).slice(0, MAX_DOCUMENT_SUGGESTIONS);
    const historySlots = Math.max(0, Math.min(MAX_HISTORY_SUGGESTIONS, SUGGESTED_PROMPT_COUNT - documentPicks.length));
    const historyPicks = shuffle(historyTitles.filter((h) => !documentPicks.includes(h))).slice(0, historySlots);
    const poolSlots = Math.max(0, SUGGESTED_PROMPT_COUNT - documentPicks.length - historyPicks.length);
    const taken = new Set([...documentPicks, ...historyPicks]);
    const poolPicks = shuffle(pool.filter((p) => !taken.has(p))).slice(0, poolSlots);
    return shuffle([...documentPicks, ...historyPicks, ...poolPicks]);
  }, [caseDocuments, caseConsultations, emptyStatePrompts, t]);

  // For a case's chat, arriving with no `?c=` param (e.g. leaving and coming back to the
  // case, rather than clicking "New Chat" from within it) shouldn't dump you on the blank
  // empty state when a consultation already exists — that reads as "my prompts vanished"
  // even though they're just sitting in the sidebar unselected. Redirect straight to the
  // most recent one. Runs at most once per mount: `autoSelectedRef` is set as soon as
  // either branch below resolves (a consultation gets auto-picked, or the case turns out
  // to have none yet), so a later explicit "New Chat" click — which also clears `?c=` —
  // is never re-hijacked back into a consultation.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!caseId || autoSelectedRef.current) return;
    if (consultationId) {
      autoSelectedRef.current = true;
      return;
    }
    if (!caseConsultations) return; // still loading — wait for it rather than assuming "none"
    autoSelectedRef.current = true;
    const mostRecent = caseConsultations[0];
    if (mostRecent) {
      navigateToConsultation(mostRecent.id, { replace: true });
    }
  }, [caseId, consultationId, caseConsultations, navigateToConsultation]);

  // CSS max-h-[50vh] on the textarea (below) is the actual visual cap — the browser clamps
  // to it and shows a scrollbar regardless of what height gets set here, so this can just
  // always request the content's full natural height rather than also clamping in JS.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [inputMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    sendTokenRef.current++; // abandon any in-flight send for the consultation we're leaving
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
    setActiveTab("chat");
    navigateToConsultation(null);
  };

  const handleSelectConsultation = (id: string) => {
    if (id === consultationId) return;
    sendTokenRef.current++;
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
    setActiveTab("chat");
    navigateToConsultation(id);
  };

  // Resolves to a real consultation id, creating one exactly once if none exists yet —
  // needed because an attachment upload must be keyed to a consultationId before the
  // consultation otherwise gets created (at send time). Concurrent callers (upload + doSend
  // within the same send) share the single in-flight create via consultationCreationRef.
  const ensureConsultationId = async (): Promise<string> => {
    if (consultationId) return consultationId;
    if (resolvedConsultationIdRef.current) return resolvedConsultationIdRef.current;
    if (!consultationCreationRef.current) {
      consultationCreationRef.current = (async () => {
        const consultation = await createConsultation.mutateAsync({ caseId });
        resolvedConsultationIdRef.current = consultation.id;
        setPendingUrlConsultationId(consultation.id);
        navigateToConsultation(consultation.id);
        return consultation.id;
      })();
    }
    return consultationCreationRef.current;
  };

  //trigger hidden file input without router redirect

   const handleClipClick = (  ) => {
    fileInputRef.current?.click();
  };

  // Adds files to the local queue as "pending" — upload doesn't start until Send is
  // clicked (see handleSendMessage). Also queues each into the separate Document Analysis
  // page's store (unrelated hand-off, unchanged from the single-file behavior).
  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const [withinSizeLimit, oversized] = [
      list.filter((f) => f.size <= MAX_FILE_SIZE_BYTES),
      list.filter((f) => f.size > MAX_FILE_SIZE_BYTES),
    ];
    setOversizedFileNames(oversized.map((f) => f.name));

    const remaining = Math.max(0, MAX_ATTACHED_FILES - queuedFiles.length);
    const accepted = withinSizeLimit.slice(0, remaining);
    setFileLimitHit(accepted.length < withinSizeLimit.length);
    if (accepted.length === 0) return;
    setQueuedFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: generateId(), file, status: "pending" as const })),
    ]);
    accepted.forEach(queueDocument);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // input.files is a live FileList tied to the element — it must be materialized into a
    // plain array before resetting .value, otherwise clearing the selection empties this
    // reference too and addFiles sees zero files.
    const files = e.currentTarget.files ? Array.from(e.currentTarget.files) : [];
    e.currentTarget.value = "";
    addFiles(files);
  };

  const handleRemoveFile = (id: string) => {
    setQueuedFiles((prev) => prev.filter((f) => f.id !== id));
    setFileLimitHit(false);
    setOversizedFileNames([]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };

  // Only intercepts when the clipboard actually carries a file (e.g. a copied screenshot, or
  // a file copied from the OS file manager) — plain text paste is left alone so preventDefault
  // never runs and the browser's normal paste behavior still applies.
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = e.clipboardData?.files;
    if (files && files.length > 0) {
      e.preventDefault();
      addFiles(files);
    }
  };

  // Runs presign→PUT in a concurrency pool, then confirms successfully-uploaded files in
  // batches of 50 — so a multi-file attachment does not fire one API call per file or one
  // unbounded Promise.all. Updates each entry's status as it settles and returns the updated
  // entries so callers (handleSendMessage) can act on the outcome without racing the state
  // update. `consultationId` scopes the S3 key to this consultation when there's no linked
  // case yet (the backend prioritizes `caseId` over it, so it's harmless to always pass both).
  const uploadQueuedFiles = async (entries: typeof queuedFiles, consultationId?: string) => {
    const ids = new Set(entries.map((e) => e.id));
    setQueuedFiles((prev) => prev.map((f) => (ids.has(f.id) ? { ...f, status: "uploading" } : f)));

    // The confirm call (POST /api/documents) can reject outright — e.g. a backend/frontend
    // payload mismatch — not just have individual files fail. Without this catch that throw
    // propagates out of handleSendMessage and every entry here is left stuck at "uploading"
    // forever (no error shown, no retry control, Send permanently disabled), since the state
    // update that maps failures to "error" never runs. Fall back to marking the whole batch
    // "error" instead so the existing retry UI still applies.
    type ConfirmResult = Awaited<ReturnType<typeof uploadDocuments.mutateAsync>>;
    let confirmed: ConfirmResult["confirmed"];
    let succeededFiles: ConfirmResult["succeededFiles"];
    try {
      ({ confirmed, succeededFiles } = await uploadDocuments.mutateAsync({
        files: entries.map((e) => e.file),
        caseId: linkedCaseId ?? undefined,
        consultationId,
      }));
    } catch (error) {
      console.error("Failed to confirm document upload:", error);
      const updated = entries.map((entry) => ({ ...entry, status: "error" as const }));
      const updatedById = new Map(updated.map((f) => [f.id, f]));
      setQueuedFiles((prev) => prev.map((f) => updatedById.get(f.id) ?? f));
      return updated;
    }

    // `succeededFiles` is parallel to `confirmed` — match back to queue entries by File
    // identity (the exact instance queued), not name, since two queued files can share a
    // filename.
    const docByFile = new Map(succeededFiles.map((file, i) => [file, confirmed[i]!]));

    const updated = entries.map((entry) => {
      const doc = docByFile.get(entry.file);
      return doc
        ? { ...entry, status: "uploaded" as const, doc: { id: doc.id, name: doc.name, aiSummary: doc.aiSummary, ragStatus: doc.ragStatus } }
        : { ...entry, status: "error" as const };
    });

    const updatedById = new Map(updated.map((f) => [f.id, f]));
    setQueuedFiles((prev) => prev.map((f) => updatedById.get(f.id) ?? f));
    return updated;
  };

  const retryUpload = (id: string) => {
    const entry = queuedFiles.find((f) => f.id === id);
    // A prior attempt already resolved (or is resolving) a consultation id for this send —
    // reuse it rather than creating a second consultation on retry.
    if (entry) void uploadQueuedFiles([entry], consultationId ?? resolvedConsultationIdRef.current ?? undefined);
  };

  const doSend = async (
    text: string,
    opts?: {
      documentContext?: string;
      caseDocumentId?: string;
      /** What the AI receives (`text` above, possibly a placeholder) and what's shown in the
       * optimistic bubble can differ — see `handleSendMessage`'s displayText/attachments. */
      displayText?: string;
      attachments?: MessageAttachment[];
      /** All documents attached to this send, for message-scoped attachment display (ADR 0012) —
       * distinct from caseDocumentId, which is grounding-only. Live as of
       * ilovelawyer-api@bfde68b (docs/message-attachments-backend-handoff.md §3). */
      documentIds?: string[];
    },
  ) => {
    if (!text || !session || isSending) return;

    // Identifies this send so it can tell, once it's back from an await, whether the
    // user has since navigated away (handleNewChat/handleSelectConsultation bump the
    // counter) — an abandoned send must not write its chunks/errors/isSending into
    // whatever consultation is now on screen.
    const myToken = ++sendTokenRef.current;
    // The consultation this send belongs to, fixed at send time (before the id might
    // change under us, e.g. a brand-new consultation getting its real id).
    const turnKey = consultationKey;
    // Snapshot of how many persisted messages existed before this turn — used below to
    // sanity-check the post-send refetch before trusting it over pendingTurn (see there).
    const messagesBeforeSend = baseMessages.length;

    setIsSending(true);
    setPendingTurn({
      key: turnKey,
      messages: [
        ...baseMessages,
        { role: "user", content: opts?.displayText ?? text, attachments: opts?.attachments },
        { role: "assistant", content: "" },
      ],
    });

    // Set once activeConsultationId resolves below; read back in `finally` (which is outside
    // that `try` block's own scope) so stopSending always targets the right id.
    let startedConsultationId: string | null = null;

    try {
      let activeConsultationId = consultationId;
      if (!activeConsultationId) {
        // Reuses the consultation an in-flight attachment upload already created for this
        // send (see handleSendMessage), rather than creating a second one.
        activeConsultationId = await ensureConsultationId();
        // Re-key the pending turn to the real id so it keeps showing once the URL
        // (and thus `consultationKey`) catches up to it. Until that render lands,
        // `pendingUrlConsultationId` covers the gap so the re-keyed turn keeps
        // matching `consultationKey` instead of going invisible for a beat.
        setPendingTurn((prev) => (prev && prev.key === turnKey ? { ...prev, key: activeConsultationId! } : prev));
      }
      startedConsultationId = activeConsultationId;
      // A topic breakdown (see TopicNavigator/SourcesPanel) can only exist once this turn is
      // persisted — this flag lets those panels show a "generating" state immediately instead
      // of looking empty for however long the turn takes.
      startSending(activeConsultationId);

      // Kept separate from the displayed bubble text: the stream can carry a trailing
      // [MINDMAP]...[/MINDMAP] block that must never render as raw JSON mid-stream (the API
      // only strips/persists it from the *final* response — see mind-map-parser.ts's header
      // comment). Re-derived from scratch on every chunk rather than appended incrementally,
      // so a tag that straddles a chunk boundary still resolves correctly once it closes.
      let rawAccumulated = "";

      const { newSessionId } = await sendChatMessage({
        consultationId: activeConsultationId,
        sessionId: session.session_id,
        message: text,
        documentContext: opts?.documentContext,
        caseDocumentId: opts?.caseDocumentId,
        documentIds: opts?.documentIds,
        // Lets backend fall back to READY case docs when this consultation has none yet
        // (homepage chat linked to a case, or case-portfolio without consultation uploads).
        caseId: linkedCaseId || caseId || undefined,
        onChunk: (chunk) => {
          if (sendTokenRef.current !== myToken) return;
          rawAccumulated += chunk;
          const displayContent = stripStructuredBlocks(rawAccumulated);
          const mindMap = extractMindMap(rawAccumulated);
          const researchSteps = extractTraceSteps(rawAccumulated);
          setPendingTurn((prev) => {
            if (!prev) return prev;
            const lastIndex = prev.messages.length - 1;
            const last = prev.messages[lastIndex];
            if (!last) return prev;
            const nextMessages = [...prev.messages];
            nextMessages[lastIndex] = { role: last.role, content: displayContent, mindMap, researchSteps };
            return { ...prev, messages: nextMessages };
          });
        },
      });

      // The backend silently rotated to a fresh Chat Wonder session_id mid-request (ours
      // had expired) — update the cache so the next message uses it directly instead of
      // repeating the same failed-then-retried round trip.
      if (newSessionId) {
        queryClient.setQueryData(chatKeys.session(), { session_id: newSessionId });
      }

      // The backend has now persisted both messages (and may have generated a title) —
      // refresh both queries so the transcript and sidebar reflect the saved state, then
      // drop the local buffer in favor of the (now up to date) query cache. `refetchType:
      // "all"` (not the default "active") matters specifically for a brand-new consultation:
      // useMessagesQuery is still `enabled` on the *old* (pre-create) consultationId at this
      // point — React hasn't re-rendered with the new id yet — so there's no active observer
      // for chatKeys.messages(activeConsultationId) and a default invalidate would just mark
      // it stale without fetching, leaving the read below empty and always hitting the
      // "looked incomplete" fallback for every first message in a new consultation.
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeConsultationId), refetchType: "all" });
      queryClient.invalidateQueries({ queryKey: chatKeys.consultationsAll() });

      const refreshedHistory = queryClient.getQueryData<ChatMessage[]>(chatKeys.messages(activeConsultationId));
      const turnPersisted = (refreshedHistory?.length ?? 0) >= messagesBeforeSend + 2;
      if (sendTokenRef.current === myToken && turnPersisted) {
        queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(activeConsultationId) });
        setPendingTurn(null);
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      if (sendTokenRef.current === myToken) {
        setPendingTurn((prev) => {
          if (!prev) return prev;
          const nextMessages = [...prev.messages];
          nextMessages[nextMessages.length - 1] = { role: "assistant", content: t("sendError") };
          return { ...prev, messages: nextMessages };
        });
      }
    } finally {
      if (startedConsultationId) stopSending(startedConsultationId);
      if (sendTokenRef.current === myToken) {
        setIsSending(false);
        setPendingUrlConsultationId(null);
      }
    }
  };

  // AWS Transcribe's raw output is tagged per segment, e.g. "[TS:1.19] [Speaker 0]: Mic
  // check." — meaningful on the Transcription page's own diarized view, but not something a
  // chat message should read as. Strips the tags for the chat send only; the stored
  // transcript (and the Transcription page) keep the raw, tagged text untouched.
  const stripTranscriptTags = (text: string) =>
    text.replace(/\[TS:[\d.]+\]\s*\[Speaker\s*\d+\]:\s*/gi, " ").replace(/\s+/g, " ").trim();

  // Drives a just-recorded voice clip through the same real pipeline the Transcription
  // page's own "Transcribe" button uses (upload → create record → start AWS Transcribe job
  // → poll to completion — see handleTranscribe in transcription/page.tsx), then sends the
  // resulting text as a chat message. `id` is the local queue row (already created via
  // queueTranscript before this runs) — updated through the same status progression so the
  // Transcription page shows real progress for it, exactly as if submitted from there.
  const transcribeAndSend = async (id: string, blob: Blob, durationSeconds: number) => {
    setTranscribingId(id);
    try {
      updateTranscript(id, { status: "uploading" });
      const uploaded = await uploadAudio.mutateAsync({
        blob,
        filename: `Recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
      });
      updateTranscript(id, { status: "starting" });
      const created = await createTranscription.mutateAsync({
        title: t("input.voiceMessageTitle", { defaultValue: "Voice message" }),
        audioFileId: uploaded.id,
        duration: durationSeconds,
        caseId: linkedCaseId || caseId || undefined,
      });
      updateTranscript(id, { backendId: created.id, status: "in_progress" });
      await startTranscriptionJob.mutateAsync(created.id);
      const result = await pollTranscriptionJobUntilDone(created.id);
      if (result.status === "COMPLETED" && result.transcript?.trim()) {
        updateTranscript(id, { status: "completed", transcript: result.transcript });
        chunkTranscription(created.id).catch((err) => {
          console.error("Failed to chunk transcription for RAG retrieval:", err);
        });
        void doSend(stripTranscriptTags(result.transcript));
      } else {
        updateTranscript(id, {
          status: "failed",
          errorMessage: result.failureReason ?? "AWS Transcribe reported the job as failed.",
        });
        alert(t("input.transcriptionFailed", { defaultValue: "Couldn't transcribe that recording. It's still saved on the Transcription page." }));
      }
    } catch (error) {
      console.error("Voice transcription failed:", error);
      updateTranscript(id, { status: "failed", errorMessage: (error as Error).message });
      alert(t("input.transcriptionFailed", { defaultValue: "Couldn't transcribe that recording. It's still saved on the Transcription page." }));
    } finally {
      setTranscribingId(null);
    }
  };

  // Mind Map generation is request-only — no auto-fire on mount. It used to send
  // AUTO_MINDMAP_PROMPT automatically the first time this tab became reachable with nothing
  // generated yet, but that meant every case showed the same generic strategy outline (see
  // chat-wonder-v2-api's legal_prompt.txt — there's no dedicated structural prompt for this
  // request, so the model falls back to its own default skeleton) without the lawyer having
  // asked for it. The manual "Generate"/"Regenerate" CTA below is now the only trigger.
  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputMessage.trim();
    // A file-only send (no typed text) is allowed as long as there's something to send,
    // text or attachment(s).
    if (!text && queuedFiles.length === 0) return;
    // A previous Send click's upload is still in flight — ignore this click rather than
    // starting a second overlapping upload pass over the same entries.
    if (queuedFiles.some((f) => f.status === "uploading")) return;

    const alreadyUploaded = queuedFiles.filter((f) => f.status === "uploaded");
    const needsUpload = queuedFiles.filter((f) => f.status !== "uploaded");

    let finalFiles = alreadyUploaded;
    if (needsUpload.length > 0) {
      // Resolve (creating if necessary) the consultation this attachment belongs to before
      // uploading, so the S3 key can be scoped under documents/consultations/{id}/ instead
      // of falling back to the generic per-user key — same idea as a case upload being
      // scoped to its caseId. doSend below reuses this same consultation rather than
      // creating a second one.
      const resolvedConsultationId = await ensureConsultationId();
      const settled = await uploadQueuedFiles(needsUpload, resolvedConsultationId);
      // At least one file failed — leave it visible with a retry control instead of
      // sending a message that silently drops the attachment the user asked for.
      if (settled.some((f) => f.status === "error")) return;
      finalFiles = [...alreadyUploaded, ...settled];
    }

    const docs = finalFiles.map((f) => f.doc).filter((d): d is NonNullable<typeof d> => !!d);
    const messageText =
      text ||
      (docs.length === 1
        ? t("input.defaultAttachmentMessage", { fileName: docs[0]!.name })
        : t("input.defaultAttachmentMessageMultiple", { count: docs.length }));
    // Only inline real summary text — a filename-only "Attached document …" string makes the
    // model think a file is present without giving it content, so it asks the user to re-upload.
    // Chunk text is grounded server-side via caseDocumentId / consultation / case RAG instead.
    const summaries = docs
      .map((d) => (d.aiSummary?.trim() ? `Attached document "${d.name}":\n${d.aiSummary.trim()}` : null))
      .filter((s): s is string => !!s);
    const documentContext = summaries.length > 0 ? summaries.join("\n\n") : undefined;
    const caseDocumentId = docs.length === 1 ? docs[0]!.id : undefined;

    // The optimistic bubble shows real typed text as-is, but drops the auto-generated
    // placeholder in favor of letting the attachment chips speak for themselves (ADR 0012) —
    // only when this page opted into chips at all; Case Chat keeps showing `messageText`
    // (unchanged) since it never gets chips to fall back on.
    const displayText = enableFileChips ? text : messageText;
    const attachments: MessageAttachment[] | undefined = enableFileChips
      ? finalFiles
          .map((f): MessageAttachment | null => {
            if (!f.doc) return null;
            // Mint a same-session blob URL rather than waiting on a refetch for the backend's
            // fileUrl, so the chip is clickable/previewable the instant it's sent. Once the
            // invalidateQueries in doSend lands, baseMessages picks up the real fileUrl from
            // the backend on its own — no change needed here.
            const url = URL.createObjectURL(f.file);
            blobUrlsRef.current.add(url);
            return { id: f.doc.id, name: f.doc.name, url, mimeType: f.file.type || null };
          })
          .filter((a): a is MessageAttachment => a !== null)
      : undefined;
    // Message-scoped linkage (ADR 0012) — lets these documents survive a refetch/navigation
    // instead of only existing as blob URLs in this component instance's local state. Gated on
    // enableFileChips for the same reason `attachments` is: Case Chat has no chip UI to show them
    // with, so there's no point linking there yet.
    const documentIds = enableFileChips && docs.length > 0 ? docs.map((d) => d.id) : undefined;

    setInputMessage("");
    setQueuedFiles([]);
    void doSend(messageText, { documentContext, caseDocumentId, displayText, attachments, documentIds });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const chatInputBar = (
    <div className={`w-full shrink-0 ${embedded ? (centerContent ? "px-6" : "") : "max-w-3xl mx-auto"}`}>
      <form
        onSubmit={handleSendMessage}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full flex flex-col gap-2 transition-colors ${
          embedded
            ? `rounded-3xl border bg-card p-3 ${isDraggingOver ? "border-blue-500 border-dashed" : "border-border"}`
            : `bg-card p-2 rounded-[26px] border shadow-[0_25px_50px_-12px_rgba(0,0,0,0.6)] ${
                isDraggingOver ? "border-primary border-dashed" : "border-border"
              }`
        }`}
      >
        {isDraggingOver && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none ${
              embedded ? "rounded-3xl bg-card/90" : "rounded-[26px] bg-card/90"
            }`}
          >
            <span className="text-sm font-['Inter'] text-muted-foreground">{t("input.dropFilesHint")}</span>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {(queuedFiles.length > 0 || oversizedFileNames.length > 0) && (
          <div className="flex flex-col gap-1.5 pt-1.5 px-2 pb-0.5">
            <div className="flex flex-wrap gap-1.5">
              {queuedFiles.map((f) => (
                <span
                  key={f.id}
                  className="flex items-center gap-2 max-w-full rounded-full border border-border bg-background text-foreground/85 text-[12.5px] font-['Inter'] pl-3 pr-1.5 py-[5px] w-fit"
                >
                  {f.status === "uploading" ? (
                    <Loader2 className="w-3 h-3 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : f.status === "uploaded" && resolvedRagStatus(f) === "PENDING" ? (
                    <Loader2 className="w-3 h-3 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : f.status === "uploaded" && resolvedRagStatus(f) === "FAILED" ? (
                    <AlertCircle className="w-3 h-3 shrink-0 text-red-500" aria-hidden="true" />
                  ) : f.status === "uploaded" ? (
                    <CheckCircle2 className="w-3 h-3 shrink-0 text-green-500" aria-hidden="true" />
                  ) : f.status === "error" ? (
                    <AlertCircle className="w-3 h-3 shrink-0 text-red-500" aria-hidden="true" />
                  ) : (
                    <Paperclip className="w-3 h-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[220px]">{f.file.name}</span>
                  {f.status === "error" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => retryUpload(f.id)}
                          className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-card shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          aria-label={t("input.retryUpload", { fileName: f.file.name })}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("input.retryUpload", { fileName: f.file.name })}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(f.id)}
                        className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-card shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        aria-label={t("input.removeFile", { fileName: f.file.name })}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("input.removeFile", { fileName: f.file.name })}</TooltipContent>
                  </Tooltip>
                </span>
              ))}
            </div>
            {fileLimitHit && (
              <span className="text-[10.5px] text-amber-500 pl-1">
                {t("input.attachmentLimitHit", { defaultValue: `Only ${MAX_ATTACHED_FILES} files can be attached at once — the rest weren't added.`, max: MAX_ATTACHED_FILES })}
              </span>
            )}
            {oversizedFileNames.length > 0 && (
              <span className="text-[10.5px] text-amber-500 pl-1">
                {t("input.attachmentTooLarge", {
                  defaultValue: `${oversizedFileNames.join(", ")} — over the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit per file, wasn't added.`,
                  fileNames: oversizedFileNames.join(", "),
                  maxMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
                })}
              </span>
            )}
            {queuedFiles.some((f) => f.status === "error") && (
              <span className="text-[10.5px] text-red-500 pl-1">{t("input.attachmentUploadError")}</span>
            )}
            {queuedFiles.some((f) => f.status === "uploaded" && resolvedRagStatus(f) === "PENDING") && (
              <span className="text-[10.5px] text-muted-foreground pl-1">{t("input.indexingHint")}</span>
            )}
            {queuedFiles.some((f) => f.status === "uploaded" && resolvedRagStatus(f) === "FAILED") && (
              <span className="text-[10.5px] text-red-500 pl-1">{t("input.indexingFailed")}</span>
            )}
          </div>
        )}

        {/* Auto-growing textarea so multi-line input actually wraps, like Gemini's input.
         * items-center (not items-end) so the round attach/voice/send buttons stay vertically
         * centered against whatever height the textarea actually renders at, matching the
         * pill-shaped card's own vertical center — items-end instead bottom-aligns them,
         * which visibly drifts off-center against a single-line (or otherwise short) textarea.
         *
         * Below `sm`, this wraps into two rows instead — the textarea's basis-full forces it
         * to claim the whole row width (so wrapped text actually uses the full row instead of
         * stopping short with dead space before wherever the controls happen to sit), which
         * pushes attach/voice/send onto a shared second line via ordinary flex-wrap (they're
         * small enough to share that second line together rather than each getting their own).
         * Each child's own order class (plain below `sm`, sm:order- above it) restores the
         * original single-row sequence — attach, textarea, voice, send — at `sm` and up,
         * where flex-nowrap keeps it one row again. */}
        <div className={embedded ? "flex items-center gap-1.5" : "flex flex-wrap sm:flex-nowrap items-center gap-1.5"}>
          {!isRecording && !transcribingId && (
            <div className="min-w-0 basis-full sm:flex-1 order-1 sm:order-2">
              <textarea
                ref={textareaRef}
                rows={1}
                className={`w-full resize-none bg-transparent border-none outline-none font-['Inter'] leading-6 overflow-y-auto scrollbar-none [-ms-overflow-style:none] placeholder:truncate ${
                  // embedded (Terminal's split panes) keeps the old, tighter 200px cap — there's
                  // real risk of squeezing an already-small pane. The full-page composer has a
                  // whole empty page below it a long paste can grow into, so it gets a much more
                  // generous viewport-relative cap instead of clipping at an arbitrary 200px.
                  embedded ? "max-h-50" : "max-h-[50vh]"
                } ${
                  // Embedded shares this row with the send button (see the wrapping div above),
                  // so the textarea needs to shrink for it — w-full + shrink-0 (the non-embedded
                  // styling, where this is the row's only child) forced it to claim the full row
                  // width regardless of the button, pushing the button out past the pane's
                  // clipped edge (or spilling past the rounded border where nothing clips it).
                  // placeholder:truncate keeps a long placeholder (e.g. the default
                  // "Draft your legal inquiry or case particulars here...") on one line instead
                  // of wrapping — a wrapped placeholder still inflates the textarea's own
                  // scrollHeight (see the auto-grow effect below), visibly expanding an empty
                  // box to 2+ lines on a narrow phone width before anything's even typed.
                  // text-base (16px) below sm avoids iOS Safari's auto-zoom-on-focus in embedded
                  // panes (Case Workspace/Terminal) — the smaller desktop size returns once
                  // that's no longer a risk.
                  embedded
                    ? "px-2 py-1.5 text-base sm:text-[13px] text-foreground placeholder-muted-foreground"
                    : "px-1 py-1.5 text-[15px] text-foreground placeholder-muted-foreground"
                }`}
                placeholder={inputPlaceholder ?? t("input.placeholder")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isSending}
              />
            </div>
          )}

          {/* Bouncing-dots status row while a just-recorded clip runs through the real
              transcription pipeline — same three-dot markup as ThinkingIndicator (assistant-message.tsx),
              reused inline here rather than extracted since this is the only other place it
              appears with composer-specific sizing. Takes the textarea's slot, same idea as
              VoiceDictate's own recording row. */}
          {!embedded && !isRecording && transcribingId && (
            <div className="min-w-0 basis-full sm:flex-1 order-1 sm:order-2 flex items-center gap-2 px-1 py-1.5 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-0.5" aria-hidden="true">
                <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
                <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
                <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none" />
              </span>
              {(() => {
                const stageCopy = TRANSCRIBE_STAGE_COPY[transcribeStatus ?? "uploading"] ?? TRANSCRIBE_STAGE_COPY.uploading!;
                return t(stageCopy.key, { defaultValue: stageCopy.defaultValue });
              })()}
            </div>
          )}

          {embedded ? (
            <>
              {!isRecording && !transcribingId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleClipClick}
                      disabled={queuedFiles.length >= MAX_ATTACHED_FILES}
                      aria-label={t("input.attachFile")}
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.attachFile")}</TooltipContent>
                </Tooltip>
              )}

              {!transcribingId && (
                <VoiceDictate
                  disabled={isSending}
                  onRecordingChange={setIsRecording}
                  onComplete={(blob, durationSeconds) => {
                    // Same queue-then-transcribe pipeline as the non-embedded composer below —
                    // shows up on the Transcription page right away, then transcribeAndSend
                    // drives this row through upload/start-job/poll.
                    const id = queueTranscript(blob, durationSeconds);
                    void transcribeAndSend(id, blob, durationSeconds);
                  }}
                  onError={() => alert(t("microphoneError"))}
                  voiceLabel={t("input.voiceLabel", { defaultValue: "Voice" })}
                  stopLabel={t("input.stopRecording")}
                  cancelLabel={t("input.cancelRecording", { defaultValue: "Cancel recording" })}
                  className="order-3"
                />
              )}

              {!isRecording && !transcribingId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={isSending || !session || queuedFiles.some((f) => f.status === "uploading")}
                      aria-label={t("input.sendMessage")}
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.sendMessage")}</TooltipContent>
                </Tooltip>
              )}
            </>
          ) : (
            <>
              {/* Hidden while dictating or transcribing — VoiceDictate (recording state) or
                  the transcribing row above takes over the composer instead. Plain order
                  below `sm` (row 2, after the textarea's basis-full row), sm:order-1
                  (leftmost) once flex-nowrap makes it one row again. */}
              {!isRecording && !transcribingId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleClipClick}
                      disabled={queuedFiles.length >= MAX_ATTACHED_FILES}
                      aria-label={t("input.attachFile")}
                      className="order-2 sm:order-1 w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.attachFile")}</TooltipContent>
                </Tooltip>
              )}

              {!transcribingId && (
                <VoiceDictate
                  disabled={isSending}
                  onRecordingChange={setIsRecording}
                  onComplete={(blob, durationSeconds) => {
                    // Queued immediately so it shows up on the Transcription page right away —
                    // transcribeAndSend below drives this same row through upload/start-job/poll
                    // rather than creating a second, disconnected backend record for it.
                    const id = queueTranscript(blob, durationSeconds);
                    void transcribeAndSend(id, blob, durationSeconds);
                  }}
                  onError={() => alert(t("microphoneError"))}
                  voiceLabel={t("input.voiceLabel", { defaultValue: "Voice" })}
                  stopLabel={t("input.stopRecording")}
                  cancelLabel={t("input.cancelRecording", { defaultValue: "Cancel recording" })}
                  className="order-3"
                />
              )}

              {!isRecording && !transcribingId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={isSending || !session || queuedFiles.some((f) => f.status === "uploading")}
                      aria-label={t("input.sendMessage")}
                      // Icon-only below `sm` — the full pill (label + padding) doesn't shrink
                      // and would otherwise dominate a narrow composer row alongside the
                      // attach button and textarea.
                      className="order-3 h-9 w-9 sm:w-auto shrink-0 flex items-center justify-center sm:justify-start gap-2.5 rounded-full bg-brand-gold text-background px-0 sm:px-[18px] text-[10px] font-semibold uppercase tracking-[1.2px] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      <span className="hidden sm:inline">{t("input.sendLabel", { defaultValue: "Send" })}</span>
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.sendMessage")}</TooltipContent>
                </Tooltip>
              )}
            </>
          )}
        </div>
      </form>
    </div>
  );

  return (
    // Left padding grows when the rail is expanded, reserving room for it (w-72 = 18rem)
    // instead of letting it overlay whatever sits at the page's left edge — otherwise the
    // expanded rail covers the case header row's back link/case chip underneath it.
    <div
      className={
        embedded
          ? "relative flex h-full min-h-0 flex-1 flex-col px-2"
          : `relative flex-1 flex flex-col min-h-0 px-4 sm:px-8 transition-[padding-left,padding-right] duration-200 ${
              sidebarExpanded ? "lg:pl-80" : "lg:pl-32"
            } ${(splitTopics.length > 0 || isGeneratingTopics) && topicPanelExpanded ? "lg:pr-72" : "lg:pr-32"}`
      }
    >
      {/* Full-bleed backdrop behind the whole Consultation workspace (landing, conversation,
          streaming) — not just the empty-state screen — per the redesign. Lives on this
          outer, full-width container (not <main>, which is `max-w-5xl`-capped for reading
          width) so it spans edge to edge instead of only behind that narrow centered column;
          absolutely positioned + painted first so it sits behind the sidebar/main content
          regardless of DOM/paint order rules for positioned siblings. */}
      {!embedded && emptyStateHeroImage && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative full-bleed background, no responsive srcset needed */}
          <img
            src={emptyStateHeroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[center_30%] opacity-[0.14]"
          />
          {/* Fades the image into the page's own --background (not a hardcoded dark hex) so this
              reads correctly in both light and dark mode instead of always fading to near-black. */}
          <div className="absolute inset-0 bg-gradient-to-t from-background from-38% via-background/55 via-70% to-background/35" />
        </div>
      )}

      {!embedded && (
        <ConsultationSidebar
          activeConsultationId={consultationId}
          onSelectConsultation={handleSelectConsultation}
          onNewChat={handleNewChat}
          caseId={caseId}
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
          isMobileOpen={sidebarMobileOpen}
          onMobileOpenChange={setSidebarMobileOpen}
        />
      )}

      {!embedded && (splitTopics.length > 0 || isGeneratingTopics) && (
        <TopicNavigator
          groups={splitTopicGroups}
          activeIndex={activeTopicIndex}
          expanded={topicPanelExpanded}
          onExpandedChange={setTopicPanelExpanded}
          onJump={scrollToTopic}
          label={t("topicNavigator.label")}
          isGenerating={isGeneratingTopics}
          generatingLabel={t("topicNavigator.generating")}
        />
      )}

      {headerSlot && !embedded && <div className="relative z-20 shrink-0 pt-16 pb-4">{headerSlot}</div>}

      <main className={`relative z-10 w-full mx-auto flex flex-col flex-1 min-h-0 ${embedded ? "max-w-none" : "max-w-5xl"} ${headerSlot || embedded ? "" : "pt-16"}`}>

        <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* Terminal's Chat pane has no ConsultationSidebar (that's a full-page rail — see
         * !embedded above) and no external picker of its own (unlike Case Workspace, which
         * already renders its own ThreadPicker above this component — see case-workspace.tsx).
         * Gated on isolateConsultation specifically, not embedded: Case Workspace's chat is
         * embedded too, and would otherwise get this a second time, stacked on top of its own
         * picker. A Case's chat is a single thread (see thread-picker.tsx), so this is just a
         * label of what's open, not a switcher — there's nothing else here to reach past. */}
        {isolateConsultation && !mindMapOnly && caseId && (
          <div className="flex shrink-0 pb-2">
            <ThreadPicker caseId={caseId} activeConsultationId={consultationId} />
          </div>
        )}
        {(() => {
          const isEmptyChatLanding = !mindMapOnly && activeTab === "chat" && !consultationId && visibleMessages.length === 0;
          const showMindMapPane = Boolean(caseId && (mindMapOnly || (!embedded && activeTab === "mindmap")));
          const showTimelinePane = Boolean(caseId && !embedded && !mindMapOnly && activeTab === "timeline");
          // Mind Map is Case-only (see CONTEXT.md) — the tab switcher itself only exists inside
          // a Case's own chat (caseId prop set), never on the general /homepage Consultation.
          // Once there's more than one destination (Chat / Mind Map), the switcher has to be
          // visible even from the very first, pre-consultation landing state — otherwise a link
          // into ?tab=mindmap (case-details-panel.tsx's "MindMap" row) has nothing to land on for
          // a case with no consultation yet, and can't get back to Chat either.
          return (
          <>
            {!mindMapOnly && !embedded && caseId && (
              // overflow-x-auto rather than shrinking/wrapping the pills — a 3-tab row with
              // full labels doesn't reliably fit a 375px viewport, and horizontal scroll on a
              // short tab row is a well-understood mobile pattern that keeps every label
              // fully readable instead of truncating it.
              <div className="flex items-center gap-1 pt-4 shrink-0 overflow-x-auto scrollbar-none [-ms-overflow-style:none]">
                <button
                  type="button"
                  onClick={() => handleTabChange("chat")}
                  className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
                    activeTab === "chat" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("mindMap.chatTab")}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("mindmap")}
                  className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
                    activeTab === "mindmap" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Workflow className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("mindMap.mapTab")}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("timeline")}
                  className={`flex items-center gap-1.5 shrink-0 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
                    activeTab === "timeline" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("mindMap.timelineTab", { defaultValue: "Timeline" })}
                </button>
              </div>
            )}

            {showMindMapPane ? (
              <div className={`flex-1 min-h-0 ${mindMapOnly ? "overflow-hidden py-1" : "overflow-y-auto scrollbar-none [-ms-overflow-style:none] py-4"}`}>
                {activeMindMap ? (
                  <MindMap
                    rootTitle={linkedCaseRecord?.caseName}
                    data={activeMindMap}
                    consultationId={consultationId ?? undefined}
                    isStale={snapshotQuery.data?.mindMap.isStale}
                    regenerating={isGeneratingMindMap}
                    onRegenerate={() => void doSend(AUTO_MINDMAP_PROMPT)}
                  />
                ) : (
                  <div className={`flex-1 flex flex-col items-center justify-center gap-4 text-center ${mindMapOnly ? "h-full py-8" : "py-24"}`}>
                    {isGeneratingMindMap ? (
                      <p
                        className="flex items-center gap-1 text-sm text-muted-foreground max-w-sm font-['Inter']"
                        role="status"
                        aria-live="polite"
                      >
                        {t("mindMap.generating")}
                        <span className="flex items-center gap-0.5" aria-hidden="true">
                          <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.3s]" />
                          <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none [animation-delay:-0.15s]" />
                          <span className="size-1 rounded-full bg-muted-foreground/70 animate-bounce motion-reduce:animate-none" />
                        </span>
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground max-w-sm font-['Inter']">{t("mindMap.emptyState")}</p>
                    )}
                    {!isGeneratingMindMap && (
                      <button
                        type="button"
                        onClick={() => void doSend(AUTO_MINDMAP_PROMPT)}
                        disabled={!session}
                        className="rounded-full bg-brand-navy-950 text-white px-5 py-2.5 text-[13px] font-['Inter'] font-medium shadow-md hover:bg-[#162244] transition-colors disabled:opacity-50"
                      >
                        {t("mindMap.generateCta")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : showTimelinePane && caseId ? (
              <div className="flex-1 min-h-0">
                <CaseTimelineView caseId={caseId} />
              </div>
            ) : isEmptyChatLanding ? (
              /* No consultation yet — heading and input are centered together, like Gemini's landing state.
               * The hero backdrop itself now lives once at the <main> level (see above), so every
               * state — including this one — sits over it. */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Top-left sidebar trigger, pinned at the same position as the active-chat
                    sticky header's own inline button (same px-4 sm:px-16 gutter) — deliberately
                    NOT part of the centered heading block below, which is vertically centered
                    on the page and would otherwise drag the button down to the middle of the
                    screen with it. */}
                {!embedded && (
                  <div className="lg:hidden flex-shrink-0 px-4 sm:px-16 py-3.5">
                    <button
                      type="button"
                      onClick={() => setSidebarMobileOpen(true)}
                      aria-label={t("sidebar.openConsultations")}
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <div className={`relative flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none] ${embedded ? "gap-4 pb-4" : "gap-5 pb-24"}`}>
                  <div className="max-w-3xl mx-auto px-2 w-full text-center">
                    <h1
                      className={
                        embedded
                          ? "mb-2 font-['Inter'] text-lg font-medium tracking-[-0.3px] text-foreground"
                          : "font-['Libre_Caslon_Text'] font-normal text-foreground text-[24px] sm:text-[28px] md:text-[32px] tracking-[-0.01em] mb-4"
                      }
                    >
                      {emptyStateHeading ?? t("emptyState.heading")}
                    </h1>
                  </div>
                  {chatInputBar}
                  {shouldShowSuggestedPrompts && suggestedPrompts.length > 0 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-3xl px-2">
                      {suggestedPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void doSend(prompt)}
                          // max-w-full + normal wrapping — these are free-form strings (either a
                          // past consultation title or a caller-provided emptyStatePrompts entry),
                          // so a long one must wrap inside the pill instead of forcing it wider
                          // than the viewport.
                          className="max-w-full whitespace-normal break-words rounded-full border border-border px-4 py-2.5 text-[13px] text-foreground/80 transition-colors hover:border-foreground hover:text-foreground"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
            <>
              {/* Sticky conversation header — sits above the scrollable pane below (not
                  inside it), so it never scrolls away, matching the redesign's persistent
                  title/case strip. */}
              {!embedded && (
                <div className="flex-shrink-0 flex items-center justify-between gap-4 px-4 sm:px-16 py-3.5 border-b border-border">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Inline with the title instead of ConsultationSidebar's own floating
                        trigger — see sidebarMobileOpen above. */}
                    <button
                      type="button"
                      onClick={() => setSidebarMobileOpen(true)}
                      aria-label={t("sidebar.openConsultations")}
                      className="lg:hidden shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-gold shrink-0" aria-hidden="true" />
                    <span className="font-['Libre_Caslon_Text'] text-[15px] uppercase tracking-[-0.01em] truncate text-foreground">
                      {consultationTitle ?? t("sidebar.untitledConsultation")}
                    </span>
                  </div>
                  {linkedCaseId && linkedCaseRecord && (
                    <div className="flex items-center gap-5 text-[10px] tracking-[1px] uppercase text-muted-foreground shrink-0">
                      <span className="hidden sm:inline">
                        {t("caseHub.linkedCase", { defaultValue: "Linked case" })} · {linkedCaseRecord.caseName}
                      </span>
                      <Link
                        href={`/homepage/case-portfolio/${linkedCaseId}`}
                        className="rounded-full border border-border px-3.5 py-1.5 text-foreground transition-colors hover:border-foreground/60"
                      >
                        {t("caseHub.openCase", { defaultValue: "Open case" })}
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Scrollable message pane — input bar below stays put regardless of scroll position */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-color:var(--border)_transparent]">
              <div className={`w-full mx-auto flex flex-col gap-4 py-4 ${embedded ? (centerContent ? "max-w-[850px] px-6" : "px-2") : "max-w-3xl px-2"}`}>
                {/* A consultation can resolve (auto-picked "most recent", or otherwise) to one
                 * whose only messages are hidden system turns (e.g. the auto mind-map prompt
                 * filtered out of visibleMessages above) — without this, that renders as a bare
                 * pane with no explanation once the history query has actually settled. */}
                {visibleMessages.length === 0 && !historyLoading && !isSending && (
                  <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground font-['Inter']">
                    {emptyStateSubheading ?? t("emptyState.subheading")}
                  </p>
                )}
                {visibleMessages.map((m, i) => {
                  if (m.role === "user") {
                    return (
                      <div key={i} className="flex flex-col items-end gap-2">
                        {m.attachments && m.attachments.length > 0 && (
                          <MessageAttachments attachments={m.attachments} onSelect={setPreviewAttachment} />
                        )}
                        {m.content && (
                          <div className={`max-w-[80%] rounded-[18px_18px_4px_18px] border border-border bg-muted font-['Inter'] whitespace-pre-wrap break-words text-foreground ${
                            embedded ? "px-3 py-2 text-[13px] leading-5" : "px-4 py-3 text-[15px] leading-6"
                          }`}>
                            {m.content}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // The last assistant message is a placeholder pushed synchronously at send
                  // time, before any chunk streams in — that's the window "thinking" covers.
                  const isStreamingThis = isSending && isPendingTurnActive && i === visibleMessages.length - 1;
                  const isLastMessage = i === visibleMessages.length - 1;

                  // Sibling topic bubbles of one split answer (see MessageGroup) sit right next
                  // to each other in visibleMessages — pull the continuation ones up closer than
                  // the parent's gap-4 so they read as one answer broken into cards, not
                  // unrelated replies.
                  const isGroupContinuation = Boolean(m.groupId) && visibleMessages[i - 1]?.groupId === m.groupId;

                  return (
                    <div
                      key={i}
                      id={`chat-msg-${i}`}
                      className={`w-full rounded-2xl ${embedded ? "px-1 py-1 text-foreground" : "px-4 py-3"} ${isGroupContinuation ? "-mt-3" : ""}`}
                    >
                      {isStreamingThis && !m.content ? (
                        m.researchSteps && m.researchSteps.length > 0 ? (
                          <ResearchTraceList steps={m.researchSteps} />
                        ) : (
                          <ThinkingIndicator label={t("thinking")} />
                        )
                      ) : (
                        <>
                          {!embedded && (
                            <div className="flex items-center gap-2 text-[10px] tracking-[1px] uppercase text-muted-foreground mb-3.5">
                              <span className="font-['Libre_Caslon_Text'] text-[13px] tracking-normal normal-case text-foreground">
                                {t("appName", { ns: "common" })}
                              </span>
                              {isLastMessage && !isLoadingRelatedCases && relatedCases.length > 0 && (
                                <span>· {relatedCases.length} {t("caseHub.authoritiesCited", { defaultValue: "authorities cited" })}</span>
                              )}
                            </div>
                          )}
                          <AssistantMessage
                            content={m.content || "…"}
                            className={embedded ? "text-[13px] leading-5 text-foreground" : undefined}
                          />
                          {!embedded && !isSending && isLastMessage && m.content && relatedCases.length > 0 && (
                            <div className="mt-3 rounded-[14px] border border-border bg-card overflow-hidden">
                              <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-border text-[12px]">
                                <Grid2x2 className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
                                <span className="font-semibold text-foreground">{t("caseHub.relatedCases")}</span>
                                <span className="text-muted-foreground">· {relatedCases.length}</span>
                              </div>
                              <div className="p-3">
                                <HubRelatedCases
                                  entries={relatedCases}
                                  isLoading={isLoadingRelatedCases}
                                  emptyLabel={t("caseHub.relatedEmpty")}
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                <div ref={messagesEndRef} />
              </div>
              </div>
            </>
            )}
            {!isEmptyChatLanding && activeTab === "chat" && (
              <div className={embedded ? "pt-2 pb-2" : "pt-4 pb-6"}>{chatInputBar}</div>
            )}
          </>
          );
        })()}
        </div>
      </main>

      {previewAttachment && !embedded && (
        <FilePreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}
    </div>
  );
}
