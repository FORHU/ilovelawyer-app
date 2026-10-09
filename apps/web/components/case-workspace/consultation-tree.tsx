"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Archive, ChevronDown, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCanContributeToCase } from "@/lib/cases/permissions";
import { TopicNavigatorList, TopicNavigatorLoading } from "@/components/chat/topic-navigator";
import { useArchiveConsultation } from "@/components/chat/archived-consultations";
import { useConsultationsQuery, useMessagesQuery, type Consultation } from "@/lib/chat/mutations";
import { DRAFT_CONSULTATION_PARAM } from "@/lib/chat/consultation-param";
import { buildTopicGroups, promptNumberAt, visibleChatMessages } from "@/lib/chat/use-topic-navigator";
import { formatRelativeTime } from "@/lib/notifications/format";
import { useAuthStore } from "@/lib/store/auth.store";
import { useConsultationDraft, useConsultationDraftsStore } from "@/lib/store/consultation-drafts.store";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface ConsultationTreeProps {
  caseId: string;
  activeConsultationId: string | null;
  isDraftActive: boolean;
  /** Opens a consultation (an id, DRAFT_CONSULTATION_PARAM, or null for no selection) —
   * `promptNumber` lands it on that prompt (`?p=`) instead of the latest reply. */
  onSelect: (param: string | null, promptNumber?: number) => void;
  /** What the OPEN consultation shows when expanded — SourcesPanel's own Topics body, with its
   * scroll-spy, per-prompt decisions and related cases, all wired to the chat on screen. */
  activeBody: ReactNode;
}

/** Case Workspace's Consultations list: every Consultation on the Case (shared with everyone on
 * it), each expanding to its OWN Topics — the open one with the full live Topics panel, any other
 * with a read-only preview built from its own messages, where clicking a topic opens that
 * consultation at that prompt. Topics never mix: each node only ever reads its own consultation's
 * messages. The Case's unsaved draft (`?c=new`) is pinned on top; the archive is a button pinned
 * under the panel (ArchivedConsultationsButton, rendered by SourcesPanel). */
export function ConsultationTree({ caseId, activeConsultationId, isDraftActive, onSelect, activeBody }: ConsultationTreeProps) {
  const { t } = useTranslation("homepage");
  const { data: consultations } = useConsultationsQuery(caseId);
  const { draft } = useConsultationDraft(caseId);
  const clearDraft = useConsultationDraftsStore((s) => s.clearDraft);
  const myUserId = useAuthStore((s) => s.user?.id);
  const sendingIds = useSendingConsultationsStore((s) => s.sendingConsultationIds);
  const { requestArchive, archiveDialog } = useArchiveConsultation();
  // Read-only for a view-only person on a confidential case: no archiving, their own included.
  const readOnly = !useCanContributeToCase(caseId);

  // Every consultation starts collapsed — the open one included — and only expands when the user
  // expands it; the chat on screen is already its full conversation, so its Topics stay out of the
  // way until asked for. Expanded ones only last until the next switch: opening a consultation
  // collapses everything again, so nothing peeked at by hand stays open (or keeps its message
  // history loaded) past it. Reset during render, so not even one frame shows the previous
  // selection's expansions.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const draftKey = DRAFT_CONSULTATION_PARAM;
  const openKey = isDraftActive ? draftKey : activeConsultationId;
  const [expandedFor, setExpandedFor] = useState(openKey);
  if (expandedFor !== openKey) {
    setExpandedFor(openKey);
    setExpanded(new Set());
  }
  const isOpen = (key: string) => expanded.has(key);
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  // Moves off whatever is about to disappear: the next most recent Consultation, else nothing.
  const selectNextAfter = (removedId: string | null) =>
    onSelect(consultations?.find((c) => c.id !== removedId)?.id ?? null);

  const handleDiscardDraft = () => {
    clearDraft(caseId);
    if (isDraftActive) selectNextAfter(null);
  };

  const handleArchive = (consultation: Consultation) =>
    requestArchive(consultation.id, titleOf(consultation), {
      onArchived: () => {
        if (consultation.id === activeConsultationId) selectNextAfter(consultation.id);
      },
    });

  const titleOf = (c: Consultation) => c.title?.trim() || t("sidebar.untitledConsultation");
  const metaOf = (c: Consultation) => {
    const creator = c.userId === myUserId ? t("sidebar.you") : c.createdBy?.name?.trim() || c.createdBy?.username || null;
    const when = formatRelativeTime(c.lastMessageAt ?? c.createdAt);
    return creator ? `${creator} · ${when}` : when;
  };

  return (
    <div className="space-y-1">
      {draft && (
        <ConsultationNode
          title={draft.title.trim() || t("sidebar.newConsultation")}
          meta={t("sidebar.draft")}
          active={isDraftActive}
          open={isOpen(draftKey)}
          onToggle={() => toggle(draftKey)}
          onSelect={() => onSelect(DRAFT_CONSULTATION_PARAM)}
          action={{ icon: X, label: t("sidebar.discardDraft"), onClick: handleDiscardDraft }}
        >
          {isDraftActive ? activeBody : <EmptyTopics />}
        </ConsultationNode>
      )}

      {consultations === undefined ? (
        <p className="px-2 py-2 text-[12px] text-muted-foreground">{t("sidebar.loadingConsultations")}</p>
      ) : consultations.length === 0 && !draft ? (
        <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">{t("sidebar.noConsultations")}</p>
      ) : (
        consultations.map((c) => {
          const active = c.id === activeConsultationId;
          return (
            <ConsultationNode
              key={c.id}
              title={titleOf(c)}
              meta={metaOf(c)}
              active={active}
              generating={sendingIds.has(c.id)}
              open={isOpen(c.id)}
              onToggle={() => toggle(c.id)}
              onSelect={() => onSelect(c.id)}
              // Colleagues can open each other's Consultations; archiving one stays with its creator
              // here (the API also lets case editors — see ChatSvc.assertCanRemove). Permanent
              // deletion is only offered from the archive below.
              action={
                c.userId === myUserId && !readOnly
                  ? {
                      icon: Archive,
                      label: t("sidebar.archiveConsultationNamed", { name: titleOf(c) }),
                      onClick: () => handleArchive(c),
                      // Unavailable while a reply is generating; the API refuses it too.
                      disabledReason: sendingIds.has(c.id) ? t("sidebar.archiveWhileGenerating") : undefined,
                    }
                  : undefined
              }
            >
              {active ? activeBody : <ConsultationTopicsPreview consultationId={c.id} onOpenPrompt={(p) => onSelect(c.id, p)} />}
            </ConsultationNode>
          );
        })
      )}
      {archiveDialog}
    </div>
  );
}

function ConsultationNode({
  title,
  meta,
  active,
  generating = false,
  open,
  onToggle,
  onSelect,
  action,
  children,
}: {
  title: string;
  meta: string;
  active: boolean;
  generating?: boolean;
  open: boolean;
  onToggle: () => void;
  onSelect: () => void;
  /** `disabledReason` greys the action out and shows why on hover instead of its label. */
  action?: { icon: typeof Archive; label: string; onClick: () => void; disabledReason?: string };
  children: ReactNode;
}) {
  const { t } = useTranslation("homepage");
  const ActionIcon = action?.icon;
  return (
    <div>
      <div
        className={`group flex items-center gap-0.5 rounded-lg pr-1 transition-colors ${
          active ? "bg-muted dark:bg-overlay-hover" : "hover:bg-muted/60 dark:hover:bg-overlay-hover"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? t("sidebar.hideTopics", { name: title }) : t("sidebar.showTopics", { name: title })}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onSelect}
          aria-current={active ? "true" : undefined}
          className="flex min-w-0 flex-1 flex-col py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
        >
          <span className={`truncate text-[13px] ${active ? "font-semibold text-foreground" : "text-foreground/90"}`}>{title}</span>
          <span className="truncate text-[11px] text-muted-foreground">{meta}</span>
        </button>
        {generating && (
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-gold" aria-label={t("sidebar.generatingResponse")} />
        )}
        {action && ActionIcon && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                // aria-disabled rather than disabled, so the tooltip can still say why.
                onClick={() => {
                  if (!action.disabledReason) action.onClick();
                }}
                aria-disabled={action.disabledReason ? true : undefined}
                aria-label={action.label}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-card hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-overlay-hover [@media(hover:none)]:opacity-100 aria-disabled:cursor-not-allowed aria-disabled:group-hover:opacity-40 aria-disabled:focus-visible:opacity-40 aria-disabled:[@media(hover:none)]:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground dark:aria-disabled:hover:bg-transparent"
              >
                <ActionIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{action.disabledReason ?? action.label}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {open && <div className="ml-3.5 mt-1 mb-2 border-l border-border pl-2">{children}</div>}
    </div>
  );
}

/** Another (not open) consultation's Topics, derived from its own messages only — fetched when
 * expanded, never the open chat's. Read-only: there's no transcript of it on screen to scroll or
 * spy on, so a topic click opens that consultation at the topic's prompt instead. */
function ConsultationTopicsPreview({ consultationId, onOpenPrompt }: { consultationId: string; onOpenPrompt: (promptNumber: number) => void }) {
  const { t } = useTranslation("case-portfolio");
  const { data: history, isLoading } = useMessagesQuery(consultationId);
  const isGenerating = useSendingConsultationsStore((s) => s.sendingConsultationIds.has(consultationId));
  const visible = useMemo(() => visibleChatMessages(history), [history]);
  const groups = useMemo(() => buildTopicGroups(visible), [visible]);

  if (isLoading) return <TopicNavigatorLoading label={t("workspace.topicsLoading")} />;
  if (groups.length === 0) {
    return isGenerating ? <TopicNavigatorLoading label={t("workspace.topicsGenerating")} /> : <EmptyTopics />;
  }
  return (
    <TopicNavigatorList
      groups={groups}
      activeIndex={null}
      onJump={(index) => onOpenPrompt(Math.max(0, promptNumberAt(visible, index)))}
    />
  );
}

function EmptyTopics() {
  const { t } = useTranslation("case-portfolio");
  return <p className="px-2 py-2 text-[12px] text-muted-foreground">{t("workspace.topicsEmpty")}</p>;
}
