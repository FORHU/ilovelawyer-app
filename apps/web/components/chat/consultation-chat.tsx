"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { toast } from "sonner";
import { Paperclip, X, Plus, ArrowUpRight, Loader2, AlertCircle, CheckCircle2, RotateCcw, Workflow, MessageSquare, Clock, Grid2x2, PanelLeft, FolderOpen, Copy, Check, MoreVertical, ListTree, SquarePen, Square } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@workspace/ui/components/dropdown-menu";
import { useTranslation } from "react-i18next";
import AssistantMessage, { ThinkingIndicator, cleanAssistantContent } from "@/components/chat/assistant-message";
import { DecisionDrawer } from "@/components/chat/decision-drawer";
import type { DecisionRecordPayload } from "@/lib/terminal/types";
import ConsultationSidebar from "@/components/chat/consultation-sidebar";
import TopicNavigator, { TopicNavigatorList, TopicNavigatorLoading } from "@/components/chat/topic-navigator";
import VoiceDictate from "@/components/chat/voice-dictate";
import { AUTO_MINDMAP_PROMPT, AUTO_AUDIO_OVERVIEW_PROMPT } from "@/lib/chat/auto-prompts";
import { useTopicNavigator, evidenceQuoteElementId } from "@/lib/chat/use-topic-navigator";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";
import { appendOptimisticUserMessage, resolveOptimisticMessageId, isOptimisticMessageId } from "@/lib/chat/optimistic-messages";
import { isSuggestableTitle } from "@/lib/chat/suggestable-title";
import { composerAction, shouldHoldAnswer, ANSWER_HOLD_CAP_MS } from "@/lib/chat/composer-action";
import { shouldScrollTranscriptToBottom } from "@/lib/chat/transcript-scroll";
import { ThreadPicker } from "@/components/chat/thread-picker";
import { HubRelatedCases } from "@/components/chat/case-hub-widget";
import { ReasoningPanel } from "@/components/chat/reasoning-panel";
import { MessageAttachments, type MessageAttachment } from "@/components/chat/message-attachments";
import FilePreviewModal from "@/components/chat/file-preview-modal";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";
import {
  useChatSessionQuery,
  useConsultationsQuery,
  useCreateConsultationMutation,
  useMessagesQuery,
  useRelatedCasesQuery,
  sendChatMessageAndWait,
  subscribeChatGeneration,
  cancelChatGeneration,
  ChatGenerationCancelledError,
  type ChatMessage,
  type MessageReasoning,
  type MessageGroundingCheck,
} from "@/lib/chat/mutations";
import { extractMindMap, extractTraceSteps, stripStructuredBlocks, getActiveMindMap, type MindMapItem, type TraceStep } from "@/lib/chat/mind-map-parser";
import { ResearchTraceList } from "@/components/chat/research-trace-list";
import { useCaseQuery, useCaseDocumentsQuery, useConsultationDocumentsQuery, useUploadDocumentsMutation } from "@/lib/cases/mutations";
import { ALLOWED_EXTENSIONS, ALLOWED_FILE_TYPES_LABEL, isAllowedFileType, MAX_FILE_SIZE_BYTES } from "@/lib/cases/upload-batch";
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

/** Shown under a reply the user stopped (the composer's Stop button). */
function StoppedNotice({ label, compact }: { label: string; compact?: boolean }) {
  return (
    <div role="status" className={`mt-2 flex items-center gap-1.5 text-muted-foreground ${compact ? "text-[11px]" : "text-[12px]"}`}>
      <Square className="h-3 w-3 fill-current" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** Grounding verification rows for this reply, straight off the messages API — see
   * GroundingSummary. Undefined for user turns, for replies generated before the verifier ran,
   * and whenever it is disabled on the API. */
  groundingChecks?: MessageGroundingCheck[];
  /** Jev triage for this user turn — drives the urgency chip under the prompt. */
  urgent?: boolean | null;
  intent?: string | null;
  /** Only ever set when `enableFileChips` is on (ADR 0012) — Case Chat never populates this. */
  attachments?: MessageAttachment[];
  /** The AI's case strategy map, extracted from `[MINDMAP]...[/MINDMAP]` — during streaming
   * this is recomputed from the raw accumulated text on every chunk (see doSend); once the
   * message is persisted it comes straight from the backend (see baseMessages below). */
  mindMap?: MindMapItem;
  /** While streaming: live research steps extracted from `[TRACE]...[/TRACE]` frames — see
   * doSend, rebuilt on every chunk. Once persisted (ilovelawyer-api#119), this instead comes
   * straight from the backend (see baseMessages below), the same timing split mindMap/decisions/
   * reasoning already have — absent on turns that made no tool calls, or ones sent before this
   * shipped, not an error either way. */
  researchSteps?: TraceStep[];
  /** Set only when this reply is one topic of a split, multi-topic answer (see
   * ilovelawyer-api's MessageGroup) — `groupTitle` is that topic's heading, used as the
   * TopicNavigator label (see use-topic-navigator.ts). Not rendered inside the bubble itself:
   * the reply's own markdown heading already carries the same title, so showing `groupTitle`
   * again above it just duplicated it. Never set while a message is still streaming; splits
   * only appear once persisted. */
  groupId?: string | null;
  groupTitle?: string | null;
  /** This message's audited Decision Records (legal_decisions.py), for the "Why?" anchor
   * highlight in AssistantMessage — always empty while the turn is still streaming, since
   * decisions only exist once the persisted message loads (see baseMessages below). */
  decisions?: DecisionRecordPayload[];
  /** This turn's "why this answer" explanation — see ReasoningPanel. Same timing caveat as
   * `decisions`: empty while still streaming, only present once the persisted message loads. */
  reasoning?: MessageReasoning;
  /** Assistant message only: the user pressed Stop, so this reply is whatever had streamed by
   * then (possibly nothing). Shows a "Response stopped" notice under it. Live, this is set by
   * handleStop; once persisted it is derived from the preceding user message's replyStatus. */
  stopped?: boolean;
  /** User message only: its reply was stopped before any text streamed, so there is no assistant
   * message to hang the "Response stopped" notice on — it renders right under this bubble. */
  replyStopped?: boolean;
}

// Matches the ChatGPT/Claude convention — generous for a batch of case exhibits without
// the attachment-chip row or upload/indexing time getting unwieldy.
const MAX_ATTACHED_FILES = 10;

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

// Exact (trim, case-insensitive) match only — a split reply's groupTitle is free text the model
// wrote, not a real PanelId, so this never guesses at a close-but-wrong panel.
function matchPanelId(groupTitle: string | null | undefined, panelTitles: Record<string, string> | undefined): string | null {
  if (!groupTitle || !panelTitles) return null;
  const normalized = groupTitle.trim().toLowerCase();
  if (!normalized) return null;
  const entry = Object.entries(panelTitles).find(([, title]) => title.trim().toLowerCase() === normalized);
  return entry ? entry[0] : null;
}

type CaseChatTab = "chat" | "mindmap" | "timeline";

function tabFromSearch(searchParams: URLSearchParams, mindMapOnly: boolean, caseId?: string): CaseChatTab {
  if (mindMapOnly) return "mindmap";
  if (!caseId) return "chat";
  const tab = searchParams.get("tab");
  if (tab === "mindmap" || tab === "timeline") return tab;
  return "chat";
}

// navigator.clipboard requires a secure context (https, or localhost) — it's silently
// `undefined` on a plain http origin, which is otherwise indistinguishable from the write
// itself failing. Fall back to the old execCommand("copy") path (works over http) before
// giving up.
async function copyPlainText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the execCommand fallback below
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

// Lets a lawyer grab a full reply for pasting into Word/email without hand-selecting the
// rendered text. Copies the same cleaned plain text AssistantMessage renders (markdown syntax
// included) rather than rendered HTML — matches what the model actually produced.
function CopyMessageButton({
  text,
  label,
  copiedLabel,
  failedLabel,
  compact = false,
}: {
  text: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
  /** Icon-only, tighter padding — for the embedded case-workspace/case-terminal chat panels,
   * which are narrower than the main consultation view. */
  compact?: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleCopy = useCallback(async () => {
    const ok = await copyPlainText(text);
    setStatus(ok ? "copied" : "failed");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setStatus("idle"), 1500);
  }, [text]);

  const currentLabel = status === "copied" ? copiedLabel : status === "failed" ? failedLabel : label;
  const iconSize = compact ? "h-4 w-4" : "h-6 w-6";

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={currentLabel}
      aria-label={currentLabel}
      className={`inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${
        compact ? "p-1.5" : "p-2"
      }`}
    >
      {status === "copied" ? (
        <Check className={iconSize} aria-hidden="true" />
      ) : (
        <Copy className={iconSize} aria-hidden="true" />
      )}
    </button>
  );
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
  /** Shows the related-cases card under the last reply. Defaults to `!embedded`, same reasoning
   * as `showSuggestedPrompts` — Terminal's Legal Assistant pane opts back in explicitly. */
  showRelatedCases?: boolean;
  /** Shows Topic Navigator (jump between topics of a multi-topic split answer). Defaults to
   * `!embedded` — it's a side-rail component with no compact variant, so opting in inside a
   * narrow Terminal pane is a deliberate tradeoff, not the default. */
  showTopicNavigator?: boolean;
  /** When set, shows a small "view case files" link in the composer pointing here — the
   * alternative to `enableFileChips` for a case-scoped chat: Case Documents already has its own
   * dedicated surface (case-details-panel.tsx), so this links out to it instead of duplicating
   * chip/preview UI here. Terminal's Legal Assistant pane sets this to the case's Case Workspace
   * route; unset everywhere else (Case Workspace's own chat sits right next to that surface
   * already and doesn't need a link to itself). */
  filesLinkHref?: string;
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
   * instead of collapsing them into placeholder text. Set by the General Consultation page and
   * Case Workspace's chat; Terminal's Legal Assistant pane still leaves it off and links out to
   * Case Documents instead (see docs/adr/0012-message-scoped-document-attachments.md). */
  enableFileChips?: boolean;
  /** Terminal-only "jump to panel" link under a split reply's topic (see ChatPanel in
   * terminal-panels.tsx). Both must be supplied together — panelTitles is the real PanelId→title
   * map to exact-match a reply's groupTitle against (no match, no link: never a fuzzy guess at
   * the wrong panel), and onJumpToPanel actually focuses that panel on the Terminal's grid. Only
   * the Terminal's ChatPanel passes these, so this never appears on the standalone Consultation
   * page or in Case Workspace. */
  panelTitles?: Record<string, string>;
  onJumpToPanel?: (panelId: string) => void;
}

// Mirrors the alternating user/assistant bubble shapes below so switching
// into an existing consultation doesn't render a blank pane while its
// message history fetches.
function ChatHistorySkeleton() {
  return (
    <div className="flex flex-col gap-4 py-4">
      <Skeleton className="h-11 w-2/3 self-end rounded-[18px_18px_4px_18px]" />
      <Skeleton className="h-16 w-3/4 rounded-[18px_18px_18px_4px]" />
      <Skeleton className="h-9 w-1/2 self-end rounded-[18px_18px_4px_18px]" />
      <Skeleton className="h-20 w-4/5 rounded-[18px_18px_18px_4px]" />
    </div>
  );
}

export default function ConsultationChat({
  basePath,
  caseId,
  emptyStateHeading,
  emptyStateSubheading,
  emptyStateHeroImage,
  emptyStatePrompts,
  showSuggestedPrompts,
  showRelatedCases,
  showTopicNavigator,
  filesLinkHref,
  headerSlot,
  embedded = false,
  centerContent = false,
  isolateConsultation = false,
  mindMapOnly = false,
  inputPlaceholder,
  enableFileChips = false,
  panelTitles,
  onJumpToPanel,
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
  // TopicNavigator's own mobile drawer, lifted up (same reason as sidebarMobileOpen) so the
  // sticky header's mobile kebab menu can open it instead of TopicNavigator's own floating
  // trigger circle, which the kebab replaces on phones.
  const [topicMobileOpen, setTopicMobileOpen] = useState(false);
  // A Terminal pane is an independent chat surface. Its topic navigation must be a real
  // column in that pane rather than the full-page navigator's absolute overlay.
  const [terminalTopicsOpen, setTerminalTopicsOpen] = useState(true);
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
  // doSend's fetch/stream-reading loop isn't tied to this component's lifecycle (see
  // sendTokenRef's doc comment below) — switching away from this consultation (e.g. to
  // another case-terminal panel, which unmounts this whole component) doesn't cancel the
  // in-flight request, so the backend keeps generating and eventually persists the reply.
  // But `pendingTurn`/`isSending` are local state, reset to nothing on remount, so without
  // this the transcript looked "stopped" on return even though it wasn't — this store
  // (written by every ConsultationChat instance's own doSend, see startSending/stopSending
  // above) is what survives the remount and lets this instance know a turn for this
  // consultation is still out there.
  const isGeneratingElsewhere = useSendingConsultationsStore((s) =>
    consultationId ? s.sendingConsultationIds.has(consultationId) : false,
  );
  // Centralizes every place that used to write `?c=` to the URL — routes through local
  // state instead when isolated, per isolateConsultation's doc comment. useCallback keeps this
  // referentially stable so the auto-select effect below can safely depend on it. Always
  // replaces rather than pushing a history entry — switching consultations (or starting a new
  // one) used to push, which meant the phone's native edge-swipe-back gesture (and the browser
  // back button) stepped backward through consultations one at a time instead of leaving the
  // chat page, since each `?c=<id>` was its own history entry.
  const navigateToConsultation = useCallback(
    (id: string | null) => {
      if (isolateConsultation) {
        setLocalConsultationId(id);
        return;
      }
      const href = id ? `${basePath}?c=${id}` : basePath;
      router.replace(href);
    },
    [isolateConsultation, basePath, router],
  );
  // Key used to scope a pending (in-flight) send's local buffer to a consultation. A
  // brand-new chat (first message, no id yet) uses this placeholder until the backend
  // assigns a real id.
  const NEW_CONSULTATION_KEY = "__new__";

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  // The Decision Record whose "Why?" detail is currently open, clicked from a highlighted
  // anchor in an AssistantMessage bubble below — see components/chat/decision-drawer.tsx.
  const [openDecision, setOpenDecision] = useState<DecisionRecordPayload | null>(null);
  const handleOpenDecision = useCallback((decision: DecisionRecordPayload) => setOpenDecision(decision), []);
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
  // The in-flight doSend's abort handle, so the Stop button can end its wait (and, through it,
  // ask the API to stop the turn) - null when nothing is being sent from this mount.
  const sendAbortRef = useRef<AbortController | null>(null);
  // Stop was pressed and the API call / refetch it triggers hasn't finished - the Stop button
  // shows as busy meanwhile instead of accepting a second click.
  const [isStopping, setIsStopping] = useState(false);
  // The answer text has fully streamed but the turn is still finishing its extras (timeline,
  // mind map, reasoning, decisions) and saving - see composerAction. Set by chat:answer-complete,
  // cleared when the send settles or is abandoned.
  const [isFinalizing, setIsFinalizing] = useState(false);
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
  // Whether the composer's textarea currently spans more than one line — see the auto-grow
  // effect below, which sets it, and the composer row further down, which reads it to decide
  // whether attach/voice/send drop onto their own row below the text (like the narrow-viewport
  // layout already does) instead of sharing a row with it. Sharing a row works fine for a short
  // prompt, but for a long one no vertical alignment of the buttons within that row (centered,
  // top, or bottom) avoids the buttons ending up level with — and crowding — the text, so once
  // it's multi-line the buttons need their own row instead, not just a different alignment.
  const [isComposerMultiline, setIsComposerMultiline] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const shouldFollowTranscriptRef = useRef(true);
  const generatedChatInstanceId = useId().replace(/:/g, "");
  // The Case Workspace owns topic navigation outside this component and intentionally relies
  // on its historical `chat-msg-*` anchors. Only Terminal's embedded navigator needs a local
  // namespace because it owns the scrolling surface itself.
  const chatInstanceId = embedded && showTopicNavigator ? generatedChatInstanceId : "";
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
  const { data: history, isLoading: historyLoading } = useMessagesQuery(consultationId ?? undefined);
  const showHistorySkeleton = useDelayedLoading(historyLoading && !!consultationId);
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
            .map((m, i, visible) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
              // A stopped turn keeps the user message (replyStatus CANCELLED) and, if any text
              // had streamed, a partial assistant reply right after it - see the API's
              // ChatSvc.cancelChatGeneration.
              stopped: m.role === "assistant" && visible[i - 1]?.role === "user" && visible[i - 1]?.replyStatus === "CANCELLED",
              replyStopped: m.role === "user" && m.replyStatus === "CANCELLED" && visible[i + 1]?.role !== "assistant",
              // Empty on messages sent before the backend shipped message-scoped attachments
              // (handoff doc §5) — falls back to no chips for those, same as today.
              attachments: enableFileChips
                ? (m.documents ?? []).map((d) => ({ id: d.id, name: d.name, url: d.fileUrl, mimeType: d.mimeType }))
                : undefined,
              mindMap: m.mindMap?.data,
              groupId: m.groupId,
              groupTitle: m.groupTitle,
              decisions: m.decisionRecords?.records,
              reasoning: m.reasoning ?? undefined,
              researchSteps: m.researchSteps?.steps,
              groundingChecks: m.groundingChecks,
              urgent: m.urgent,
              intent: m.intent,
            }))
        : [],
    [consultationId, history, enableFileChips],
  );

  const consultationKey = consultationId ?? pendingUrlConsultationId ?? NEW_CONSULTATION_KEY;
  const isPendingTurnActive = pendingTurn?.key === consultationKey;
  // The backend's own durable truth for "is this turn's reply still generating" (see
  // ilovelawyer-api's Message.replyStatus) — unlike isGeneratingElsewhere, this survives a
  // full page reload, since it's read straight from the just-fetched history instead of any
  // in-memory client flag. undefined history (still loading) reads as neither pending nor
  // failed, same as before this existed.
  const lastHistoryEntry = consultationId ? (history ?? []).filter((m) => m.role !== "system").at(-1) : undefined;
  const serverSaysPending = lastHistoryEntry?.role === "user" && lastHistoryEntry.replyStatus === "PENDING";
  const serverSaysFailed = lastHistoryEntry?.role === "user" && lastHistoryEntry.replyStatus === "FAILED";
  // Covers a remounted instance of this same consultation (see isGeneratingElsewhere above),
  // or a fresh mount after a full page reload mid-generation (serverSaysPending): the user's
  // message is already persisted (ChatRepo.createMessage happens before any streaming starts)
  // but its reply isn't yet, so a trailing user message plus either signal is what a
  // still-in-flight turn looks like from here.
  const isResumedGenerating =
    !isPendingTurnActive &&
    baseMessages[baseMessages.length - 1]?.role === "user" &&
    (isGeneratingElsewhere || serverSaysPending);
  // Memoized so this only gets a new reference when its content actually changes — not on
  // every unrelated re-render. The isResumedGenerating/serverSaysFailed branches build a new
  // array via spread every time they run; without useMemo here, any of the countless
  // unrelated state updates this component has (sidebar toggles, textarea resize, etc.) would
  // re-run those spreads and hand effects keyed on `messages` (the scroll-to-bottom effect
  // below) a "changed" dependency even though nothing about the transcript actually did.
  const messages = useMemo<DisplayMessage[]>(
    () =>
      isPendingTurnActive
        ? pendingTurn!.messages
        : isResumedGenerating
          ? // pendingReplyContent is the last DB checkpoint (see Message.pendingReplyContent) —
            // showing it instead of a bare "" lets a refreshed page display the partial answer
            // already generated. It's a static snapshot now, not a live-updating one (the app
            // no longer polls for newer checkpoints) — the subscribeChatGeneration effect
            // below is what notices the turn actually finishing and swaps this for the real
            // persisted reply, same as the "no partial-token recovery required" design intends.
            [...baseMessages, { role: "assistant" as const, content: lastHistoryEntry?.pendingReplyContent ?? "" }]
          : serverSaysFailed
            ? [...baseMessages, { role: "assistant" as const, content: t("sendError") }]
            : baseMessages,
    [isPendingTurnActive, pendingTurn, isResumedGenerating, baseMessages, lastHistoryEntry?.pendingReplyContent, serverSaysFailed, t],
  );
  // Composer/related-cases gating below used to only key off local isSending, which a
  // remount clears — isBusy keeps them consistent with the resumed "still thinking" bubble
  // above instead of looking idle while that bubble is showing.
  // isGeneratingElsewhere covers coming back to a consultation whose send was started before
  // handleSelectConsultation/handleNewChat reset isSending — its pendingTurn is still here and
  // the reply is still in flight, so it must read (and gate the composer) as busy.
  const isBusy = isSending || isResumedGenerating || isGeneratingElsewhere;

  // The reply text is held back behind the "thinking" placeholder until the whole turn (answer,
  // confidence, "why this answer") is saved, so they appear together instead of the answer
  // showing first and the rest popping in once they finish - see shouldHoldAnswer. This is the
  // safety cap: once answer text has been sitting there for ANSWER_HOLD_CAP_MS, reveal it anyway
  // and let the extras follow, so one slow or stuck extra can never hide a finished answer. Every
  // send here carries the legal tag, so Chat Wonder delivers the answer text in one block at the
  // end (not token by token) - nothing to stream is lost by holding it. Reset whenever the held
  // text goes away (turn saved, stopped, switched consultations).
  const lastDisplayedMessage = messages[messages.length - 1];
  const answerTextPresent =
    ((isPendingTurnActive && (isSending || isGeneratingElsewhere)) || isResumedGenerating) &&
    lastDisplayedMessage?.role === "assistant" &&
    Boolean(lastDisplayedMessage.content);
  const [revealHeldAnswer, setRevealHeldAnswer] = useState(false);
  useEffect(() => {
    if (!answerTextPresent) return;
    const timer = setTimeout(() => setRevealHeldAnswer(true), ANSWER_HOLD_CAP_MS);
    return () => {
      clearTimeout(timer);
      setRevealHeldAnswer(false);
    };
  }, [answerTextPresent]);

  // Once the persisted history is at least as long as the optimistic buffer, hand the
  // transcript back to it and refresh the related-cases panel that persisted alongside it.
  // Driven by `history` changing — which now happens via explicit invalidateQueries calls
  // (doSend's own post-generation refetch, the subscribeChatGeneration effect below, and the
  // socket's on-(re)connect invalidate) rather than a polling interval.
  useEffect(() => {
    if (!pendingTurn || !consultationId || pendingTurn.key !== consultationKey) return;
    const persistedCount = (history ?? []).filter((m) => m.role !== "system").length;
    if (persistedCount >= pendingTurn.messages.length) {
      setPendingTurn(null);
      queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(consultationId) });
    }
  }, [history, pendingTurn, consultationId, consultationKey, queryClient]);

  // Resumed generation (a reply still PENDING from a cold load, another tab, or a remount —
  // see isResumedGenerating above) has no local doSend() call in THIS mount watching for
  // completion. Rather than poll useMessagesQuery on an interval, subscribe directly to that
  // turn's own chat:done/chat:error (its messageId is the pending user message's own id —
  // see ChatGenerationJob.jobId) and do a single refetch once it settles. Guarded on
  // `!isPendingTurnActive` so this never double-subscribes alongside doSend's own
  // sendChatMessageAndWait subscription for a turn THIS mount just sent.
  // An optimistic id (see optimistic-messages.ts) means the POST hasn't returned yet — the
  // originating doSend is still running and will refetch when it settles, so nothing to watch.
  const resumedPendingMessageId =
    !isPendingTurnActive && serverSaysPending && !isOptimisticMessageId(lastHistoryEntry?.id)
      ? lastHistoryEntry?.id
      : undefined;
  useEffect(() => {
    if (!consultationId || !resumedPendingMessageId) return;
    const unsubscribe = subscribeChatGeneration(resumedPendingMessageId, {
      onDone: () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
        queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(consultationId) });
      },
      onError: () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
      },
      onCancelled: () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
      },
    });
    return unsubscribe;
  }, [consultationId, resumedPendingMessageId, queryClient]);

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
    latestDecisions,
  } = useTopicNavigator(consultationId, chatInstanceId, transcriptRef);
  // Gates both the desktop TopicNavigator rail/mobile drawer and the mobile kebab's "Topics"
  // item below — same condition as the <TopicNavigator> mount further down, kept in sync
  // rather than duplicated ad hoc.
  const hasTopics = (showTopicNavigator ?? !embedded) && (splitTopics.length > 0 || isGeneratingTopics);

  // Every piece of evidence quoted for the latest turn's decisions, handed to *every* bubble in
  // the transcript so each can highlight yellow whichever quotes actually appear in its own
  // text — a split reply only attaches `decisions` to its last topic bubble (see
  // ChatSvc.persistAssistantTurn), but the quoted sentence itself is just as likely to be in an
  // earlier sibling, so no single bubble can be assumed to hold every quote. Cheap: this is a
  // handful of short strings, and AssistantMessage no-ops (no highlight) wherever none match.
  const evidenceQuoteHighlights = useMemo(() => {
    const targets: { id: string; text: string }[] = [];
    if (!latestDecisions) return targets;
    const messageIndex = latestDecisions.index;
    latestDecisions.records.forEach((record, ri) => {
      record.evidenceFor.forEach((ev, ei) => {
        if (ev.quote?.trim()) targets.push({ id: evidenceQuoteElementId(messageIndex, ri, "for", ei), text: ev.quote });
      });
      record.evidenceAgainst.forEach((ev, ei) => {
        if (ev.quote?.trim()) targets.push({ id: evidenceQuoteElementId(messageIndex, ri, "against", ei), text: ev.quote });
      });
    });
    return targets;
  }, [latestDecisions]);

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
          .filter((title): title is string => !!title && isSuggestableTitle(title)),
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
      navigateToConsultation(mostRecent.id);
    }
  }, [caseId, consultationId, caseConsultations, navigateToConsultation]);

  // CSS max-h-[50vh] on the textarea (below) is the actual visual cap — the browser clamps
  // to it and shows a scrollbar regardless of what height gets set here, so this can just
  // always request the content's full natural height rather than also clamping in JS.
  //
  // A layout effect, not a plain one: a passive effect runs *after* the browser has painted the
  // new text at the old height, so as a line wrapped, the one-row textarea auto-scrolled to keep
  // the caret in view and the text visibly vanished for a few frames until the resize landed.
  // It also re-runs when isComposerMultiline flips — that flip changes the textarea's width
  // (shared row -> its own full-width row), so the height measured at the old width is stale.
  // Because that re-measure happens at the *new* width, where the same text may fit on one line
  // again, going back to single-row is gated on the text having shrunk past where it wrapped
  // (multilineFlipLengthRef) — otherwise the two layouts would flip-flop forever on the same text.
  const multilineFlipLengthRef = useRef(0);
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    el.scrollTop = 0;
    // A single line (leading-6 + the textarea's own py-1.5) renders at 36px in both the
    // embedded and non-embedded variants — anything taller means it has wrapped past one line.
    const wrapped = el.scrollHeight > 40;
    if (!isComposerMultiline) {
      if (wrapped) {
        multilineFlipLengthRef.current = inputMessage.length;
        setIsComposerMultiline(true);
      }
    } else if (
      !wrapped &&
      (inputMessage.length === 0 ||
        inputMessage.length < multilineFlipLengthRef.current - Math.min(8, multilineFlipLengthRef.current >> 1))
    ) {
      setIsComposerMultiline(false);
    }
  }, [inputMessage, isComposerMultiline]);

  // The transcript, rather than the page, owns scrolling. Follow new/streaming content only
  // while the lawyer is already at the bottom; toggling Topics, scroll-spy state, or a query
  // refresh must never pull someone away from the part of the advice they are reading.
  useEffect(() => {
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const updateFollowState = () => {
      shouldFollowTranscriptRef.current = transcript.scrollHeight - transcript.scrollTop - transcript.clientHeight < 72;
    };
    updateFollowState();
    transcript.addEventListener("scroll", updateFollowState, { passive: true });
    return () => transcript.removeEventListener("scroll", updateFollowState);
  }, []);

  // Switching to a different conversation should always land at its bottom, regardless of
  // whether a scroll position from the *previous* conversation had left "follow" turned off.
  useEffect(() => {
    shouldFollowTranscriptRef.current = true;
  }, [consultationKey]);

  // Scrolls to the bottom for the user's own new prompt (and the thinking/research rows under it)
  // and when a consultation is opened - but never because a reply arrived or finished: the whole
  // answer (with its confidence and explanation, held together - see shouldHoldAnswer above)
  // shows up at once, and jumping to its end would skip past its start. See
  // shouldScrollTranscriptToBottom.
  const scrollContextRef = useRef({ key: consultationKey, userCount: 0 });
  useEffect(() => {
    const userCount = messages.filter((m) => m.role === "user").length;
    const previous = scrollContextRef.current;
    scrollContextRef.current = { key: consultationKey, userCount };
    const lastMessage = messages[messages.length - 1];
    const transcript = transcriptRef.current;
    if (!transcript) return;
    const shouldScroll = shouldScrollTranscriptToBottom({
      follow: shouldFollowTranscriptRef.current,
      contextChanged: previous.key !== consultationKey || previous.userCount !== userCount,
      lastIsReply: lastMessage?.role === "assistant" && Boolean(lastMessage.content),
    });
    if (shouldScroll) transcript.scrollTo({ top: transcript.scrollHeight, behavior: "auto" });
  }, [messages, consultationKey]);

  const handleNewChat = () => {
    sendTokenRef.current++; // abandon any in-flight send for the consultation we're leaving
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
    setIsFinalizing(false);
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
    setIsFinalizing(false);
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

  // Adds files to the local queue as "pending" — upload doesn't start until Send is clicked
  // (see handleSendMessage).
  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const [supported, unsupported] = [
      list.filter(isAllowedFileType),
      list.filter((f) => !isAllowedFileType(f)),
    ];
    if (unsupported.length > 0) {
      toast.error(
        t("input.attachmentUnsupportedType", {
          defaultValue: `${unsupported.map((f) => f.name).join(", ")} — unsupported file type, wasn't added. Supported formats: ${ALLOWED_FILE_TYPES_LABEL}.`,
          fileNames: unsupported.map((f) => f.name).join(", "),
          formats: ALLOWED_FILE_TYPES_LABEL,
        })
      );
    }

    const [withinSizeLimit, oversized] = [
      supported.filter((f) => f.size <= MAX_FILE_SIZE_BYTES),
      supported.filter((f) => f.size > MAX_FILE_SIZE_BYTES),
    ];
    if (oversized.length > 0) {
      toast.error(
        t("input.attachmentTooLarge", {
          defaultValue: `${oversized.map((f) => f.name).join(", ")} — over the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit per file, wasn't added.`,
          fileNames: oversized.map((f) => f.name).join(", "),
          maxMb: MAX_FILE_SIZE_BYTES / (1024 * 1024),
        })
      );
    }

    const remaining = Math.max(0, MAX_ATTACHED_FILES - queuedFiles.length);
    const accepted = withinSizeLimit.slice(0, remaining);
    if (accepted.length < withinSizeLimit.length) {
      toast.warning(
        t("input.attachmentLimitHit", { defaultValue: `Only ${MAX_ATTACHED_FILES} files can be attached at once — the rest weren't added.`, max: MAX_ATTACHED_FILES })
      );
    }
    if (accepted.length === 0) return;
    setQueuedFiles((prev) => [
      ...prev,
      ...accepted.map((file) => ({ id: generateId(), file, status: "pending" as const })),
    ]);
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
  };

  // Only a drag that actually carries files is an attach gesture — selecting text in the textarea
  // and dragging it (or a text/link drag from elsewhere on the page) also fires dragover on this
  // form, and treating that as a file drop flashed the "Drop files to attach" overlay over the
  // very text being selected. Text drags are left entirely to the browser (no preventDefault), so
  // moving selected text within the textarea still works normally.
  const isFileDrag = (e: React.DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    // dragleave also fires when the pointer moves onto a child of the form — only clear the
    // overlay when it actually leaves the form, or it would flicker over every inner element.
    if (e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget)) return;
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    if (!isFileDrag(e)) return;
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
    if (!text || !session || isBusy) return;

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

    // Ended by handleStop. cancelRequest is the API call that actually stops the turn - issued
    // as soon as both the Stop press and the message id (only known once the POST returns) exist,
    // in whichever order they happen.
    const abort = new AbortController();
    sendAbortRef.current = abort;
    let cancelRequest: Promise<unknown> | null = null;

    setIsFinalizing(false);
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
      let enqueuedMessageId: string | null = null;
      const requestServerCancel = () => {
        if (cancelRequest || !enqueuedMessageId) return;
        cancelRequest = cancelChatGeneration(activeConsultationId!, enqueuedMessageId);
      };
      abort.signal.addEventListener("abort", requestServerCancel, { once: true });
      // A topic breakdown (see TopicNavigator/SourcesPanel) can only exist once this turn is
      // persisted — this flag lets those panels show a "generating" state immediately instead
      // of looking empty for however long the turn takes.
      startSending(activeConsultationId);
      // Persist the prompt into the query cache right away (not just pendingTurn, which dies
      // on unmount) so leaving and returning mid-generation still finds it — see
      // appendOptimisticUserMessage's doc comment.
      const optimisticId = appendOptimisticUserMessage(queryClient, activeConsultationId, opts?.displayText ?? text);

      // Kept separate from the displayed bubble text: the stream can carry a trailing
      // [MINDMAP]...[/MINDMAP] block that must never render as raw JSON mid-stream (the API
      // only strips/persists it from the *final* response — see mind-map-parser.ts's header
      // comment). Re-derived from scratch on every chunk rather than appended incrementally,
      // so a tag that straddles a chunk boundary still resolves correctly once it closes.
      let rawAccumulated = "";

      // Creates the AI generation job (ilovelawyer-api's ChatGenerationQueue owns RAG/AI/
      // persistence from here — see that queue's doc comment) and waits for the worker to
      // actually finish it — chat:chunk renders live into pendingTurn as it streams in;
      // "done" is chat:done/chat:error over the socket, or (the robust, refresh-safe fallback
      // for a socket that's disconnected/reconnecting/missed the event) useMessagesQuery's own
      // polling noticing the persisted reply — see sendChatMessageAndWait's doc comment. A
      // chat:error rejects this, landing in the catch block below same as any other failure.
      await sendChatMessageAndWait(
        queryClient,
        {
          consultationId: activeConsultationId,
          sessionId: session.session_id,
          message: text,
          documentContext: opts?.documentContext,
          caseDocumentId: opts?.caseDocumentId,
          documentIds: opts?.documentIds,
          // Lets backend fall back to READY case docs when this consultation has none yet
          // (homepage chat linked to a case, or case-portfolio without consultation uploads).
          caseId: linkedCaseId || caseId || undefined,
        },
        {
          onChunk: (chunk) => {
            // After Stop the bubble is frozen at what the user saw; a chunk already in flight
            // must not extend it (the API saved the partial reply at the same point).
            if (sendTokenRef.current !== myToken || abort.signal.aborted) return;
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
          onSessionRotated: (rotatedSessionId) => {
            queryClient.setQueryData(chatKeys.session(), { session_id: rotatedSessionId });
          },
          messagesBefore: messagesBeforeSend,
          signal: abort.signal,
          onAnswerComplete: () => {
            if (sendTokenRef.current === myToken && !abort.signal.aborted) setIsFinalizing(true);
          },
          onEnqueued: (messageId) => {
            enqueuedMessageId = messageId;
            resolveOptimisticMessageId(queryClient, activeConsultationId!, optimisticId, messageId);
            // Stop was pressed before the POST came back - the turn exists now, so stop it.
            if (abort.signal.aborted) requestServerCancel();
          },
        },
      );

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
      if (error instanceof ChatGenerationCancelledError) {
        // Stopped - by this mount's Stop button, or another tab's. Not a failure: no error copy.
        // Wait for the API to confirm (it saves the partial reply), then let the persisted
        // history - which now carries the user message as CANCELLED and any partial reply, so
        // it renders "Response stopped" by itself - replace the local buffer. If the cancel call
        // itself failed the turn may still be running: the refetch shows the server's truth
        // (still PENDING -> the resumed "generating" state, with Stop available again).
        try {
          await cancelRequest;
        } catch (cancelError) {
          console.error("Failed to stop generation:", cancelError);
        }
        if (startedConsultationId) {
          await queryClient
            .invalidateQueries({ queryKey: chatKeys.messages(startedConsultationId), refetchType: "all" })
            .catch(() => {});
        }
        if (sendTokenRef.current === myToken) setPendingTurn(null);
        return;
      }
      console.error("Failed to send message:", error);
      // Drop (or, for a chat:error, replace with the server's FAILED copy of) the optimistic
      // prompt written above, even if the user has navigated away from this send.
      if (startedConsultationId) {
        void queryClient.invalidateQueries({ queryKey: chatKeys.messages(startedConsultationId), refetchType: "all" });
      }
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
      if (sendAbortRef.current === abort) sendAbortRef.current = null;
      setIsStopping(false);
      setIsFinalizing(false);
      if (sendTokenRef.current === myToken) {
        setIsSending(false);
        setPendingUrlConsultationId(null);
      }
    }
  };

  // The id of a turn that is generating but not owned by a doSend in THIS mount (a page reload
  // mid-generation, or another tab): its user message is the trailing history entry, PENDING.
  // An optimistic id means that message's own POST hasn't returned yet - nothing to stop by id.
  const resumedStoppableMessageId =
    isResumedGenerating && serverSaysPending && !isOptimisticMessageId(lastHistoryEntry?.id)
      ? lastHistoryEntry?.id
      : undefined;
  const canStop = isSending ? sendAbortRef.current !== null : Boolean(resumedStoppableMessageId);

  const handleStop = async () => {
    if (isStopping || !canStop) return;
    setIsStopping(true);

    const abort = sendAbortRef.current;
    if (isSending && abort) {
      // This mount's own send: freeze the bubble at what has streamed so far right away, then
      // ending the wait hands over to doSend's cancelled branch (API call, refetch, cleanup).
      setPendingTurn((prev) => {
        if (!prev || prev.key !== consultationKey) return prev;
        const nextMessages = [...prev.messages];
        const last = nextMessages[nextMessages.length - 1];
        if (last?.role === "assistant") nextMessages[nextMessages.length - 1] = { ...last, stopped: true };
        return { ...prev, messages: nextMessages };
      });
      abort.abort();
      return;
    }

    try {
      if (consultationId && resumedStoppableMessageId) {
        await cancelChatGeneration(consultationId, resumedStoppableMessageId);
        await queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId), refetchType: "all" });
      }
    } catch (error) {
      console.error("Failed to stop generation:", error);
    } finally {
      setIsStopping(false);
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
          accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          onChange={handleFileChange}
        />

        {queuedFiles.length > 0 && (
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
                          className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-card dark:hover:bg-overlay-hover shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                        className="w-5 h-5 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-card dark:hover:bg-overlay-hover shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
         * Non-embedded: below `sm` this always wraps into two rows — the textarea's basis-full
         * forces it to claim the whole row width, pushing attach/voice/send onto a shared second
         * line below it via ordinary flex-wrap. At `sm`+ with a short (single-line) prompt, the
         * textarea's flex-1 instead lets it share one row with the buttons for a compact pill
         * look. Embedded ignores that `sm` viewport check entirely (a Case Workspace/Terminal
         * pane can be narrow regardless of the browser window), so it's driven purely by
         * isComposerMultiline below instead of a breakpoint.
         *
         * isComposerMultiline forces that same wrapped, two-row layout once the prompt actually
         * grows past one line (at `sm`+ too, for the non-embedded case) — sharing a row with the
         * buttons was tried first (aligning them to the row's center, end, then start in turn),
         * but whichever edge the buttons anchor to, they end up level with part of a long
         * prompt's text, which reads as the buttons crowding the text. Giving them their own row
         * below avoids that regardless of how tall the prompt gets. Each non-embedded child's
         * own order class (plain below `sm` or when isComposerMultiline, sm:order- otherwise)
         * restores the single-row sequence — attach, textarea, voice, send — only for that
         * compact `sm`+ short-prompt case; embedded doesn't need this since its buttons are all
         * order-3 regardless; the textarea's default order already sorts it first. */}
        <div
          className={
            embedded
              ? `flex items-start gap-1.5 ${isComposerMultiline ? "flex-wrap" : ""}`
              : `flex flex-wrap items-start gap-1.5 ${isComposerMultiline ? "" : "sm:flex-nowrap"}`
          }
        >
          {!isRecording && !transcribingId && (
            <div
              className={
                embedded
                  ? `relative min-w-0 ${isComposerMultiline ? "basis-full" : "flex-1"}`
                  : `relative min-w-0 basis-full order-1 ${isComposerMultiline ? "" : "sm:flex-1 sm:order-2"}`
              }
            >
              <textarea
                ref={textareaRef}
                rows={1}
                className={`w-full resize-none bg-transparent border-none outline-none font-['Inter'] leading-6 overflow-y-auto scrollbar-none [-ms-overflow-style:none] placeholder:truncate placeholder:text-transparent ${
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
                  // placeholder:truncate's white-space:nowrap still matters even though the
                  // placeholder itself is invisible below (placeholder:text-transparent) — a
                  // wrapped native placeholder still inflates the textarea's own scrollHeight
                  // (see the auto-grow effect below), visibly expanding an empty box to 2+ lines
                  // on a narrow phone width before anything's even typed. Its overflow/ellipsis
                  // half of `truncate` is dead weight (kept only for the small chance a future
                  // engine honors it) — text-overflow: ellipsis is not reliably applied to a
                  // <textarea>'s ::placeholder across browsers (confirmed: Chromium renders it as
                  // a hard clip with no "…" at all), which is what the visible overlay span below
                  // actually exists to fix. The native placeholder attribute itself is kept (just
                  // invisible) so screen readers still get it as the field's accessible name.
                  // text-base (16px) below sm avoids iOS Safari's auto-zoom-on-focus in embedded
                  // panes (Case Workspace/Terminal) — the smaller desktop size returns once
                  // that's no longer a risk.
                  embedded
                    ? "px-2 py-1.5 text-base sm:text-[13px] text-foreground"
                    : "px-1 py-1.5 text-[15px] text-foreground"
                }`}
                placeholder={inputPlaceholder ?? t("input.placeholder")}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                disabled={isBusy}
              />
              {/* Visible stand-in for the (now transparent) native placeholder — truncate
                  reliably applies overflow/ellipsis on a plain span, unlike on a textarea's
                  ::placeholder. Mirrors the textarea's own padding so it lines up exactly where
                  typed text would start; pointer-events-none so clicks reach the textarea
                  underneath, and it's hidden the instant there's real input.
                  Its font-size drops below `sm` (independent of the actual typed-text size
                  above) since the full placeholder copy is long enough to still get clipped by
                  `truncate` at 15px on a phone-width row — shrinking just this overlay lets the
                  whole sentence fit on one line without touching real input sizing. */}
              {!inputMessage && (
                <span
                  aria-hidden="true"
                  className={`pointer-events-none select-none absolute inset-0 truncate leading-6 font-['Inter'] text-muted-foreground ${
                    embedded ? "px-2 py-1.5 text-base sm:text-[13px]" : "px-1 py-1.5 text-[13px] sm:text-[15px]"
                  }`}
                >
                  {inputPlaceholder ?? t("input.placeholder")}
                </span>
              )}
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
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Paperclip className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.attachFile")}</TooltipContent>
                </Tooltip>
              )}

              {filesLinkHref && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={filesLinkHref}
                      aria-label={t("input.viewCaseFiles")}
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.viewCaseFiles")}</TooltipContent>
                </Tooltip>
              )}

              {!transcribingId && (
                <VoiceDictate
                  disabled={isBusy}
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
                  // ml-auto pushes this (and the send/stop button right after it) to the far
                  // right of the row it wraps onto once isComposerMultiline is true, leaving
                  // attach (and the files link) at the far left — same trick as the non-embedded
                  // composer below. A no-op on the single-line row, where the textarea's own
                  // flex-1 already soaks up all the free space.
                  className="order-3 ml-auto"
                />
              )}

              {!isRecording && !transcribingId && (composerAction({ isBusy, isFinalizing }) === "stop" ? (
                // While a reply is generating the composer's action becomes Stop, in the Send slot.
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void handleStop()}
                      disabled={!canStop || isStopping}
                      aria-label={t("input.stopGenerating", { defaultValue: "Stop generating" })}
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50"
                    >
                      {isStopping ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.stopGenerating", { defaultValue: "Stop generating" })}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={isBusy || !session || queuedFiles.some((f) => f.status === "uploading")}
                      aria-label={t("input.sendMessage")}
                      className="order-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.sendMessage")}</TooltipContent>
                </Tooltip>
              ))}
            </>
          ) : (
            <>
              {/* Hidden while dictating or transcribing — VoiceDictate (recording state) or
                  the transcribing row above takes over the composer instead. Plain order below
                  `sm` or while isComposerMultiline (row 2, after the textarea's basis-full row),
                  sm:order-1 (leftmost) only for the compact `sm`+ short-prompt single-row case. */}
              {!isRecording && !transcribingId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleClipClick}
                      disabled={queuedFiles.length >= MAX_ATTACHED_FILES}
                      aria-label={t("input.attachFile")}
                      className={`order-2 ${isComposerMultiline ? "" : "sm:order-1"} w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-40 disabled:pointer-events-none`}
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.attachFile")}</TooltipContent>
                </Tooltip>
              )}

              {!transcribingId && (
                <VoiceDictate
                  disabled={isBusy}
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
                  // ml-auto pushes this (and the send button right after it) to the far right
                  // of the row-2 line it wraps onto below `sm` (see the wrapping div's comment
                  // above) — at `sm`+ the textarea's own flex-1 already soaks up all the free
                  // space on the single-line layout, so this margin has nothing left to claim
                  // and is a no-op there.
                  className="order-3 ml-auto"
                />
              )}

              {!isRecording && !transcribingId && (composerAction({ isBusy, isFinalizing }) === "stop" ? (
                // While a reply is generating the composer's action becomes Stop - the same pill
                // in the same slot, so it can't be missed or mis-clicked for Send.
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => void handleStop()}
                      disabled={!canStop || isStopping}
                      aria-label={t("input.stopGenerating", { defaultValue: "Stop generating" })}
                      className="order-3 h-9 w-9 shrink-0 flex items-center justify-center rounded-full bg-brand-gold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 disabled:opacity-50"
                    >
                      {isStopping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("input.stopGenerating", { defaultValue: "Stop generating" })}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={isBusy || !session || queuedFiles.some((f) => f.status === "uploading")}
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
              ))}
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

  {!embedded && hasTopics && (
        <TopicNavigator
          groups={splitTopicGroups}
          activeIndex={activeTopicIndex}
          expanded={topicPanelExpanded}
          onExpandedChange={setTopicPanelExpanded}
          isMobileOpen={topicMobileOpen}
          onMobileOpenChange={setTopicMobileOpen}
          hideMobileTrigger={!embedded}
          onJump={scrollToTopic}
          label={t("topicNavigator.label")}
          isGenerating={isGeneratingTopics}
          generatingLabel={t("topicNavigator.generating")}
        />
      )}

      {headerSlot && !embedded && <div className="relative z-20 shrink-0 pt-16 pb-4">{headerSlot}</div>}

      <main className={`relative z-10 w-full mx-auto flex flex-1 min-h-0 ${embedded ? "max-w-none flex-row" : "max-w-5xl flex-col"} ${headerSlot || embedded ? "" : "pt-16"}`}>

        <div className="relative z-10 flex min-w-0 flex-col flex-1 min-h-0">
        {/* Terminal's Chat pane has no ConsultationSidebar (that's a full-page rail — see
         * !embedded above) and no external picker of its own (unlike Case Workspace, which
         * already renders its own ThreadPicker above this component — see case-workspace.tsx).
         * Gated on isolateConsultation specifically, not embedded: Case Workspace's chat is
         * embedded too, and would otherwise get this a second time, stacked on top of its own
         * picker. A Case's chat is a single thread (see thread-picker.tsx), so this is just a
         * label of what's open, not a switcher — there's nothing else here to reach past. */}
        {isolateConsultation && !mindMapOnly && caseId && (
          <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
            <ThreadPicker caseId={caseId} activeConsultationId={consultationId} />
            {embedded && showTopicNavigator && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setTerminalTopicsOpen((open) => !open)}
                    aria-expanded={terminalTopicsOpen}
                    aria-controls={terminalTopicsOpen ? `${chatInstanceId}-topics` : undefined}
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={splitTopics.length === 0 && !isGeneratingTopics}
                  >
                    <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
                    Topics
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {splitTopics.length === 0 && !isGeneratingTopics ? "Topics appear after a structured AI response" : "Show or hide response topics"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
        {(() => {
          // `embedded` excluded deliberately: the centered "Gemini landing" treatment (heading +
          // composer vertically centered together) makes sense as a real landing page, but reads
          // as a bug — "why is the composer floating in the middle?" — inside a small, persistent
          // Terminal pane. Embedded panes always use the normal bottom-pinned composer, even
          // before a consultation exists; the plain empty-message placeholder below covers that
          // case instead.
          const isEmptyChatLanding = !embedded && !mindMapOnly && activeTab === "chat" && !consultationId && visibleMessages.length === 0;
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
                      className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                )}
                <div className={`relative flex-1 flex flex-col items-center min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none] ${embedded ? "justify-center gap-4 pb-4" : "justify-between sm:justify-center gap-5 pt-8 pb-6 sm:pt-0 sm:pb-24"}`}>
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
                    <div className="relative z-10 hidden sm:flex flex-wrap items-center justify-center gap-2 max-w-3xl px-2">
                      {suggestedPrompts.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => void doSend(prompt)}
                          // max-w-full + normal wrapping — these are free-form strings (either a
                          // past consultation title or a caller-provided emptyStatePrompts entry),
                          // so a long one must wrap inside the pill instead of forcing it wider
                          // than the viewport.
                          className="max-w-full cursor-pointer whitespace-normal break-words rounded-full border border-foreground/25 bg-card px-4 py-2.5 text-[13px] font-medium text-foreground shadow-sm transition-all hover:-translate-y-px hover:border-brand-gold hover:shadow-md dark:bg-white/[0.06] dark:border-white/25"
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
                      className="lg:hidden shrink-0 flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <PanelLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {/* Title strip — desktop/tablet only. Mobile's header is just the sidebar
                        toggle and the kebab menu below, matching the redesign's leaner phone
                        chrome (no room for a truncated title next to a case chip). */}
                    <div className="hidden lg:flex items-center gap-2.5 min-w-0">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-gold shrink-0" aria-hidden="true" />
                      <span className="font-['Libre_Caslon_Text'] text-[15px] uppercase tracking-[-0.01em] truncate text-foreground">
                        {consultationTitle ?? t("sidebar.untitledConsultation")}
                      </span>
                    </div>
                  </div>
                  {linkedCaseId && linkedCaseRecord && (
                    <div className="hidden lg:flex items-center gap-5 text-[10px] tracking-[1px] uppercase text-muted-foreground shrink-0">
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
                  {/* Mobile-only controls: a ChatGPT-style "new chat" pencil sitting left of the
                      kebab, so starting a fresh consultation doesn't require opening the sidebar
                      drawer first just to reach its own "New consultation" button. The kebab
                      itself is the stand-in for the desktop "Open case" chip and the Topics
                      rail, both of which have no room on a phone header — only rendered when
                      there's actually something for it to hold. */}
                  <div className="lg:hidden flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={handleNewChat}
                      aria-label={t("sidebar.newChat")}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <SquarePen className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {(linkedCaseId || hasTopics) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("caseHub.moreOptions", { defaultValue: "More options" })}
                            className="flex h-8 w-8 items-center justify-center rounded-full text-foreground hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {linkedCaseId && (
                            <DropdownMenuItem asChild>
                              <Link href={`/homepage/case-portfolio/${linkedCaseId}`}>
                                <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
                                {t("caseHub.openCase", { defaultValue: "Open case" })}
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {hasTopics && (
                            <DropdownMenuItem onSelect={() => setTopicMobileOpen(true)}>
                              <ListTree className="h-3.5 w-3.5" aria-hidden="true" />
                              {t("topicNavigator.label")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              )}

              {/* Scrollable message pane — input bar below stays put regardless of scroll position */}
              <div ref={transcriptRef} data-chat-transcript className="flex-1 min-h-0 overflow-y-auto scrollbar-thin [scrollbar-color:var(--border)_transparent]">
              <div className={`w-full mx-auto flex flex-col gap-4 py-4 ${embedded ? (centerContent ? "max-w-[850px] px-6" : "px-2") : "max-w-3xl px-2"}`}>
                {/* A consultation can resolve (auto-picked "most recent", or otherwise) to one
                 * whose only messages are hidden system turns (e.g. the auto mind-map prompt
                 * filtered out of visibleMessages above) — without this, that renders as a bare
                 * pane with no explanation once the history query has actually settled. Also
                 * covers embedded's "no consultation yet" case, now that isEmptyChatLanding
                 * excludes embedded — emptyStateHeading isn't dropped, just shown inline here
                 * instead of in the (non-embedded-only) centered landing above. */}
                {showHistorySkeleton && <ChatHistorySkeleton />}

                {visibleMessages.length === 0 && !historyLoading && !isBusy && (
                  <div className="rounded-md bg-muted px-3 py-4 text-center font-['Inter']">
                    {embedded && emptyStateHeading && (
                      <p className="mb-1 text-sm font-medium text-foreground">{emptyStateHeading}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{emptyStateSubheading ?? t("emptyState.subheading")}</p>
                  </div>
                )}
                {visibleMessages.map((m, i) => {
                  if (m.role === "user") {
                    return (
                      <React.Fragment key={i}>
                        <div className="flex flex-col items-end gap-2">
                          {m.attachments && m.attachments.length > 0 && (
                            <MessageAttachments attachments={m.attachments} onSelect={setPreviewAttachment} ragStatusById={ragStatusById} />
                          )}
                          {m.content && (
                            <div className={`max-w-[80%] rounded-[18px_18px_4px_18px] border border-border bg-muted font-['Inter'] whitespace-pre-wrap break-words text-foreground ${
                              embedded ? "px-3 py-2 text-[13px] leading-5" : "px-4 py-3 text-[15px] leading-6"
                            }`}>
                              {m.content}
                            </div>
                          )}
                        </div>
                        {/* Stopped before a single word streamed: no assistant message exists to
                            carry the notice, so it sits right under the prompt instead. */}
                        {/* Triage only earns space when it flagged something: an "urgent" chip on
                            every routine message would be wallpaper. The intent label rides along
                            on the same chip rather than claiming a second one. */}
                        {m.urgent && (
                          <div className={embedded ? "px-1" : "px-4"}>
                            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                              {t("triage.urgent", { defaultValue: "Urgent" })}
                              {m.intent ? <span className="font-normal opacity-80">· {t(`triage.intent.${m.intent}`, { defaultValue: "" })}</span> : null}
                            </span>
                          </div>
                        )}
                        {m.replyStopped && (
                          <div className={embedded ? "px-1" : "px-4"}>
                            <StoppedNotice label={t("message.stopped", { defaultValue: "Response stopped" })} compact={embedded} />
                          </div>
                        )}
                      </React.Fragment>
                    );
                  }

                  // The last assistant message is a placeholder pushed synchronously at send
                  // time, before any chunk streams in — that's the window "thinking" covers.
                  // isResumedGenerating covers the same window after a remount (switched
                  // panels/pages mid-send and came back) — the placeholder here is `messages`'
                  // own synthetic one, not pendingTurn's, so isSending/isPendingTurnActive (both
                  // local to this instance) don't apply.
                  const isStreamingThis =
                    ((isPendingTurnActive && (isSending || isGeneratingElsewhere)) || isResumedGenerating) && i === visibleMessages.length - 1;
                  const isLastMessage = i === visibleMessages.length - 1;
                  const holdAnswer = shouldHoldAnswer({
                    isStreaming: isStreamingThis,
                    stopped: Boolean(m.stopped),
                    revealed: revealHeldAnswer,
                  });

                  // Sibling topic bubbles of one split answer (see MessageGroup) sit right next
                  // to each other in visibleMessages — pull the continuation ones up closer than
                  // the parent's gap-4 so they read as one answer broken into cards, not
                  // unrelated replies.
                  const isGroupContinuation = Boolean(m.groupId) && visibleMessages[i - 1]?.groupId === m.groupId;
                  // One copy button per *reply*, not per topic card — a split answer (MessageGroup)
                  // reads as several bubbles but is one response, so only the last card in the
                  // group gets the button, and it copies every sibling's content joined together.
                  const isLastOfGroup = !m.groupId || visibleMessages[i + 1]?.groupId !== m.groupId;
                  const fullReplyText = m.groupId
                    ? visibleMessages
                        .filter((msg) => msg.groupId === m.groupId)
                        .map((msg) => cleanAssistantContent(msg.content))
                        .join("\n\n")
                    : cleanAssistantContent(m.content);

                  return (
                    <div
                      key={i}
                      id={chatInstanceId ? `${chatInstanceId}-chat-msg-${i}` : `chat-msg-${i}`}
                      className={`w-full rounded-2xl ${embedded ? "px-1 py-1 text-foreground" : "px-4 py-3"} ${isGroupContinuation ? "-mt-3" : ""}`}
                    >
                      {m.stopped && !m.content ? (
                        <StoppedNotice label={t("message.stopped", { defaultValue: "Response stopped" })} compact={embedded} />
                      ) : isStreamingThis && (!m.content || holdAnswer) ? (
                        // Before any text: the research trace, or the thinking indicator. Once the
                        // answer text is here but held (see holdAnswer), the trace stays and the
                        // indicator switches to "finalizing" so the wait reads as work still in
                        // progress, not stuck - the answer, its confidence and its "why this
                        // answer" explanation then all appear together once holdAnswer clears,
                        // instead of the answer showing first and the rest popping in after.
                        <>
                          {m.researchSteps && m.researchSteps.length > 0 && <ResearchTraceList steps={m.researchSteps} />}
                          {(!(m.researchSteps && m.researchSteps.length > 0) || holdAnswer) && (
                            <div className={m.researchSteps && m.researchSteps.length > 0 ? "mt-3" : undefined}>
                              <ThinkingIndicator label={holdAnswer && m.content ? t("thinkingFinalizing") : t("thinking")} />
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {!embedded && !isGroupContinuation && (
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
                            decisions={m.decisions}
                            onOpenDecision={handleOpenDecision}
                            messageIndex={i}
                            quoteHighlights={evidenceQuoteHighlights}
                            groundingChecks={m.groundingChecks}
                          />
                          <ReasoningPanel reasoning={m.reasoning} />
                          {!isStreamingThis && m.content && isolateConsultation && onJumpToPanel && (() => {
                            const matchedPanelId = matchPanelId(m.groupTitle, panelTitles);
                            if (!matchedPanelId) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => onJumpToPanel(matchedPanelId)}
                                className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-brand-gold/50 hover:text-foreground"
                              >
                                {t("chat.jumpToPanel", { defaultValue: "Open {{panel}} pane", panel: panelTitles![matchedPanelId] })}
                                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                              </button>
                            );
                          })()}
                          {(showRelatedCases ?? !embedded) && !isBusy && isLastMessage && m.content && relatedCases.length > 0 && (
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
                          {!isStreamingThis && m.content && isLastOfGroup && (
                            <div className="mt-2 flex justify-start">
                              <CopyMessageButton
                                text={fullReplyText}
                                label={t("message.copy", { defaultValue: "Copy response" })}
                                copiedLabel={t("message.copied", { defaultValue: "Copied!" })}
                                failedLabel={t("message.copyFailed", { defaultValue: "Couldn't copy" })}
                                compact={embedded}
                              />
                            </div>
                          )}
                          {m.stopped && (
                            <StoppedNotice label={t("message.stopped", { defaultValue: "Response stopped" })} compact={embedded} />
                          )}
                          {/* The answer above is complete; the analysis around it (sources, reasoning,
                              decisions) is still being finished and saved, so Send stays disabled. */}
                          {isLastMessage && isSending && isFinalizing && (
                            <div role="status" className={`mt-2 flex items-center gap-1.5 text-muted-foreground ${embedded ? "text-[11px]" : "text-[12px]"}`}>
                              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                              <span>{t("message.finalizing", { defaultValue: "Finishing analysis…" })}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

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
        {embedded && showTopicNavigator && terminalTopicsOpen && (splitTopics.length > 0 || isGeneratingTopics) && (
          <aside
            id={`${chatInstanceId}-topics`}
            aria-label={t("topicNavigator.label")}
            className="ml-2 flex w-52 shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
          >
            <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[1px] text-foreground">
              <ListTree className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
              {t("topicNavigator.label")}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {splitTopics.length === 0 ? (
                <TopicNavigatorLoading label={t("topicNavigator.generating")} />
              ) : (
                <TopicNavigatorList groups={splitTopicGroups} activeIndex={activeTopicIndex} onJump={scrollToTopic} />
              )}
            </div>
          </aside>
        )}
      </main>

      {previewAttachment && !embedded && (
        <FilePreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}

      <DecisionDrawer decision={openDecision} onOpenChange={(open) => !open && setOpenDecision(null)} />
    </div>
  );
}
