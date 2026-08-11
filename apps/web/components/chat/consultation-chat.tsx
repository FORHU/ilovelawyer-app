"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Mic, Square, X, ArrowRight, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import AssistantMessage, { ThinkingIndicator } from "@/components/chat/assistant-message";
import ConsultationSidebar from "@/components/chat/consultation-sidebar";
import { CaseHubWidget } from "@/components/chat/case-hub-widget";
import {
  useChatSessionQuery,
  useConsultationsQuery,
  useCreateConsultationMutation,
  useMessagesQuery,
  sendChatMessage,
} from "@/lib/chat/mutations";
import { useUploadDocumentsMutation } from "@/lib/cases/mutations";
import { chatKeys } from "@/lib/query-keys";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TEXTAREA_HEIGHT = 200;

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
}

export default function ConsultationChat({
  basePath,
  caseId,
  emptyStateHeading,
  emptyStateSubheading,
  headerSlot,
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
      doc?: { id: string; name: string; aiSummary: string | null };
    }>
  >([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // The transcript for the consultation currently on screen comes straight from the
  // React Query cache — keyed by consultationId, so switching consultations just means a
  // different query result, with no manual copy-into-local-state step to keep in sync.
  const baseMessages: DisplayMessage[] = consultationId
    ? (history ?? [])
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    : [];

  const consultationKey = consultationId ?? pendingUrlConsultationId ?? NEW_CONSULTATION_KEY;
  const isPendingTurnActive = pendingTurn?.key === consultationKey;
  const messages = isPendingTurnActive ? pendingTurn!.messages : baseMessages;

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
    router.push(basePath);
  };

  const handleSelectConsultation = (id: string) => {
    if (id === consultationId) return;
    sendTokenRef.current++;
    setPendingUrlConsultationId(null);
    resolvedConsultationIdRef.current = null;
    consultationCreationRef.current = null;
    setIsSending(false);
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
      ...list.map((file) => ({ id: crypto.randomUUID(), file, status: "pending" as const })),
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

  // Runs presign→PUT for each queue entry in parallel (S3 has no batched-presign primitive),
  // then confirms every successfully-uploaded file in a single call — so a multi-file
  // attachment lands as one /api/documents/bulk request instead of one /api/documents
  // request per file. Updates each entry's status as it settles and returns the updated
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
        ? { ...entry, status: "uploaded" as const, doc: { id: doc.id, name: doc.name, aiSummary: doc.aiSummary } }
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
    opts?: { documentContext?: string; caseDocumentId?: string },
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
      messages: [...baseMessages, { role: "user", content: text }, { role: "assistant", content: "" }],
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

      const { newSessionId } = await sendChatMessage({
        consultationId: activeConsultationId,
        sessionId: session.session_id,
        message: text,
        documentContext: opts?.documentContext,
        caseDocumentId: opts?.caseDocumentId,
        // Lets backend fall back to READY case docs when this consultation has none yet
        // (homepage chat linked to a case, or case-portfolio without consultation uploads).
        caseId: linkedCaseId || caseId || undefined,
        onChunk: (chunk) => {
          if (sendTokenRef.current !== myToken) return;
          setPendingTurn((prev) => {
            if (!prev) return prev;
            const lastIndex = prev.messages.length - 1;
            const last = prev.messages[lastIndex];
            if (!last) return prev;
            const nextMessages = [...prev.messages];
            nextMessages[lastIndex] = { role: last.role, content: last.content + chunk };
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

    setInputMessage("");
    setQueuedFiles([]);
    void doSend(messageText, { documentContext, caseDocumentId });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const chatInputBar = (
    <div className="w-full max-w-3xl mx-auto shrink-0">
      <form
        onSubmit={handleSendMessage}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full backdrop-blur-md bg-card/80 p-3 rounded-3xl border shadow-xl flex flex-col gap-2 transition-colors ${
          isDraggingOver ? "border-primary border-dashed" : "border-border"
        }`}
      >
        {isDraggingOver && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-card/90 pointer-events-none">
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
          </div>
        )}

        {/* Auto-growing textarea so multi-line input actually wraps, like Gemini's input */}
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full shrink-0 resize-none bg-transparent border-none outline-none font-['Inter'] text-[15px] text-foreground placeholder-muted-foreground px-2 py-1 leading-6 max-h-50 overflow-y-auto scrollbar-none [-ms-overflow-style:none]"
          placeholder={t("input.placeholder")}
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />

        {/* Toolbar row below the text, matching Gemini's layout */}
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
      </form>
    </div>
  );

  return (
    // Left padding grows when the rail is expanded, reserving room for it (w-72 = 18rem)
    // instead of letting it overlay whatever sits at the page's left edge — otherwise the
    // expanded rail covers the case header row's back link/case chip underneath it.
    <div
      className={`relative flex-1 flex flex-col min-h-0 px-4 sm:px-8 transition-[padding-left] duration-200 ${
        sidebarExpanded ? "md:pl-80 md:pr-32" : "md:px-32"
      }`}
    >
      {/* Left Sidebar Panel */}
      <ConsultationSidebar
        activeConsultationId={consultationId}
        onSelectConsultation={handleSelectConsultation}
        onNewChat={handleNewChat}
        caseId={caseId}
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
      />

      {/* Pinned directly under the navbar, spanning the full workspace width rather than
          the chat column's narrower max-w-5xl — a page-level strip (back link, case
          identity), not part of the centered consultation. Sits outside <main> so it isn't
          bound by that centering; ConsultationSidebar is absolutely positioned so its own
          top-16 offset is unaffected by this sibling. */}
      {headerSlot && <div className="relative z-20 shrink-0 pt-16 pb-4">{headerSlot}</div>}

      {/* Main Chat Interface */}
      <main className={`relative z-10 max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0 ${headerSlot ? "" : "pt-16"}`}>
        {!consultationId && messages.length === 0 ? (
          /* No consultation yet — heading and input are centered together, like Gemini's landing state */
          <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-0 pb-24 overflow-y-auto scrollbar-none [-ms-overflow-style:none]">
            <div className="text-center max-w-2xl mx-auto px-2">
              <h1 className="font-['Libre_Caslon_Text'] font-normal text-primary text-[32px] sm:text-[40px] md:text-[48px] tracking-[-1.2px] mb-4">
                {emptyStateHeading ?? t("emptyState.heading")}
              </h1>
              <p className="font-['Inter'] text-foreground text-[15px] md:text-[16px] leading-6">
                {emptyStateSubheading ?? t("emptyState.subheading")}
              </p>
            </div>
            {chatInputBar}
          </div>
        ) : (
          <>
            {/* Scrollable message pane — input bar below stays put regardless of scroll position */}
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none]">
              <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 px-2 py-4">
                {messages.map((m, i) => {
                  if (m.role === "user") {
                    return (
                      <div
                        key={i}
                        className="max-w-[80%] self-end rounded-2xl border border-border bg-muted px-4 py-3 text-[15px] leading-6 font-['Inter'] whitespace-pre-wrap text-foreground"
                      >
                        {m.content}
                      </div>
                    );
                  }

                  // The last assistant message is a placeholder pushed synchronously at send
                  // time, before any chunk streams in — that's the window "thinking" covers.
                  const isStreamingThis = isSending && isPendingTurnActive && i === messages.length - 1;

                  return (
                    <div key={i} className="w-full rounded-2xl px-4 py-3">
                      {isStreamingThis && !m.content ? (
                        <ThinkingIndicator label={t("thinking")} />
                      ) : (
                        <AssistantMessage content={m.content || "…"} />
                      )}
                    </div>
                  );
                })}

                {!isSending && messages.length > 0 && messages.at(-1)?.role === "assistant" && messages.at(-1)?.content && (
                  <CaseHubWidget caseId={linkedCaseId} consultationId={consultationId} />
                )}

                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="pt-4 pb-6">{chatInputBar}</div>
          </>
        )}
      </main>
    </div>
  );
}
