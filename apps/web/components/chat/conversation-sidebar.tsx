"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, History, Image as ImageIcon, PanelLeft, PanelLeftClose, X, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useConversationsQuery,
  useRenameConversationMutation,
  useDeleteConversationMutation,
} from "@/lib/chat/mutations";

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  /** Scopes the list to a single case's conversations instead of every conversation. */
  caseId?: string;
  /** Desktop rail expand state, lifted up so the page can reserve space for it (e.g. push
   * a header row over) instead of letting the expanded rail overlay content next to it. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export default function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  onNewChat,
  caseId,
  expanded,
  onExpandedChange,
}: ConversationSidebarProps) {
  const { t } = useTranslation("homepage");
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { data: conversations } = useConversationsQuery(caseId);
  const renameConversation = useRenameConversationMutation();
  const deleteConversation = useDeleteConversationMutation();
  const asideRef = useRef<HTMLElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) editInputRef.current?.focus();
  }, [editingId]);

  const startEditing = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditValue(currentTitle);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const title = editValue.trim();
    const id = editingId;
    setEditingId(null);
    if (title) renameConversation.mutate({ conversationId: id, title });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("sidebar.deleteConversationConfirm"))) return;
    deleteConversation.mutate(id, {
      onSuccess: () => {
        if (id === activeConversationId) onNewChat();
      },
    });
  };

  // Collapse on an outside click, without an overlay that would block scrolling elsewhere.
  // Skipped on mobile, where the drawer already has its own dedicated overlay + close button.
  useEffect(() => {
    if (!expanded || isMobileOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (asideRef.current && !asideRef.current.contains(e.target as Node)) {
        onExpandedChange(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [expanded, isMobileOpen, onExpandedChange]);

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
          onExpandedChange(false);
          setIsMobileOpen(false);
        }}
        title={t("sidebar.newChat")}
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-muted shrink-0 mx-2 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          expanded || isMobile ? "" : "justify-center px-0"
        }`}
      >
        <Plus className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
        {(expanded || isMobile) && <span className="text-[13px] font-['Inter'] text-foreground">{t("sidebar.newChat")}</span>}
      </button>

      <button
        onClick={() => !isMobile && onExpandedChange(!expanded)}
        title={t("sidebar.recentConversationsTitle")}
        className={`h-12 flex items-center gap-3 rounded-full hover:bg-muted shrink-0 mx-2 px-3 mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          expanded || isMobile ? "" : "justify-center px-0"
        }`}
      >
        <History className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
        {(expanded || isMobile) && <span className="text-[13px] font-['Inter'] text-foreground">{t("sidebar.recent")}</span>}
      </button>

      {(expanded || isMobile) && (
        <div className="relative flex-1 min-h-0 mt-2">
          <nav className="h-full overflow-y-auto px-2 pb-4 flex flex-col gap-1 scrollbar-none [-ms-overflow-style:none]">
            {conversations?.map((c) => {
              const isActive = c.id === activeConversationId;
              const label = c.title?.trim() || t("sidebar.untitledConversation");
              const isEditing = editingId === c.id;

              if (isEditing) {
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full border border-border bg-muted shrink-0"
                  >
                    <input
                      ref={editInputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      onBlur={commitEdit}
                      className="min-w-0 flex-1 truncate bg-transparent px-2 py-1.5 text-[13px] font-['Inter'] font-medium text-foreground outline-none"
                    />
                    <button
                      type="button"
                      // onMouseDown (not onClick) fires before the input's onBlur, so this commits
                      // the edit itself instead of racing the blur-triggered commit above.
                      onMouseDown={(e) => {
                        e.preventDefault();
                        commitEdit();
                      }}
                      title={t("sidebar.saveTitle")}
                      aria-label={t("sidebar.saveTitle")}
                      className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={c.id}
                  className={`group/row relative flex items-center rounded-full border transition-colors shrink-0 ${
                    isActive ? "bg-muted border-border" : "border-transparent hover:bg-muted"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectConversation(c.id);
                      onExpandedChange(false);
                      setIsMobileOpen(false);
                    }}
                    title={label}
                    // Gemini-style pill: the conversation you're currently in gets its own
                    // rounded, bordered chip; a transparent border of the same width is kept
                    // on inactive rows so hovering doesn't shift layout by 1px.
                    className={`min-w-0 flex-1 text-left truncate pl-4 pr-1 py-2.5 text-[13px] font-['Inter'] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full ${
                      isActive ? "text-primary font-semibold" : "text-foreground"
                    }`}
                  >
                    {label}
                  </button>

                  {/* Revealed on hover/focus so the row stays clean the rest of the time;
                      always shown on mobile, where there's no hover state to reveal them. */}
                  <div
                    className={`flex items-center gap-0.5 pr-1.5 shrink-0 ${
                      isMobile ? "" : "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => startEditing(c.id, c.title?.trim() || "")}
                      title={t("sidebar.renameConversation")}
                      aria-label={t("sidebar.renameConversationNamed", { name: label })}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(c.id)}
                      disabled={deleteConversation.isPending && deleteConversation.variables === c.id}
                      title={t("sidebar.deleteConversation")}
                      aria-label={t("sidebar.deleteConversationNamed", { name: label })}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50"
                    >
                      {deleteConversation.isPending && deleteConversation.variables === c.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </nav>
          {/* Fades the last row into the sidebar background instead of a hard cut, and
              signals there's more to scroll to when the list overflows this panel. */}
          <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-linear-to-t from-card/95 to-transparent" />
        </div>
      )}

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
        className="md:hidden absolute left-2 top-[72px] z-40 flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <PanelLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Desktop/tablet rail — collapsed-to-expanded width toggle, unchanged from before */}
      <aside
        ref={asideRef}
        className={`hidden md:flex absolute left-0 top-16 bottom-0 bg-card/90 backdrop-blur-md border-r border-y border-border rounded-r-[8px] shadow-lg flex-col py-4 z-40 overflow-hidden transition-[width] duration-200 ${
          expanded ? "w-72" : "w-16"
        }`}
      >
        {/* One toggle, always in its own row above "New chat" — not floated over it — so
            open and close share a single, consistent, discoverable control instead of
            relying on re-clicking the Recent icon to close. */}
        <button
          type="button"
          onClick={() => onExpandedChange(!expanded)}
          title={expanded ? t("sidebar.collapseSidebar") : t("sidebar.openConversations")}
          aria-label={expanded ? t("sidebar.collapseSidebar") : t("sidebar.openConversations")}
          className={`h-10 flex items-center shrink-0 rounded-full hover:bg-muted mx-2 mb-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
            expanded ? "justify-end px-3" : "justify-center px-0"
          }`}
        >
          {expanded ? (
            <PanelLeftClose className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <PanelLeft className="h-5 w-5 text-foreground" aria-hidden="true" />
          )}
        </button>
        {panelBody(false)}
      </aside>

      {/* Mobile full-screen overlay drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileOpen(false)} aria-hidden="true" />
          <div className="relative flex h-full w-[85vw] max-w-80 flex-col bg-card py-4 shadow-xl">
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="pl-2 text-[13px] font-['Inter'] font-semibold text-foreground">{t("sidebar.conversations")}</span>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label={t("sidebar.closeConversations")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
