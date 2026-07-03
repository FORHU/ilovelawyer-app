"use client";
import React, { useState } from "react";
import { GlobalHeader } from "@/components/global-header";
import { useChatSessionQuery, useCreateConversationMutation, sendChatMessage } from "@/lib/chat/mutations";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
}

export default function AiConsultationPage() {
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);

  const { data: session } = useChatSessionQuery();
  const createConversation = useCreateConversationMutation();

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
        const conversation = await createConversation.mutateAsync({ title: text.slice(0, 60) });
        activeConversationId = conversation.id;
        setConversationId(conversation.id);
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
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => [...prev, { role: "assistant", content: "Something went wrong. Please try again." }]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50">
      <GlobalHeader activeTab="consultation" />

      {/* Chat Workspace */}
      <div className="relative flex-1 flex flex-col justify-between pb-32 px-8 md:px-32">
        {/* Background Layer */}
        <div className="absolute inset-0 bg-linear-to-b from-[#eef2f7] to-[#dbe1ff] pointer-events-none z-0" />

        {/* Left Sidebar Panel */}
        <aside className="absolute left-0 top-0 w-16 bg-white/80 backdrop-blur-md border-r border-y border-white/40 rounded-r-[8px] shadow-lg flex flex-col items-center py-4 z-40">
          <button className="h-12 w-full flex items-center justify-center hover:bg-slate-100" title="New Chat">➕</button>
          <button className="h-12 w-full flex items-center justify-center hover:bg-slate-100" title="History">⏳</button>
          <button className="h-12 w-full flex items-center justify-center hover:bg-slate-100" title="Gallery">🖼️</button>
        </aside>

        {/* Main Chat Interface */}
        <main className="relative z-10 max-w-5xl w-full mx-auto flex flex-col items-center justify-center flex-1 pt-16">
          {messages.length === 0 ? (
            <div className="text-center mb-12 max-w-2xl">
              <h1 className="font-['Libre_Caslon_Text'] font-normal text-[#0b132b] text-[48px] tracking-[-1.2px] mb-4">
                Expert Legal Consultation
              </h1>
              <p className="font-['Inter'] text-[#181c1e] text-[16px] leading-6">
                Secure, AI-powered legal analysis and case drafting for the modern practitioner.
              </p>
            </div>
          ) : (
            <div className="w-full max-w-3xl flex-1 overflow-y-auto flex flex-col gap-4 mb-8 px-2">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-[15px] leading-6 font-['Inter'] ${
                    m.role === "user"
                      ? "self-end bg-[#0b132b] text-white"
                      : "self-start bg-white/80 backdrop-blur-md border border-white/40 text-[#181c1e]"
                  }`}
                >
                  {m.content || "…"}
                </div>
              ))}
            </div>
          )}

          {/* Interactive Glassmorphic Chat Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="w-full max-w-3xl backdrop-blur-md bg-white/80 p-4 rounded-full border border-white/40 shadow-xl flex items-center gap-4"
          >
            {/* Action buttons (Attach/Voice) */}
            <div className="flex gap-2">
              <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200/50">📎</button>
              <button type="button" className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200/50">🎙️</button>
            </div>

            {/* Actual Active Input field instead of a static div */}
            <input
              type="text"
              className="flex-1 bg-transparent border-none outline-none font-['Inter'] text-[18px] text-[#181c1e] placeholder-gray-400 px-1"
              placeholder="Draft your legal inquiry or case particulars here..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              disabled={isSending}
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSending || !session}
              className="bg-[#0b132b] text-white w-12 h-12 rounded-full flex items-center justify-center shadow-md hover:bg-[#162244] transition-colors disabled:opacity-50"
            >
              ➔
            </button>
          </form>
        </main>
      </div>
    </div>
  );
}