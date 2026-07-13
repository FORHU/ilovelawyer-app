"use client";
import { useEffect, useRef, useState } from "react";
import { useConversationsQuery } from "@/lib/chat/mutations";

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
}

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
}: ConversationSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: conversations } = useConversationsQuery();
  const asideRef = useRef<HTMLElement>(null);

  // Collapse on an outside click, without an overlay that would block scrolling elsewhere
  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded]);

  return (
    <aside
      ref={asideRef}
      className={`absolute left-0 top-16 bottom-0 bg-white/90 backdrop-blur-md border-r border-y border-white/40 rounded-r-[8px] shadow-lg flex flex-col py-4 z-40 overflow-hidden transition-[width] duration-200 ${
        expanded ? "w-72" : "w-16"
      }`}
    >
      <button
        onClick={() => {
          onNewChat();
          setExpanded(false);
        }}
        title="New chat"
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 ${
          expanded ? "" : "justify-center px-0"
        }`}
      >
        <span className="text-base">➕</span>
        {expanded && <span className="text-[13px] font-['Inter'] text-neutral-700">New chat</span>}
      </button>

      <button
        onClick={() => setExpanded((v) => !v)}
        title="Recent conversations"
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 mt-1 ${
          expanded ? "" : "justify-center px-0"
        }`}
      >
        <span className="text-base">⏳</span>
        {expanded && <span className="text-[13px] font-['Inter'] text-neutral-700">Recent</span>}
      </button>

      {expanded && (
        <div className="relative flex-1 min-h-0 mt-2">
          <nav className="h-full overflow-y-auto px-2 pb-4 flex flex-col gap-1 scrollbar-none [-ms-overflow-style:none]">
            {conversations?.map((c) => {
              const isActive = c.id === activeConversationId;
              const label = c.title?.trim() || "Untitled conversation";
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    setExpanded(false);
                  }}
                  title={label}
                  // Gemini-style pill: the conversation you're currently in gets its own
                  // rounded, bordered chip; a transparent border of the same width is kept
                  // on inactive rows so hovering doesn't shift layout by 1px.
                  className={`text-left truncate px-4 py-2.5 text-[13px] font-['Inter'] font-medium rounded-full border transition-colors shrink-0 ${
                    isActive
                      ? "bg-slate-100 border-slate-300 text-[#0b132b] font-semibold"
                      : "border-transparent text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>
          {/* Fades the last row into the sidebar background instead of a hard cut, and
              signals there's more to scroll to when the list overflows this panel. */}
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-linear-to-t from-white/95 to-transparent" />
        </div>
      )}

      <button
        title="Gallery"
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 mt-auto ${
          expanded ? "" : "justify-center px-0"
        }`}
      >
        <span className="text-base">🖼️</span>
        {expanded && <span className="text-[13px] font-['Inter'] text-neutral-700">Gallery</span>}
      </button>
    </aside>
  );
}
