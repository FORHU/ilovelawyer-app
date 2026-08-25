"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Mic, Square, X, ArrowRight, Loader2, AlertCircle, CheckCircle2, RotateCcw, Workflow, MessageSquare, Mail, Send, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import AssistantMessage, { ThinkingIndicator } from "@/components/chat/assistant-message";
import ConsultationSidebar from "@/components/chat/consultation-sidebar";
import { CaseHubWidget } from "@/components/chat/case-hub-widget";
import { MessageAttachments, type MessageAttachment } from "@/components/chat/message-attachments";
import FilePreviewModal from "@/components/chat/file-preview-modal";
import EmailComposerModal from "@/components/chat/email-composer-modal";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import {
  useChatSessionQuery,
  useConsultationsQuery,
  useCreateConsultationMutation,
  useMessagesQuery,
  sendChatMessage,
} from "@/lib/chat/mutations";
import { extractMindMap, stripStructuredBlocks, getActiveMindMap, type MindMapItem } from "@/lib/chat/mind-map-parser";
import { useCaseQuery, useCaseDocumentsQuery, useConsultationDocumentsQuery, useUploadDocumentsMutation } from "@/lib/cases/mutations";

import { chatKeys } from "@/lib/query-keys";
import { generateId } from "@/lib/id";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  /** Only ever set when `enableFileChips` is on (ADR 0012) — Case Chat never populates this. */
  attachments?: MessageAttachment[];
  /** The AI's case strategy map, extracted from `[MINDMAP]...[/MINDMAP]` — during streaming
   * this is recomputed from the raw accumulated text on every chunk (see doSend); once the
   * message is persisted it comes straight from the backend (see baseMessages below). */
  mindMap?: MindMapItem;
}

const MAX_TEXTAREA_HEIGHT = 200;

// Sent verbatim (both by the auto-trigger and the manual retry button) so the Chat tab can
// recognize and hide this system-driven turn instead of showing it as a bubble the user
// never actually typed — see the `visibleMessages` filter below.
export const AUTO_MINDMAP_PROMPT = "Please generate a visual strategy map for this case.";

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
  /** Rendered above the transcript, inside the centered chat column — e.g. a case details panel. */
  headerSlot?: React.ReactNode;
  /** Compact layout for a terminal pane. Case Portfolio does not pass this. */
  embedded?: boolean;
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
  headerSlot,
  embedded = false,
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
  // Whether the Email action (docs/adr/0013-case-consultation-email-action.md) is open — lives
  // here (not per-page) since the toolbar button that opens it is shared by every consultation.
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
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
  const uploadDocuments = useUploadDocumentsMutation();

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const searchParams = useSearchParams();
  const urlConsultationId = searchParams.get("c");
  const queryClient = useQueryClient();

  // The URL is the source of truth for which consultation is active, so refresh,
  // back/forward, and sidebar navigation all just work without any duplicated state sync.
  const consultationId = urlConsultationId;
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
  const { data: history } = useMessagesQuery(consultationId ?? undefined);
  const { data: caseConsultations } = useConsultationsQuery(caseId);

  // Explicit case linkage for CaseHubWidget's case-details panel. On a case's own chat
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

  // The transcript for the consultation currently on screen comes straight from the
  // React Query cache — keyed by consultationId, so switching consultations just means a
  // different query result, with no manual copy-into-local-state step to keep in sync.
  const baseMessages: DisplayMessage[] = consultationId
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
        }))
    : [];

  const consultationKey = consultationId ?? pendingUrlConsultationId ?? NEW_CONSULTATION_KEY;
  const isPendingTurnActive = pendingTurn?.key === consultationKey;
  const messages = isPendingTurnActive ? pendingTurn!.messages : baseMessages;

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
      if (m.role === "user" && m.content === AUTO_MINDMAP_PROMPT) {
        hidden.add(i);
        if (messages[i + 1]?.role === "assistant") hidden.add(i + 1);
      }
    });
    return hidden.size > 0 ? messages.filter((_, i) => !hidden.has(i)) : messages;
  }, [messages]);

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
      router.replace(`${basePath}?c=${mostRecent.id}`);
    }
  }, [caseId, consultationId, caseConsultations, basePath, router]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [inputMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Release the microphone if the user navigates away mid-recording.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const handleNewChat = () => {
    sendTokenRef.current++; // abandon any in-flight send for the consultation we're leaving
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
    setActiveTab("chat");
    router.push(basePath);
  };

  const handleSelectConsultation = (id: string) => {
    if (id === consultationId) return;
    sendTokenRef.current++;
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
    setActiveTab("chat");
    router.push(`${basePath}?c=${id}`);
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
        router.push(`${basePath}?c=${consultation.id}`);
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
    setQueuedFiles((prev) => [
      ...prev,
      ...list.map((file) => ({ id: generateId(), file, status: "pending" as const })),
    ]);
    list.forEach(queueDocument);
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

  // Toggles in-place mic recording; the finished clip is queued for the Transcription page.
  const handleMicClick = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        queueTranscript(blob, durationSeconds);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access failed:", error);
      alert(t("microphoneError"));
    }
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

    setIsSending(true);
    setPendingTurn({
      key: turnKey,
      messages: [
        ...baseMessages,
        { role: "user", content: opts?.displayText ?? text, attachments: opts?.attachments },
        { role: "assistant", content: "" },
      ],
    });

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
          setPendingTurn((prev) => {
            if (!prev) return prev;
            const lastIndex = prev.messages.length - 1;
            const last = prev.messages[lastIndex];
            if (!last) return prev;
            const nextMessages = [...prev.messages];
            nextMessages[lastIndex] = { role: last.role, content: displayContent, mindMap };
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
      // drop the local buffer in favor of the (now up to date) query cache.
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeConsultationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.consultationsAll() });
      queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(activeConsultationId) });
      if (sendTokenRef.current === myToken) setPendingTurn(null);
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
      if (sendTokenRef.current === myToken) {
        setIsSending(false);
        setPendingUrlConsultationId(null);
      }
    }
  };

  // Mind Map tab shouldn't need an explicit "Generate" click every time — fire the same
  // request automatically the first time this case-chat mounts with the tab reachable and
  // nothing generated yet. Ref-scoped rather than persisted, so a fresh page load naturally
  // retries on its own if the previous attempt only came back empty because case documents
  // were still processing (see docs/case-document-rag-backend-handoff.md).
  const autoGeneratedMindMapRef = useRef(false);
  useEffect(() => {
    if (autoGeneratedMindMapRef.current) return;
    if (!caseId || activeMindMap || isSending || !session) return;
    if (!mindMapOnly && (embedded || activeTab !== "mindmap")) return;
    autoGeneratedMindMapRef.current = true;
    void doSend(AUTO_MINDMAP_PROMPT);
  }, [embedded, mindMapOnly, caseId, activeTab, activeMindMap, isSending, session]);

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
    <div className={`w-full shrink-0 ${embedded ? "" : "max-w-3xl mx-auto"}`}>
      <form
        onSubmit={handleSendMessage}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full flex flex-col gap-2 transition-colors ${
          embedded
            ? `rounded-lg border bg-muted p-2 ${isDraggingOver ? "border-blue-500 border-dashed" : "border-border"}`
            : `backdrop-blur-md bg-card/80 p-3 rounded-3xl border shadow-xl ${
                isDraggingOver ? "border-primary border-dashed" : "border-border"
              }`
        }`}
      >
        {isDraggingOver && (
          <div
            className={`absolute inset-0 z-10 flex items-center justify-center pointer-events-none ${
              embedded ? "rounded-lg bg-card/90" : "rounded-3xl bg-card/90"
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

        {queuedFiles.length > 0 && (
          <div className="flex flex-col gap-1 px-2">
            <div className="flex flex-wrap gap-1.5">
              {queuedFiles.map((f) => (
                <span
                  key={f.id}
                  className="flex items-center gap-1.5 max-w-full rounded-full bg-muted text-foreground text-[13px] font-['Inter'] pl-3 pr-1.5 py-1 w-fit"
                >
                  {f.status === "uploading" ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : f.status === "uploaded" && resolvedRagStatus(f) === "PENDING" ? (
                    <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
                  ) : f.status === "uploaded" && resolvedRagStatus(f) === "FAILED" ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  ) : f.status === "uploaded" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
                  ) : f.status === "error" ? (
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
                  ) : (
                    <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="truncate max-w-[220px]">{f.file.name}</span>
                  {f.status === "error" && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => retryUpload(f.id)}
                          className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-foreground/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-foreground/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
              <span className="text-xs text-red-600 dark:text-red-400">{t("input.attachmentUploadError")}</span>
            )}
            {queuedFiles.some((f) => f.status === "uploaded" && resolvedRagStatus(f) === "PENDING") && (
              <span className="text-xs text-muted-foreground">{t("input.indexingHint")}</span>
            )}
            {queuedFiles.some((f) => f.status === "uploaded" && resolvedRagStatus(f) === "FAILED") && (
              <span className="text-xs text-red-600 dark:text-red-400">{t("input.indexingFailed")}</span>
            )}
          </div>
        )}

        {/* Auto-growing textarea so multi-line input actually wraps, like Gemini's input */}
        <div className={embedded ? "flex items-end gap-1.5" : "contents"}>
          <textarea
            ref={textareaRef}
            rows={1}
            className={`w-full shrink-0 resize-none bg-transparent border-none outline-none font-['Inter'] leading-6 max-h-50 overflow-y-auto scrollbar-none [-ms-overflow-style:none] ${
              embedded
                ? "px-2 py-1.5 text-[13px] text-foreground placeholder-muted-foreground"
                : "text-[15px] text-foreground placeholder-muted-foreground px-2 py-1"
            }`}
            placeholder={inputPlaceholder ?? t("input.placeholder")}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSending}
          />

          {embedded ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={isSending || !session || queuedFiles.some((f) => f.status === "uploading")}
                  aria-label={t("input.sendMessage")}
                  className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("input.sendMessage")}</TooltipContent>
            </Tooltip>
          ) : (
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-1 text-muted-foreground">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleClipClick}
                  aria-label={t("input.attachFile")}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted hover:text-foreground shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("input.attachFile")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleMicClick}
                  aria-pressed={isRecording}
                  aria-label={isRecording ? t("input.stopRecording") : t("input.startRecording")}
                  className={`w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    isRecording
                      ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 animate-pulse hover:bg-red-200 dark:hover:bg-red-500/25"
                      : "hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {isRecording ? <Square className="w-3.5 h-3.5 fill-current" /> : <Mic className="w-4 h-4" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{isRecording ? t("input.stopRecording") : t("input.startRecording")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setEmailComposerOpen(true)}
                  disabled={!consultationId}
                  aria-label={t("email.action")}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted hover:text-foreground shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("email.action")}</TooltipContent>
            </Tooltip>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="submit"
                disabled={isSending || !session || queuedFiles.some((f) => f.status === "uploading")}
                aria-label={t("input.sendMessage")}
                className="bg-brand-navy-950 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:bg-[#162244] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-950/40 focus-visible:ring-offset-2 disabled:opacity-50 shrink-0"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("input.sendMessage")}</TooltipContent>
          </Tooltip>
        </div>
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
          : `relative flex-1 flex flex-col min-h-0 px-4 sm:px-8 transition-[padding-left] duration-200 ${
              sidebarExpanded ? "md:pl-80 md:pr-32" : "md:px-32"
            }`
      }
    >
      {!embedded && (
        <ConsultationSidebar
          activeConsultationId={consultationId}
          onSelectConsultation={handleSelectConsultation}
          onNewChat={handleNewChat}
          caseId={caseId}
          expanded={sidebarExpanded}
          onExpandedChange={setSidebarExpanded}
        />
      )}

      {headerSlot && !embedded && <div className="relative z-20 shrink-0 pt-16 pb-4">{headerSlot}</div>}

      <main className={`relative z-10 w-full mx-auto flex flex-col flex-1 min-h-0 ${embedded ? "max-w-none" : "max-w-5xl"} ${headerSlot || embedded ? "" : "pt-16"}`}>
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
              <div className="flex items-center gap-1 pt-4 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTabChange("chat")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
                    activeTab === "chat" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("mindMap.chatTab")}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("mindmap")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
                    activeTab === "mindmap" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Workflow className="w-3.5 h-3.5" aria-hidden="true" />
                  {t("mindMap.mapTab")}
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("timeline")}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-['Inter'] font-medium transition-colors ${
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
                  />
                ) : (
                  <div className={`flex-1 flex flex-col items-center justify-center gap-4 text-center ${mindMapOnly ? "h-full py-8" : "py-24"}`}>
                    {isSending ? (
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
                    {!isSending && (
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
              /* No consultation yet — heading and input are centered together, like Gemini's landing state */
              <div className={`flex-1 flex flex-col items-center justify-center min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none] ${embedded ? "gap-4 pb-4" : "gap-8 pb-24"}`}>
                <div className="text-center max-w-2xl mx-auto px-2">
                  <h1
                    className={
                      embedded
                        ? "mb-2 font-['Inter'] text-lg font-medium tracking-[-0.3px] text-foreground"
                        : "font-['Libre_Caslon_Text'] font-normal text-primary text-[32px] sm:text-[40px] md:text-[48px] tracking-[-1.2px] mb-4"
                    }
                  >
                    {emptyStateHeading ?? t("emptyState.heading")}
                  </h1>
                  <p
                    className={`font-['Inter'] leading-6 ${
                      embedded ? "text-[13px] text-muted-foreground" : "text-foreground text-[15px] md:text-[16px]"
                    }`}
                  >
                    {emptyStateSubheading ?? t("emptyState.subheading")}
                  </p>
                </div>
                {chatInputBar}
              </div>
            ) : (
            /* Scrollable message pane — input bar below stays put regardless of scroll position */
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none]">
              <div className={`w-full mx-auto flex flex-col gap-4 px-2 py-4 ${embedded ? "" : "max-w-3xl"}`}>
                {visibleMessages.map((m, i) => {
                  if (m.role === "user") {
                    return (
                      <div key={i} className="flex flex-col items-end gap-1.5">
                        {m.attachments && m.attachments.length > 0 && (
                          <MessageAttachments attachments={m.attachments} onSelect={setPreviewAttachment} />
                        )}
                        {m.content && (
                          <div className={`max-w-[80%] rounded-2xl border border-border bg-muted font-['Inter'] whitespace-pre-wrap text-foreground ${
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

                  return (
                    <div key={i} className={`w-full rounded-2xl ${embedded ? "px-1 py-1 text-foreground" : "px-4 py-3"}`}>
                      {isStreamingThis && !m.content ? (
                        <ThinkingIndicator label={t("thinking")} />
                      ) : (
                        <AssistantMessage
                          content={m.content || "…"}
                          className={embedded ? "text-[13px] leading-5 text-foreground" : undefined}
                        />
                      )}
                    </div>
                  );
                })}

                {!embedded && !isSending && visibleMessages.length > 0 && visibleMessages.at(-1)?.role === "assistant" && visibleMessages.at(-1)?.content && (
                  <CaseHubWidget caseId={linkedCaseId} consultationId={consultationId} />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
            )}
            {!isEmptyChatLanding && activeTab === "chat" && (
              <div className={embedded ? "pt-2 pb-2" : "pt-4 pb-6"}>{chatInputBar}</div>
            )}
          </>
          );
        })()}
      </main>

      {previewAttachment && !embedded && (
        <FilePreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} />
      )}

      {emailComposerOpen && !embedded && consultationId && (
        <EmailComposerModal
          consultationId={consultationId}
          caseId={caseId}
          messages={history ?? []}
          onClose={() => setEmailComposerOpen(false)}
        />
      )}
    </div>
  );
}
