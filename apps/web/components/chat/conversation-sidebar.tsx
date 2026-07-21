"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, History, Image as ImageIcon, PanelLeft, X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("homepage");
  const [expanded, setExpanded] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { data: conversations } = useConversationsQuery();
  const asideRef = useRef<HTMLElement>(null);

  // Collapse on an outside click, without an overlay that would block scrolling elsewhere.
  // Skipped on mobile, where the drawer already has its own dedicated overlay + close button.
  useEffect(() => {
    if (!expanded || isMobileOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded, isMobileOpen]);

  // Close the mobile drawer if the viewport grows past md (e.g. rotating a tablet).
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileOpen]);

  const panelBody = (isMobile: boolean) => (
    <>
      <button
        onClick={() => {
          onNewChat();
          setExpanded(false);
          setIsMobileOpen(false);
        }}
        title={t("sidebar.newChat")}
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 ${
          expanded || isMobile ? "" : "justify-center px-0"
        }`}
      >
        <Plus className="h-5 w-5 shrink-0 text-neutral-700" aria-hidden="true" />
        {(expanded || isMobile) && <span className="text-[13px] font-['Inter'] text-neutral-700">{t("sidebar.newChat")}</span>}
      </button>

      <button
        onClick={() => !isMobile && setExpanded((v) => !v)}
        title={t("sidebar.recentConversationsTitle")}
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 ${
          expanded || isMobile ? "" : "justify-center px-0"
        }`}
      >
        <History className="h-5 w-5 shrink-0 text-neutral-700" aria-hidden="true" />
        {(expanded || isMobile) && <span className="text-[13px] font-['Inter'] text-neutral-700">{t("sidebar.recent")}</span>}
      </button>

      {(expanded || isMobile) && (
        <div className="relative flex-1 min-h-0 mt-2">
          <nav className="h-full overflow-y-auto px-2 pb-4 flex flex-col gap-1 scrollbar-none [-ms-overflow-style:none]">
            {conversations?.map((c) => {
              const isActive = c.id === activeConversationId;
              const label = c.title?.trim() || t("sidebar.untitledConversation");
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    onSelectConversation(c.id);
                    setExpanded(false);
                    setIsMobileOpen(false);
                  }}
                  title={label}
                  // Gemini-style pill: the conversation you're currently in gets its own
                  // rounded, bordered chip; a transparent border of the same width is kept
                  // on inactive rows so hovering doesn't shift layout by 1px.
                  className={`text-left truncate px-4 py-2.5 text-[13px] font-['Inter'] font-medium rounded-full border transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 ${
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
        type="button"
        title={t("sidebar.gallery")}
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-slate-100 shrink-0 mx-2 px-3 mt-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30 ${
          expanded || isMobile ? "" : "justify-center px-0"
        }`}
      >
        <ImageIcon className="h-5 w-5 shrink-0 text-neutral-700" aria-hidden="true" />
        {(expanded || isMobile) && <span className="text-[13px] font-['Inter'] text-neutral-700">{t("sidebar.gallery")}</span>}
      </button>
    </>
  );

  return (
    <>
      {/* Menu button that opens the mobile drawer — the collapsed w-16 rail below is
          sized for desktop and has no comfortable place to sit on a ~375px screen. */}
      <button
        type="button"
        onClick={() => setIsMobileOpen(true)}
        title={t("sidebar.openConversations")}
        aria-label={t("sidebar.openConversations")}
        className="md:hidden absolute left-2 top-[72px] z-40 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 backdrop-blur-md border border-white/40 shadow-lg text-neutral-700 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/40"
      >
        <PanelLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Desktop/tablet rail — collapsed-to-expanded width toggle, unchanged from before */}
      <aside
        ref={asideRef}
        className={`hidden md:flex absolute left-0 top-16 bottom-0 bg-white/90 backdrop-blur-md border-r border-y border-white/40 rounded-r-[8px] shadow-lg flex-col py-4 z-40 overflow-hidden transition-[width] duration-200 ${
          expanded ? "w-72" : "w-16"
        }`}
      >
        {panelBody(false)}
      </aside>

      {/* Mobile full-screen overlay drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[85vw] max-w-80 flex-col bg-white py-4 shadow-xl">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="pl-2 text-[13px] font-['Inter'] font-semibold text-neutral-700">{t("sidebar.conversations")}</span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label={t("sidebar.closeConversations")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {panelBody(true)}
          </div>
        </div>
      )}
    </>
  );
}
