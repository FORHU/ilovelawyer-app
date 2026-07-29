"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
// 1. Added Paperclip and Mic to your lucide-react imports
import { Paperclip, Mic, Square, X, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
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
import { chatKeys } from "@/lib/query-keys";
import { useMediaQueueStore } from "@/lib/store/media-queue.store";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TEXTAREA_HEIGHT = 200;

export default function AiConsultationPage() {
  const { t } = useTranslation("homepage");
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queueDocument = useMediaQueueStore((s) => s.queueDocument);
  const queueTranscript = useMediaQueueStore((s) => s.queueTranscript);

  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const queryClient = useQueryClient();

  // The URL is the source of truth for which conversation is active, so refresh,
  // back/forward, and sidebar navigation all just work without a duplicate state sync.
  const conversationId = urlConversationId;

  // Explicit case linkage for this conversation, if any (e.g. arrived via a case's
  // "Start Chat" quick action carrying ?caseId=). CaseHubWidget falls back to the
  // user's most recently active case when this is null, so no manual picking is needed.
  const { data: conversations } = useConversationsQuery();
  const pendingCaseId = searchParams.get("caseId") ?? "";
  const linkedCaseId = conversationId
    ? (conversations?.find((c) => c.id === conversationId)?.caseId ?? null)
    : pendingCaseId || null;

  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  // True from the moment New Chat / Select Conversation fires until `conversationId`
  // (derived from searchParams) reflects the router.push — that update lands one render
  // tick late, and without this guard the hydrate effect below would fire against the
  // *previous* conversation's still-cached history in that gap, undoing the messages
  // we just cleared (surfacing as "click New Chat twice before it takes").
  const [isNavigatingConversation, setIsNavigatingConversation] = useState(false);
  // Bumped on every send and on every explicit navigation away from the conversation a
  // send belongs to, so a stale in-flight stream can recognize it's been abandoned and
  // stop writing chunks/isSending into whatever conversation is now on screen.
  const sendTokenRef = useRef(0);
  // Set right before router.push in handleSendMessage, when a send creates a brand-new
  // conversation. The URL update that follows changes `conversationId` the same way a
  // sidebar click or back/forward would — this lets the render-phase block below tell
  // "the send I'm already streaming just claimed this id" apart from an actual navigation
  // away, so it doesn't wipe the messages/token that send is still writing to.
  const pendingSendConversationIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = useChatSessionQuery();
  const createConversation = useCreateConversationMutation();
  const { data: history } = useMessagesQuery(conversationId ?? undefined);

  // conversationId can change three ways: handleNewChat/handleSelectConversation (which clear
  // `messages` synchronously up front, then router.push resolves a tick later), browser
  // back/forward (a popstate that changes the URL directly, bypassing those handlers entirely),
  // or a send that just created a brand-new conversation claiming this id (pendingSendConversationIdRef).
  // This block is the single place that reacts to the *actual* conversationId change, so it
  // covers all three — adjusting state during render (React's documented pattern for this) rather
  // than in an effect, so it resolves in the same render conversationId changes in. Only the first
  // two mean "we left this conversation, abandon whatever it was doing"; the third means the
  // in-flight send we're already streaming just made the URL catch up to it, so it must not be
  // treated as an abandonment (that would wipe the very messages/token that send is writing to).
  const [prevConversationId, setPrevConversationId] = useState(conversationId);
  if (conversationId !== prevConversationId) {
    setPrevConversationId(conversationId);
    setIsNavigatingConversation(false);
    if (conversationId !== pendingSendConversationIdRef.current) {
      setMessages([]);
      setIsSending(false);
      sendTokenRef.current++; // abandon any in-flight send for the conversation we're leaving
    }
    pendingSendConversationIdRef.current = null;
  }

  // Hydrate from the conversation's saved history once, the first time we land on it.
  // Navigation handlers clear `messages` synchronously before switching conversations,
  // so this never fires again for the same conversation (and never clobbers an
  // in-flight streaming reply, since `messages` is non-empty by then). Skipped entirely
  // while `isNavigatingConversation`, otherwise it would fire against the *previous*
  // conversation's still-cached history before `conversationId` catches up to the nav.
  useEffect(() => {
    if (isNavigatingConversation) return;
    if (!conversationId || !history || messages.length > 0) return;
    setMessages(
      history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    );
  }, [conversationId, history, messages.length, isNavigatingConversation]);

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
    setIsNavigatingConversation(true);
    setMessages([]);
    setIsSending(false);
    router.push("/homepage");
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return;
    sendTokenRef.current++;
    setIsNavigatingConversation(true);
    setMessages([]);
    setIsSending(false);
    router.push(`/homepage?c=${id}`);
  };

  //trigger hidden file input without router redirect

   const handleClipClick = (  ) => {
    fileInputRef.current?.click();
  };

  //handles state preservation when user picks a file, and queues it for the Documents page
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.currentTarget.files?.[0];
    if (selected) {
      setFile(selected);
      queueDocument(selected);
    }
  };

    const handleRemoveFile = () => {
      setFile(null);
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

  const doSend = async (text: string) => {
    if (!text || !session || isSending) return;

    // Identifies this send so it can tell, once it's back from an await, whether the
    // user has since navigated away (handleNewChat/handleSelectConversation bump the
    // counter) — an abandoned send must not write its chunks/errors/isSending into
    // whatever conversation is now on screen.
    const myToken = ++sendTokenRef.current;

    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsSending(true);

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conversation = await createConversation.mutateAsync({ caseId: pendingCaseId || undefined });
        activeConversationId = conversation.id;
        pendingSendConversationIdRef.current = conversation.id;
        router.push(`/homepage?c=${conversation.id}`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await sendChatMessage({
        conversationId: activeConversationId,
        sessionId: session.session_id,
        message: text,
        onChunk: (chunk) => {
          if (sendTokenRef.current !== myToken) return;
          setMessages((prev) => {
            const lastIndex = prev.length - 1;
            const last = prev[lastIndex];
            if (!last) return prev;
            const next = [...prev];
            next[lastIndex] = { role: last.role, content: last.content + chunk };
            return next;
          });
        },
      });

      // Backend may have generated a title (or this is the first exchange) — refresh the sidebar list
      queryClient.invalidateQueries({ queryKey: chatKeys.conversations() });
    } catch (error) {
      console.error("Failed to send message:", error);
      if (sendTokenRef.current === myToken) {
        setMessages((prev) => [...prev, { role: "assistant", content: t("sendError") }]);
      }
    } finally {
      if (sendTokenRef.current === myToken) setIsSending(false);
    }
  };

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text) return;
    setInputMessage("");
    handleRemoveFile();
    void doSend(text);
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
          <div className="flex items-center gap-2 px-2">
            <span className="flex items-center gap-1.5 max-w-full rounded-full bg-muted text-foreground text-[13px] font-['Inter'] pl-3 pr-1.5 py-1">
              <span className="truncate max-w-[220px]">{file.name}</span>
              <button
                type="button"
                onClick={handleRemoveFile}
                className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-foreground/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Remove attached file"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
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

        {file && (
          <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground">
            <Paperclip className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{file.name}</span>
            <button
              type="button"
              onClick={handleRemoveFile}
              className="text-muted-foreground hover:text-red-600 dark:hover:text-red-400 shrink-0"
              aria-label={t("input.removeFile", { fileName: file.name })}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Toolbar row below the text, matching Gemini's layout */}
        <div className="flex items-center justify-between px-1">
          {/* 2. Replaced the emoji text nodes with <Paperclip /> and <Mic /> components */}
          <div className="flex gap-1 text-muted-foreground">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={handleClipClick}
              aria-label={t("input.attachFile")}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted hover:text-foreground shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <Paperclip className="w-4 h-4" />
            </button>
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
          </div>

          <button
            type="submit"
            disabled={isSending || !session}
            aria-label={t("input.sendMessage")}
            className="bg-brand-navy-950 text-white w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:bg-[#162244] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-950/40 focus-visible:ring-offset-2 disabled:opacity-50 shrink-0"
          >
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-background text-foreground overflow-hidden">
      <GlobalHeader activeTab="consultation" />

      {/* Chat Workspace */}
      <div className="relative flex-1 flex flex-col min-h-0 px-4 sm:px-8 md:px-32">

        {/* Left Sidebar Panel */}
        <ConversationSidebar
          activeConversationId={conversationId}
          onSelectConversation={handleSelectConversation}
          onNewChat={handleNewChat}
        />

        {/* Main Chat Interface */}
        <main className="relative z-10 max-w-5xl w-full mx-auto flex flex-col flex-1 min-h-0 pt-16">
          {!conversationId && messages.length === 0 ? (
            /* No conversation yet — heading and input are centered together, like Gemini's landing state */
            <div className="flex-1 flex flex-col items-center justify-center gap-8 min-h-0 pb-24">
              <div className="text-center max-w-2xl mx-auto px-2">
                <h1 className="font-['Libre_Caslon_Text'] font-normal text-primary text-[32px] sm:text-[40px] md:text-[48px] tracking-[-1.2px] mb-4">
                  {t("emptyState.heading")}
                </h1>
                <p className="font-['Inter'] text-foreground text-[15px] md:text-[16px] leading-6">
                  {t("emptyState.subheading")}
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
                    const isStreamingThis = isSending && i === messages.length - 1;

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
                    <CaseHubWidget caseId={linkedCaseId} onAskFollowUp={(text) => void doSend(text)} />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </div>
              <div className="pt-4 pb-6">{chatInputBar}</div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}