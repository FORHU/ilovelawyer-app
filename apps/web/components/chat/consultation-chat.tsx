"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Paperclip, Mic, Square, X, ArrowRight, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import AssistantMessage, { ThinkingIndicator } from "@/components/chat/assistant-message";
import ConversationSidebar from "@/components/chat/conversation-sidebar";
import { CaseHubWidget } from "@/components/chat/case-hub-widget";
import {
  useChatSessionQuery,
  useConversationsQuery,
  useCreateConversationMutation,
  useMessagesQuery,
  sendChatMessage,
} from "@/lib/chat/mutations";
import { useUploadCaseDocumentMutation } from "@/lib/cases/mutations";
import { chatKeys } from "@/lib/query-keys";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TEXTAREA_HEIGHT = 200;

interface ConsultationChatProps {
  /** Route this chat lives at — conversation selection is driven by a `?c=<id>` query
   * param appended to this path, so the same component works at "/homepage" and at a
   * case's own route. */
  basePath: string;
  /** Scopes the sidebar's conversation list to this case, and tags new conversations
   * created here with it, so a case's chat only ever shows conversations about that case. */
  caseId?: string;
  /** Overrides for the empty-state copy shown before any conversation is picked/started. */
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
  // Lifted out of ConversationSidebar so the workspace below can reserve room for the
  // expanded rail (pushing content over) instead of letting it overlay whatever's at the
  // page's left edge — on the case page that's the back link/case chip header row, which
  // the expanded rail would otherwise cover.
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Set once handleFileChange's upload (below) resolves — carries the id/name/aiSummary
  // the send needs to reference this attachment as documentContext. Null while nothing's
  // attached, while the upload is still in flight, or if it failed.
  const [attachedDoc, setAttachedDoc] = useState<{ id: string; name: string; aiSummary: string | null } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueDocument = useMediaQueueStore((s) => s.queueDocument);
  const queueTranscript = useMediaQueueStore((s) => s.queueTranscript);
  const uploadDocument = useUploadCaseDocumentMutation();

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const queryClient = useQueryClient();

  // The URL is the source of truth for which conversation is active, so refresh,
  // back/forward, and sidebar navigation all just work without any duplicated state sync.
  const conversationId = urlConversationId;
  // Key used to scope a pending (in-flight) send's local buffer to a conversation. A
  // brand-new chat (first message, no id yet) uses this placeholder until the backend
  // assigns a real id.
  const NEW_CONVERSATION_KEY = "__new__";

  const [inputMessage, setInputMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  // Holds the user message + streaming assistant reply for a send that hasn't landed in
  // the conversation's saved history yet, keyed to the conversation it belongs to. The
  // rendered `messages` below only use it while `key` matches the conversation on screen,
  // so switching conversations mid-send stops showing it automatically — no manual
  // clearing/resetting required, which is what made the old version prone to getting
  // stuck showing stale or empty content until a full reload.
  const [pendingTurn, setPendingTurn] = useState<{ key: string; messages: DisplayMessage[] } | null>(null);
  // Bumped on every send and on every explicit navigation away from the conversation a
  // send belongs to, so a stale in-flight stream can recognize it's been abandoned and
  // stop writing chunks into whatever conversation is now on screen.
  const sendTokenRef = useRef(0);
  // Set right after a first-message send creates a brand-new conversation, to the id it
  // was just given — before `router.push(...?c=<id>)`'s URL change has actually landed in
  // `conversationId` (that takes an extra render). Without this, `conversationKey` below
  // would still read as "new" for that gap, `pendingTurn` (already re-keyed to the real
  // id) would stop matching it, and the reply being streamed into it would render as
  // missing — exactly for a brand-new conversation's first message, self-correcting on
  // every message after since `conversationId` is already resolved by then. Cleared once
  // the send settles or the user explicitly navigates elsewhere. State (not a ref) since
  // it has to affect what gets rendered.
  const [pendingUrlConversationId, setPendingUrlConversationId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = useChatSessionQuery();
  const createConversation = useCreateConversationMutation();
  const { data: history } = useMessagesQuery(conversationId ?? undefined);
  const { data: caseConversations } = useConversationsQuery(caseId);

  // Explicit case linkage for CaseHubWidget's case-details panel. On a case's own chat
  // page the `caseId` prop already pins it; on the general /homepage chat, fall back to
  // whichever case the current conversation is tagged with, or a pending ?caseId= carried
  // over from a case's "Start Chat" action. Deliberately does NOT fall back further to
  // "the user's most recently active case" — that previously leaked one conversation's
  // case into every other unrelated conversation's hub.
  const pendingCaseId = searchParams.get("caseId") ?? "";
  const linkedCaseId =
    caseId ??
    (conversationId
      ? (caseConversations?.find((c) => c.id === conversationId)?.caseId ?? null)
      : pendingCaseId || null);

  // The transcript for the conversation currently on screen comes straight from the
  // React Query cache — keyed by conversationId, so switching conversations just means a
  // different query result, with no manual copy-into-local-state step to keep in sync.
  const baseMessages: DisplayMessage[] = conversationId
    ? (history ?? [])
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))
    : [];

  const conversationKey = conversationId ?? pendingUrlConversationId ?? NEW_CONVERSATION_KEY;
  const isPendingTurnActive = pendingTurn?.key === conversationKey;
  const messages = isPendingTurnActive ? pendingTurn!.messages : baseMessages;

  // For a case's chat, arriving with no `?c=` param (e.g. leaving and coming back to the
  // case, rather than clicking "New Chat" from within it) shouldn't dump you on the blank
  // empty state when a conversation already exists — that reads as "my prompts vanished"
  // even though they're just sitting in the sidebar unselected. Redirect straight to the
  // most recent one. Runs at most once per mount: `autoSelectedRef` is set as soon as
  // either branch below resolves (a conversation gets auto-picked, or the case turns out
  // to have none yet), so a later explicit "New Chat" click — which also clears `?c=` —
  // is never re-hijacked back into a conversation.
  const autoSelectedRef = useRef(false);
  useEffect(() => {
    if (!caseId || autoSelectedRef.current) return;
    if (conversationId) {
      autoSelectedRef.current = true;
      return;
    }
    if (!caseConversations) return; // still loading — wait for it rather than assuming "none"
    autoSelectedRef.current = true;
    const mostRecent = caseConversations[0];
    if (mostRecent) {
      router.replace(`${basePath}?c=${mostRecent.id}`);
    }
  }, [caseId, conversationId, caseConversations, basePath, router]);

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
    sendTokenRef.current++; // abandon any in-flight send for the conversation we're leaving
    setPendingUrlConversationId(null);
    setIsSending(false);
    router.push(basePath);
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return;
    sendTokenRef.current++;
    setPendingUrlConversationId(null);
    setIsSending(false);
    router.push(`${basePath}?c=${id}`);
  };

  //trigger hidden file input without router redirect

   const handleClipClick = (  ) => {
    fileInputRef.current?.click();
  };

  // Queues the file for the separate Documents page (unrelated hand-off, unchanged) and,
  // for this chat, uploads it immediately so it's ready to reference by the time the user
  // hits send — uploading only on send was leaving the send button attached to a promise
  // that hadn't started yet, so a file-only message just no-op'd instead of sending.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!selected) return;
    setFile(selected);
    setAttachedDoc(null);
    queueDocument(selected);
    uploadDocument.mutate(
      { file: selected, caseId: linkedCaseId ?? undefined },
      { onSuccess: (doc) => setAttachedDoc({ id: doc.id, name: doc.name, aiSummary: doc.aiSummary }) },
    );
  };

  const handleRemoveFile = () => {
    setFile(null);
    setAttachedDoc(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

  const doSend = async (text: string, documentContext?: string) => {
    if (!text || !session || isSending) return;

    // Identifies this send so it can tell, once it's back from an await, whether the
    // user has since navigated away (handleNewChat/handleSelectConversation bump the
    // counter) — an abandoned send must not write its chunks/errors/isSending into
    // whatever conversation is now on screen.
    const myToken = ++sendTokenRef.current;
    // The conversation this send belongs to, fixed at send time (before the id might
    // change under us, e.g. a brand-new conversation getting its real id).
    const turnKey = conversationKey;

    setIsSending(true);
    setPendingTurn({
      key: turnKey,
      messages: [...baseMessages, { role: "user", content: text }, { role: "assistant", content: "" }],
    });

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conversation = await createConversation.mutateAsync({ caseId });
        activeConversationId = conversation.id;
        // Re-key the pending turn to the real id so it keeps showing once the URL
        // (and thus `conversationKey`) catches up to it. Until that render lands,
        // `pendingUrlConversationId` covers the gap so the re-keyed turn keeps
        // matching `conversationKey` instead of going invisible for a beat.
        setPendingUrlConversationId(activeConversationId);
        setPendingTurn((prev) => (prev && prev.key === turnKey ? { ...prev, key: activeConversationId! } : prev));
        router.push(`${basePath}?c=${activeConversationId}`);
      }

      const { newSessionId } = await sendChatMessage({
        conversationId: activeConversationId,
        sessionId: session.session_id,
        message: text,
        documentContext,
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
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(activeConversationId) });
      queryClient.invalidateQueries({ queryKey: chatKeys.conversationsAll() });
      queryClient.invalidateQueries({ queryKey: chatKeys.relatedCases(activeConversationId) });
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
        setPendingUrlConversationId(null);
      }
    }
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputMessage.trim();
    // A file-only send (no typed text) used to silently no-op here — now it's allowed as
    // long as there's something to send, text or attachment.
    if (!text && !file) return;
    // Still mid-upload or it failed — block send rather than firing without the attachment
    // the user thinks they're sending (the button below is disabled for the same reason).
    if (file && !attachedDoc) return;
    const doc = attachedDoc;
    const messageText = text || t("input.defaultAttachmentMessage", { fileName: doc?.name ?? "" });
    const documentContext = doc ? `Attached document "${doc.name}":\n${doc.aiSummary ?? ""}` : undefined;
    setInputMessage("");
    handleRemoveFile();
    void doSend(messageText, documentContext);
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
        className="w-full backdrop-blur-md bg-card/80 p-3 rounded-3xl border border-border shadow-xl flex flex-col gap-2"
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
        />

        {file && (
          <div className="flex flex-col gap-1 px-2">
            <span className="flex items-center gap-1.5 max-w-full rounded-full bg-muted text-foreground text-[13px] font-['Inter'] pl-3 pr-1.5 py-1 w-fit">
              {uploadDocument.isPending ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
              ) : (
                <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <span className="truncate max-w-[220px]">{file.name}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-foreground/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    aria-label={t("input.removeFile", { fileName: file.name })}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("input.removeFile", { fileName: file.name })}</TooltipContent>
              </Tooltip>
            </span>
            {uploadDocument.isError && (
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
                disabled={isSending || !session || (!!file && !attachedDoc)}
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
      <ConversationSidebar
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        caseId={caseId}
        expanded={sidebarExpanded}
        onExpandedChange={setSidebarExpanded}
      />

      {/* Pinned directly under the navbar, spanning the full workspace width rather than
          the chat column's narrower max-w-5xl — a page-level strip (back link, case
          identity), not part of the centered conversation. Sits outside <main> so it isn't
          bound by that centering; ConversationSidebar is absolutely positioned so its own
          top-16 offset is unaffected by this sibling. */}
      {headerSlot && <div className="relative z-20 shrink-0 pt-16 pb-4">{headerSlot}</div>}

      {/* Main Chat Interface */}
      <main className={`relative z-10 max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0 ${headerSlot ? "" : "pt-16"}`}>
        {!conversationId && messages.length === 0 ? (
          /* No conversation yet — heading and input are centered together, like Gemini's landing state */
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
                  <CaseHubWidget caseId={linkedCaseId} conversationId={conversationId} onAskFollowUp={(text) => void doSend(text)} />
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
