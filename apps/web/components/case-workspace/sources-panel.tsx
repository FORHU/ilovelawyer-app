"use client";
import { useTranslation } from "react-i18next";
import { ListTree, PanelLeft, PanelLeftClose } from "lucide-react";
import { TopicNavigatorList, TopicNavigatorLoading } from "@/components/chat/topic-navigator";
import { useTopicNavigator } from "@/lib/chat/use-topic-navigator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface SourcesPanelProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Topics come from the latest split (MessageGroup) AI reply in this thread — so, like
   * Related Cases before it, this follows whichever thread ThreadPicker has active, not a
   * document selection of its own. */
  activeConsultationId: string | null;
  /** Expanded-state width in px, owned by case-workspace.tsx's useResizableWidth — ignored
   * while collapsed (a fixed slim rail regardless of the last dragged width), and while
   * `fullWidth` is set (see below). */
  width: number;
  /** True mid-drag — suppresses the width transition so the panel tracks the pointer 1:1
   * instead of easing behind it, while collapse/expand keeps its smooth animation. */
  isResizing: boolean;
  /** Below md, case-workspace.tsx renders this inside a narrow sliding drawer instead of a
   * resizable docked sidebar — there's no room for three side-by-side columns on a phone.
   * Ignores `width`/`isResizing` and fills its container instead. */
  fullWidth?: boolean;
  /** Extra classes merged onto the root `<aside>` — case-workspace.tsx uses this to show two
   * instances (one `hidden md:flex` docked/resizable, one `md:hidden` always-collapsed rail
   * whose expand toggle opens the mobile drawer instead of growing in place). */
  className?: string;
}

/** Case Workspace's left panel — a table of contents for the active thread's latest split AI
 * reply (see ilovelawyer-api's MessageGroup / lib/chat/use-topic-navigator.ts), letting the
 * user jump straight to a topic's bubble in the embedded Chat pane next door. Collapses to a
 * slim rail. Related Cases and Documents (this case's Case Documents) used to live here; Related
 * Cases is being relocated elsewhere (not this panel) and Documents now lives in the Studio
 * panel instead (see studio-panel.tsx's Documents tile) — its upload/storage logic didn't move,
 * only where it's surfaced. */
export function SourcesPanel({ expanded, onExpandedChange, activeConsultationId, width, isResizing, fullWidth = false, className = "flex" }: SourcesPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const { topics, activeIndex, scrollToTopic, isGenerating } = useTopicNavigator(activeConsultationId);

  return (
    <aside
      // `className` (default "flex") carries all display responsibility, not a hardcoded
      // `flex` here — case-workspace.tsx renders two instances of this component (one
      // `hidden md:flex` docked/resizable, one `flex md:hidden` always-collapsed mobile rail),
      // and an unprefixed `flex` baked in here would fight an unprefixed `hidden` passed in for
      // the same element at the same breakpoint (undefined which wins).
      className={`h-full min-h-0 shrink-0 flex-col border-r border-border bg-card ${
        fullWidth ? "w-full" : isResizing ? "" : "transition-[width] duration-200"
      } ${!fullWidth && !expanded ? "w-14" : ""} ${className}`}
      style={expanded && !fullWidth ? { width } : undefined}
    >
      <div
        className={`flex h-14 shrink-0 items-center border-b border-border ${
          expanded ? "justify-between px-4" : "justify-center"
        }`}
      >
        {expanded && (
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
            <ListTree className="h-3.5 w-3.5 text-brand-gold shrink-0" aria-hidden="true" />
            <span className="truncate">{t("workspace.sources")}</span>
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("workspace.collapseSources") : t("workspace.expandSources")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {expanded ? (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeft className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {expanded ? t("workspace.collapseSources") : t("workspace.expandSources")}
          </TooltipContent>
        </Tooltip>
      </div>

      {!expanded && (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 overflow-y-auto pt-3">
          {topics.length > 0 ? (
            <TopicNavigatorList topics={topics} activeIndex={activeIndex} onJump={scrollToTopic} compact />
          ) : isGenerating ? (
            <TopicNavigatorLoading label={t("workspace.topicsGenerating")} compact />
          ) : (
            <ListTree className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}

      {expanded && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {topics.length > 0 ? (
            <TopicNavigatorList topics={topics} activeIndex={activeIndex} onJump={scrollToTopic} />
          ) : isGenerating ? (
            <TopicNavigatorLoading label={t("workspace.topicsGenerating")} />
          ) : !activeConsultationId ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("workspace.topicsNoConsultation")}
            </p>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("workspace.topicsEmpty")}</p>
          )}
        </div>
      )}
    </aside>
  );
}
