"use client";
import { useEffect, useRef, useState } from "react";
import { Plus, History, Image as ImageIcon, PanelLeft, PanelLeftClose, X, Pencil, Trash2, Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useConsultationsQuery,
  useRenameConsultationMutation,
  useDeleteConsultationMutation,
} from "@/lib/chat/mutations";
import { useAuthStore } from "@/lib/store/auth.store";
import { MobileDrawer } from "@/components/mobile-drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface ConsultationSidebarProps {
  activeConsultationId: string | null;
  onSelectConsultation: (id: string) => void;
  onNewChat: () => void;
  /** Scopes the list to a single case's consultations instead of every consultation. */
  caseId?: string;
  /** Desktop rail expand state, lifted up so the page can reserve space for it (e.g. push
   * a header row over) instead of letting the expanded rail overlay content next to it. */
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Offset the rail from the global header. Terminal panes sit below their own chrome. */
  compact?: boolean;
  /** Mobile drawer open state, lifted up (same reason as `expanded`) so the page can render
   * its own trigger button inline with page content (e.g. next to the conversation title)
   * instead of this component's own floating circle being the only way to open it. */
  isMobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export default function ConsultationSidebar({
  activeConsultationId,
  onSelectConsultation,
  onNewChat,
  caseId,
  expanded,
  onExpandedChange,
  compact = false,
  isMobileOpen,
  onMobileOpenChange,
}: ConsultationSidebarProps) {
  const { t } = useTranslation("homepage");
  const { data: consultations } = useConsultationsQuery(caseId);
  const organization = useAuthStore((s) => s.organization);
  const renameConsultation = useRenameConsultationMutation();
  const deleteConsultation = useDeleteConsultationMutation();
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
    if (title) renameConsultation.mutate({ consultationId: id, title });
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("sidebar.deleteConsultationConfirm"))) return;
    deleteConsultation.mutate(id, {
      onSuccess: () => {
        if (id === activeConsultationId) onNewChat();
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

  // Close the mobile drawer if the viewport grows past lg (e.g. rotating a tablet) — matches
  // GlobalHeader's own mobile-drawer breakpoint, so both switch together instead of leaving
  // a tablet-portrait viewport with a mismatched half-mobile, half-desktop chrome.
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 1024) onMobileOpenChange(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileOpen, onMobileOpenChange]);

  const panelBody = (isMobile: boolean) => (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => {
              onNewChat();
              onExpandedChange(false);
              onMobileOpenChange(false);
            }}
            aria-label={t("sidebar.newChat")}
            className={`h-10 flex items-center gap-3 rounded-full border border-border hover:border-foreground shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
              expanded || isMobile ? "mx-2 px-3 mb-5" : "w-10 mx-auto justify-center px-0"
            }`}
          >
            <Plus className="h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden="true" />
            {(expanded || isMobile) && (
              <span className="text-[10px] font-['Inter'] font-semibold uppercase tracking-[1.2px] text-foreground">
                {t("sidebar.newConsultation", { defaultValue: "New consultation" })}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("sidebar.newChat")}</TooltipContent>
      </Tooltip>

      {/* "Recent" is a plain section label once the rail is expanded/on mobile — it's only
          ever a clickable icon in the collapsed desktop rail, where it doubles as a way to
          re-expand (matching the redesign's separate collapsed/expanded rail markup). */}
      {expanded || isMobile ? (
        <span className="px-3 pb-2 text-[10px] tracking-[1px] uppercase text-muted-foreground">{t("sidebar.recent")}</span>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onExpandedChange(true)}
              aria-label={t("sidebar.recentConsultationsTitle")}
              className="h-12 flex items-center justify-center gap-3 rounded-full hover:bg-muted shrink-0 mx-2 px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <History className="h-5 w-5 shrink-0 text-foreground" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("sidebar.recentConsultationsTitle")}</TooltipContent>
        </Tooltip>
      )}

      {(expanded || isMobile) && (
        <div className="relative flex-1 min-h-0 mt-2">
          <nav className="h-full overflow-y-auto px-2 pb-4 flex flex-col gap-1 scrollbar-none [-ms-overflow-style:none]">
            {consultations?.map((c) => {
              const isActive = c.id === activeConsultationId;
              const label = c.title?.trim() || t("sidebar.untitledConsultation");
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          // onMouseDown (not onClick) fires before the input's onBlur, so this commits
                          // the edit itself instead of racing the blur-triggered commit above.
                          onMouseDown={(e) => {
                            e.preventDefault();
                            commitEdit();
                          }}
                          aria-label={t("sidebar.saveTitle")}
                          className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("sidebar.saveTitle")}</TooltipContent>
                    </Tooltip>
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
                  {isActive && <span className="ml-3 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold" aria-hidden="true" />}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => {
                          onSelectConsultation(c.id);
                          onExpandedChange(false);
                          onMobileOpenChange(false);
                        }}
                        // Gemini-style pill: the consultation you're currently in gets its own
                        // rounded, bordered chip; a transparent border of the same width is kept
                        // on inactive rows so hovering doesn't shift layout by 1px.
                        className={`min-w-0 flex-1 text-left truncate py-2.5 text-[13px] font-['Inter'] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-full ${
                          isActive ? "pl-2.5 pr-1 text-foreground font-semibold" : "pl-7 pr-1 text-foreground/75 hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Open this consultation: {label}</TooltipContent>
                  </Tooltip>

                  {/* Revealed on hover/focus so the row stays clean the rest of the time;
                      always shown on mobile, where there's no hover state to reveal them. */}
                  <div
                    className={`flex items-center gap-0.5 pr-1.5 shrink-0 ${
                      isMobile ? "" : "opacity-0 group-hover/row:opacity-100 focus-within:opacity-100"
                    }`}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => startEditing(c.id, c.title?.trim() || "")}
                          aria-label={t("sidebar.renameConsultationNamed", { name: label })}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("sidebar.renameConsultation")}</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => handleDelete(c.id)}
                          disabled={deleteConsultation.isPending && deleteConsultation.variables === c.id}
                          aria-label={t("sidebar.deleteConsultationNamed", { name: label })}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-background hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50"
                        >
                          {deleteConsultation.isPending && deleteConsultation.variables === c.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("sidebar.deleteConsultation")}</TooltipContent>
                    </Tooltip>
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

      {(expanded || isMobile) && organization && (
        <div className="mt-auto shrink-0 border-t border-border px-3 pt-4 flex flex-col gap-1">
          <p className="text-[9px] font-semibold uppercase tracking-[0.05em] text-muted-foreground">
            {t("sidebar.organization", { defaultValue: "Organization" })}
          </p>
          <p className="truncate text-[13px] text-foreground">{organization.name}</p>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop/tablet rail — collapsed-to-expanded width toggle. Solid background (not a
          floating frosted-glass overlay) per the redesign, so it reserves layout width
          instead of sitting on top of whatever's underneath it. */}
      <aside
        ref={asideRef}
        className={`hidden lg:flex absolute left-0 bottom-0 bg-background border-r border-border flex-col py-4 z-(--z-sidebar) overflow-hidden transition-[width] duration-200 ${
          compact ? "top-0" : "top-16"
        } ${expanded ? "w-72" : "w-16"}`}
      >
        {/* One toggle, always in its own row above "New chat" — not floated over it — so
            open and close share a single, consistent, discoverable control instead of
            relying on re-clicking the Recent icon to close. Expanded state also carries the
            "Consultations" title, matching the redesign's header row. */}
        <div className={`flex items-center shrink-0 mb-3 ${expanded ? "justify-between px-3" : "justify-center px-0"}`}>
          {expanded && <span className="font-['Libre_Caslon_Text'] text-[18px] text-foreground">{t("sidebar.consultations")}</span>}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onExpandedChange(!expanded)}
                aria-label={expanded ? t("sidebar.collapseSidebar") : t("sidebar.openConsultations")}
                className="h-8 w-8 flex items-center justify-center shrink-0 rounded-full opacity-60 hover:opacity-100 hover:bg-card transition-[opacity,background-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {expanded ? (
                  <PanelLeftClose className="h-4 w-4 text-foreground" aria-hidden="true" />
                ) : (
                  <PanelLeft className="h-5 w-5 text-foreground" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>{expanded ? t("sidebar.collapseSidebar") : t("sidebar.openConsultations")}</TooltipContent>
          </Tooltip>
        </div>
        {panelBody(false)}
      </aside>

      {/* Mobile full-screen overlay drawer */}
      <MobileDrawer
        open={isMobileOpen}
        onClose={() => onMobileOpenChange(false)}
        closeLabel={t("sidebar.closeConsultations")}
        side="left"
      >
        <div className="flex items-center justify-between px-2 pb-2">
          <span className="pl-2 text-[13px] font-['Inter'] font-semibold text-foreground">{t("sidebar.consultations")}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onMobileOpenChange(false)}
                aria-label={t("sidebar.closeConsultations")}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("sidebar.closeConsultations")}</TooltipContent>
          </Tooltip>
        </div>
        {panelBody(true)}
      </MobileDrawer>
    </>
  );
}
