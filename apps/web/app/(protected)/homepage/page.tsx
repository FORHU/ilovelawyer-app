"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import GlobalHeader from "@/components/global-header";
import AssistantMessage from "@/components/chat/assistant-message";
import ConversationSidebar from "@/components/chat/conversation-sidebar";
import {
  useChatSessionQuery,
  useCreateConversationMutation,
  useMessagesQuery,
  sendChatMessage,
} from "@/lib/chat/mutations";
import { chatKeys } from "@/lib/query-keys";
interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

const MAX_TEXTAREA_HEIGHT = 200;

export default function AiConsultationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlConversationId = searchParams.get("c");
  const queryClient = useQueryClient();

  // The URL is the source of truth for which conversation is active, so refresh,
  // back/forward, and sidebar navigation all just work without a duplicate state sync.
  const conversationId = urlConversationId;

  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: session } = useChatSessionQuery();
  const createConversation = useCreateConversationMutation();
  const { data: history } = useMessagesQuery(conversationId ?? undefined);

  // Hydrate from the conversation's saved history once, the first time we land on it.
  // Navigation handlers clear `messages` synchronously before switching conversations,
  // so this never fires again for the same conversation (and never clobbers an
  // in-flight streaming reply, since `messages` is non-empty by then).
  useEffect(() => {
    if (!conversationId || !history || messages.length > 0) return;
    setMessages(
      history
        .filter((m) => m.role !== "system")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    );
  }, [conversationId, history, messages.length]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [inputMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewChat = () => {
    setMessages([]);
    router.push("/homepage");
  };

  const handleSelectConversation = (id: string) => {
    if (id === conversationId) return;
    setMessages([]);
    router.push(`/homepage?c=${id}`);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = inputMessage.trim();
    if (!text || !session || isSending) return;

    setInputMessage("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setIsSending(true);

    try {
      let activeConversationId = conversationId;
      if (!activeConversationId) {
        const conversation = await createConversation.mutateAsync({});
        activeConversationId = conversation.id;
        router.push(`/homepage?c=${conversation.id}`);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      await sendChatMessage({
        conversationId: activeConversationId,
        sessionId: session.session_id,
        message: text,
        onChunk: (chunk) => {
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
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setIsSending(false);
    }
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
        className="w-full backdrop-blur-md bg-white/80 p-3 rounded-3xl border border-white/40 shadow-xl flex flex-col gap-2"
      >
        {/* Auto-growing textarea so multi-line input actually wraps, like Gemini's input */}
        <textarea
          ref={textareaRef}
          rows={1}
          className="w-full shrink-0 resize-none bg-transparent border-none outline-none font-['Inter'] text-[15px] text-[#181c1e] placeholder-gray-400 px-2 py-1 leading-6 max-h-50 overflow-y-auto scrollbar-none [-ms-overflow-style:none]"
          placeholder="Draft your legal inquiry or case particulars here..."
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSending}
        />

        {/* Toolbar row below the text, matching Gemini's layout */}
        <div className="flex items-center justify-between px-1">
          <div className="flex gap-1">
            <button type="button" className="w-8 h-8 flex items-center justify-center text-base rounded-full hover:bg-slate-200/50 shrink-0">📎</button>
            <button type="button" className="w-8 h-8 flex items-center justify-center text-base rounded-full hover:bg-slate-200/50 shrink-0">🎙️</button>
          </div>

          <button
            type="submit"
            disabled={isSending || !session}
            className="bg-[#0b132b] text-white w-9 h-9 rounded-full flex items-center justify-center shadow-md hover:bg-[#162244] transition-colors disabled:opacity-50 shrink-0"
          >
            ➔
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="h-screen w-full flex flex-col bg-white overflow-hidden">
      <GlobalHeader activeTab="consultation" />

      {/* Chat Workspace */}
      <div className="relative flex-1 flex flex-col min-h-0 px-8 md:px-32">

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
              <div className="text-center max-w-2xl mx-auto">
                <h1 className="font-['Libre_Caslon_Text'] font-normal text-[#0b132b] text-[48px] tracking-[-1.2px] mb-4">
                  Expert Legal Consultation
                </h1>
                <p className="font-['Inter'] text-[#181c1e] text-[16px] leading-6">
                  Secure, AI-powered legal analysis and case drafting for the modern practitioner.
                </p>
              </div>
              {chatInputBar}
            </div>
          ) : (
            <>
              {/* Scrollable message pane — input bar below stays put regardless of scroll position */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none [-ms-overflow-style:none]">
                <div className="w-full max-w-3xl mx-auto flex flex-col gap-4 px-2 py-4">
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div
                        key={i}
                        className="max-w-[80%] self-end rounded-2xl border border-gray-300 bg-neutral-100 px-4 py-3 text-[15px] leading-6 font-['Inter'] whitespace-pre-wrap text-neutral-900"
                      >
                        {m.content}
                      </div>
                    ) : (
                      <div key={i} className="w-full rounded-2xl px-4 py-3">
                        <AssistantMessage content={m.content || "…"} />
                      </div>
                    ),
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