"use client";

import { useEffect, useState } from "react";
import { ListTree, Loader2, PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { MobileDrawer } from "@/components/mobile-drawer";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export interface TopicNavigatorItem {
  /** visibleMessages array index of this topic's bubble — used as its scroll-target id. */
  index: number;
  title: string;
}

/** The actual topic rows — no aside/header chrome of its own, so it can sit inside whatever
 * shell the caller already has (the homepage's absolute rail below, or Case Workspace's
 * resizable Sources panel — see sources-panel.tsx). `compact` mirrors a collapsed rail: icon
 * dot only, label in a tooltip instead of inline. */
export function TopicNavigatorList({
  topics,
  activeIndex,
  onJump,
  compact = false,
}: {
  topics: TopicNavigatorItem[];
  activeIndex: number | null;
  onJump: (index: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "flex flex-col items-center gap-1" : "space-y-0.5"}>
      {topics.map((topic) => {
        const isActive = topic.index === activeIndex;
        return (
          <Tooltip key={topic.index}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onJump(topic.index)}
                className={`w-full flex items-center gap-2 rounded-full text-left transition-colors ${
                  compact ? "justify-center px-0 py-2" : "px-3 py-1.5"
                } ${isActive ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"}`}
              >
                <span
                  className={`shrink-0 rounded-full ${compact ? "w-2 h-2" : "w-1.5 h-1.5"} ${
                    isActive ? "bg-brand-gold" : "bg-border"
                  }`}
                  aria-hidden="true"
                />
                {compact ? (
                  <span className="sr-only">{topic.title}</span>
                ) : (
                  <span className="text-[13px] font-['Inter'] truncate">{topic.title}</span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{topic.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

/** A split reply can only exist once the turn is fully persisted (see MessageGroup), so there's
 * nothing to list until then — this fills that gap the moment a send starts (see
 * sending-consultations.store.ts) instead of leaving the panel looking empty/stale for however
 * long the turn actually takes. `compact` mirrors a collapsed rail: spinner only, text in a
 * tooltip instead of inline. */
export function TopicNavigatorLoading({ label, compact = false }: { label: string; compact?: boolean }) {
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left">{label}</TooltipContent>
      </Tooltip>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
      <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" aria-hidden="true" />
      <span className="text-[13px] font-['Inter']">{label}</span>
    </div>
  );
}

/** Running table-of-contents across every split (MessageGroup) AI reply in the thread — lets
 * the user jump straight to a topic's bubble instead of scrolling the transcript. Mirrors
 * consultation-sidebar.tsx's absolute two-state rail (collapsed icon strip / expanded list),
 * mirrored to the right edge, since this page has no real flex row to add a column to (see
 * that file's left-sidebar layout). Only ever rendered once at least one split reply exists —
 * see consultation-chat.tsx's `splitTopics`. Case Workspace uses TopicNavigatorList directly
 * instead of this wrapper — see sources-panel.tsx — since it already has its own resizable
 * panel chrome (header, collapse toggle, width) this would otherwise duplicate. */
export default function TopicNavigator({
  topics,
  activeIndex,
  expanded,
  onExpandedChange,
  onJump,
  label,
  isGenerating = false,
  generatingLabel,
}: {
  topics: TopicNavigatorItem[];
  activeIndex: number | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onJump: (index: number) => void;
  label: string;
  /** True from the moment a send starts until the turn is persisted — see
   * sending-consultations.store.ts. Shows a spinner in place of the (necessarily still empty)
   * topic list, rather than nothing. */
  isGenerating?: boolean;
  generatingLabel?: string;
}) {
  // Mobile drawer — the desktop/tablet rail below is `hidden` under `lg` (matching
  // ConsultationSidebar's own mobile-drawer breakpoint, see consultation-sidebar.tsx), so
  // topic-jump navigation needs its own trigger + overlay drawer on phones instead of just
  // disappearing. Mirrors that same pattern (trigger button + boolean state + resize-based
  // auto-close + overlay), sliding in from the right instead of the left.
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (!isMobileOpen) return;
    const handleResize = () => {
      if (window.innerWidth >= 1024) setIsMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobileOpen]);

  const body = (compact: boolean, onJumpOverride: (index: number) => void = onJump) =>
    topics.length === 0 && isGenerating ? (
      <TopicNavigatorLoading label={generatingLabel ?? label} compact={compact} />
    ) : (
      <TopicNavigatorList topics={topics} activeIndex={activeIndex} onJump={onJumpOverride} compact={compact} />
    );

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsMobileOpen(true)}
            aria-label={label}
            // right-3/top-20 mirrors ConsultationSidebar's own clearance fix — this now
            // covers 768-1023px tablet widths too, with zero padding reserved for it below
            // `lg`, so it needs real breathing room from the header and page content.
            className="lg:hidden absolute right-3 top-20 z-(--z-sidebar) flex h-10 w-10 items-center justify-center rounded-full bg-card/90 backdrop-blur-md border border-border shadow-lg text-foreground hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <ListTree className="h-5 w-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>

      <aside
        className={`hidden lg:flex absolute right-0 top-16 bottom-0 bg-card/90 backdrop-blur-md border-l border-y border-border rounded-l-[8px] shadow-lg flex-col py-4 z-(--z-sidebar) overflow-hidden transition-[width] duration-200 ${
          expanded ? "w-64" : "w-12"
        }`}
      >
        <div className={`flex items-center shrink-0 px-3 pb-3 ${expanded ? "justify-between" : "justify-center"}`}>
          {expanded && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground font-['Inter']">
              <ListTree className="w-3.5 h-3.5 text-brand-gold" aria-hidden="true" />
              {label}
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => onExpandedChange(!expanded)}
                className="flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {expanded ? (
                  <PanelRightClose className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <PanelRightOpen className="w-3.5 h-3.5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{label}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2">{body(!expanded)}</div>
      </aside>

      <MobileDrawer
        open={isMobileOpen}
        onClose={() => setIsMobileOpen(false)}
        closeLabel={label}
        side="right"
      >
        <div className="flex items-center justify-between px-4 pb-2">
          <span className="flex items-center gap-1.5 text-[13px] font-['Inter'] font-semibold text-foreground">
            <ListTree className="w-3.5 h-3.5 text-brand-gold" aria-hidden="true" />
            {label}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label={label}
                className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2">
          {body(false, (index) => {
            onJump(index);
            setIsMobileOpen(false);
          })}
        </div>
      </MobileDrawer>
    </>
  );
}
