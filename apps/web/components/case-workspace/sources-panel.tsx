"use client";
import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ListTree, PanelLeft, PanelLeftClose, ChevronDown, ChevronRight, Gavel, CheckCircle2, ExternalLink, ThumbsUp, ThumbsDown } from "lucide-react";
import { TopicNavigatorList, TopicNavigatorLoading } from "@/components/chat/topic-navigator";
import { useTopicNavigator, decisionAnchorElementId, evidenceQuoteElementId } from "@/lib/chat/use-topic-navigator";
import { useRelatedCasesQuery, type RelatedCase } from "@/lib/chat/mutations";
import { EvidenceItem, RuleItem, Label } from "@/components/shared/decision-detail";
import { useActiveHighlightStore } from "@/lib/store/active-highlight.store";
import { isInternalLibraryHref } from "@/lib/law/internal-library-link";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface SourcesPanelProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Evidence, authorities, and topics all come from whichever thread ThreadPicker has active,
   * not a document selection of its own. */
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
  /** Case Workspace's mobile layout mounts exactly one of Sources/Chat/Studio at a time (see
   * case-workspace.tsx) — the Chat pane, and the `chat-msg-${index}` bubble a jump scrolls to,
   * don't exist in the DOM while this panel is the one showing. The mobile caller passes this
   * to record which index was jumped to and switch back to the Chat tab before the jump runs;
   * left unset on desktop, where Chat is already mounted alongside this panel and the jump can
   * run immediately. */
  onBeforeJump?: (index: number) => void;
}

/** Case Workspace's left panel — the material behind the active thread's latest legal answer:
 * Evidence For/Against and Authorities (rule citations + related cases), both from that turn's
 * audited Decision Records (see ilovelawyer-api's MessageDecisionRecord / lib/terminal/types.ts),
 * each row jumping straight to the reply bubble it came from in the embedded Chat pane next door.
 * Topics (the split-reply table of contents this panel used to be limited to — see
 * lib/chat/use-topic-navigator.ts) stays as a secondary, collapsed-by-default section below.
 * Collapses to a slim rail. Documents (this case's Case Documents) moved to the Studio panel
 * instead (see studio-panel.tsx's Documents tile) — its upload/storage logic didn't move, only
 * where it's surfaced. */
export function SourcesPanel({ expanded, onExpandedChange, activeConsultationId, width, isResizing, fullWidth = false, className = "flex", onBeforeJump }: SourcesPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const { t: tTerminal } = useTranslation("terminal");
  const { groups, topics, activeIndex, scrollToTopic, scrollToElementId, isGenerating, latestDecisions, latestAssistantIndex } =
    useTopicNavigator(activeConsultationId);
  const { data: relatedCasesData } = useRelatedCasesQuery(activeConsultationId ?? undefined);
  const relatedCases = relatedCasesData?.relatedCases ?? [];
  // Collapsed by default — Topics is the demoted, secondary section now that Evidence/
  // Authorities are the panel's primary content (see the module doc comment above).
  const [topicsOpen, setTopicsOpen] = useState(false);
  // Evidence For/Against open by default (they're the panel's primary content), but each
  // collapses independently — a turn with a long evidence list otherwise pushes Authorities and
  // Topics out of view entirely.
  const [evidenceForOpen, setEvidenceForOpen] = useState(true);
  const [evidenceAgainstOpen, setEvidenceAgainstOpen] = useState(true);
  const activeHighlightId = useActiveHighlightStore((s) => s.activeHighlightId);
  const setActiveHighlight = useActiveHighlightStore((s) => s.setActiveHighlight);

  // A stale highlight from a previous thread would otherwise survive a thread switch — ids are
  // only unique within one turn's decisions (e.g. "evidence-quote-0-for-1"), so a leftover one
  // could coincidentally "highlight" an unrelated quote once a new consultation's messages load.
  useEffect(() => {
    setActiveHighlight(null);
  }, [activeConsultationId, setActiveHighlight]);

  const handleJump = (index: number) => {
    if (!onBeforeJump) return scrollToTopic(index);
    onBeforeJump(index);
    // The tab switch above still needs to commit and paint before `chat-msg-${index}` exists
    // in the DOM — a single requestAnimationFrame can still land before layout in some
    // browsers, so wait two.
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToTopic(index)));
  };

  // Same shape as handleJump, but jumping straight to a specific element id (a decision's anchor
  // sentence, or a piece of evidence's own quoted sentence) instead of just the message as a
  // whole — every row used to land on the same spot (the message) regardless of which decision
  // or quote it actually backed. Falls back to the message itself (scrollToElementId's own
  // fallback) when that id never matched in the rendered text. Also marks `id` as *the* active
  // highlight (activeHighlightId, one at a time — a new click replaces the last one rather than
  // stacking): only an evidence-quote id ever actually renders yellow from this (see
  // assistant-message.tsx), a decision-anchor id here is a no-op for highlighting, since that
  // span already has its own permanent dotted-underline styling, unrelated to this on-click one.
  const handleJumpToElement = (id: string) => {
    if (!latestDecisions) return;
    setActiveHighlight(id);
    const messageIndex = latestDecisions.index;
    if (!onBeforeJump) return scrollToElementId(id, messageIndex);
    onBeforeJump(messageIndex);
    requestAnimationFrame(() => requestAnimationFrame(() => scrollToElementId(id, messageIndex)));
  };

  // Flattened across every decision record on the latest turn that produced any — this panel
  // shows "what backs this whole reply" as one list, not grouped per-conclusion the way the
  // Decisions Studio tile (studio-panel.tsx) or the chat "Why?" drawer do. Each item keeps its
  // originating record's index (`ri`) — and, for evidence, its index within that record's own
  // evidenceFor/evidenceAgainst (`ei`) — matching decisionAnchorElementId/evidenceQuoteElementId's
  // numbering exactly (same arrays, read straight off the message, never re-sorted), so a click
  // lands on that specific decision's anchor, or that specific piece of evidence's own quote.
  const evidenceFor =
    latestDecisions?.records.flatMap((r, ri) => r.evidenceFor.map((ev, ei) => ({ ev, ri, ei }))) ?? [];
  const evidenceAgainst =
    latestDecisions?.records.flatMap((r, ri) => r.evidenceAgainst.map((ev, ei) => ({ ev, ri, ei }))) ?? [];
  const rules = latestDecisions?.records.flatMap((r, ri) => r.rule.map((rule) => ({ rule, ri }))) ?? [];

  const hasEvidence = evidenceFor.length > 0 || evidenceAgainst.length > 0;
  const hasAuthorities = rules.length > 0 || relatedCases.length > 0;
  const hasAnything = hasEvidence || hasAuthorities || topics.length > 0;

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
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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

      {/* Collapsed rail — one icon per section that actually has content, each expanding the
       * panel straight into that section (rather than the old topic-dots-only rail, which had
       * no way to represent Evidence For/Against or Authorities at all). */}
      {!expanded && (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto pt-3">
          {hasAnything ? (
            <>
              {topics.length > 0 && (
                <CollapsedSectionIcon
                  icon={ListTree}
                  label={`${t("workspace.topicsSectionTitle")} · ${topics.length}`}
                  onClick={() => {
                    onExpandedChange(true);
                    setTopicsOpen(true);
                  }}
                />
              )}
              {evidenceFor.length > 0 && (
                <CollapsedSectionIcon
                  icon={ThumbsUp}
                  label={`${tTerminal("decisionEvidenceFor")} · ${evidenceFor.length}`}
                  onClick={() => {
                    onExpandedChange(true);
                    setEvidenceForOpen(true);
                  }}
                />
              )}
              {evidenceAgainst.length > 0 && (
                <CollapsedSectionIcon
                  icon={ThumbsDown}
                  label={`${tTerminal("decisionEvidenceAgainst")} · ${evidenceAgainst.length}`}
                  onClick={() => {
                    onExpandedChange(true);
                    setEvidenceAgainstOpen(true);
                  }}
                />
              )}
              {hasAuthorities && (
                <CollapsedSectionIcon
                  icon={Gavel}
                  label={t("workspace.sourcesAuthorities")}
                  onClick={() => onExpandedChange(true)}
                />
              )}
            </>
          ) : isGenerating ? (
            <TopicNavigatorLoading label={t("workspace.topicsGenerating")} compact />
          ) : (
            <ListTree className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      )}

      {expanded && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {hasAnything ? (
            <div className="flex flex-col gap-4">
              <div className="border-t border-border pt-3 first:border-0 first:pt-0">
                <SectionToggle
                  label={t("workspace.topicsSectionTitle")}
                  count={topics.length > 0 ? topics.length : undefined}
                  open={topicsOpen}
                  onToggle={() => setTopicsOpen((v) => !v)}
                />
                {topicsOpen &&
                  (topics.length > 0 ? (
                    <div className="mt-2">
                      <TopicNavigatorList groups={groups} activeIndex={activeIndex} onJump={handleJump} />
                    </div>
                  ) : isGenerating ? (
                    <div className="mt-2">
                      <TopicNavigatorLoading label={t("workspace.topicsGenerating")} />
                    </div>
                  ) : (
                    <p className="py-3 text-center text-xs text-muted-foreground">{t("workspace.topicsEmpty")}</p>
                  ))}
              </div>

              {hasEvidence && (
                <div className="flex flex-col gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                  {evidenceFor.length > 0 && (
                    <div>
                      <SectionToggle
                        label={tTerminal("decisionEvidenceFor")}
                        count={evidenceFor.length}
                        open={evidenceForOpen}
                        onToggle={() => setEvidenceForOpen((v) => !v)}
                      />
                      {evidenceForOpen && (
                        <ul className="mt-1.5 space-y-1.5">
                          {evidenceFor.map(({ ev, ri, ei }, i) => {
                            const id = evidenceQuoteElementId(ri, "for", ei);
                            return (
                              <EvidenceItem
                                key={i}
                                evidence={ev}
                                onClick={() => handleJumpToElement(id)}
                                active={id === activeHighlightId}
                              />
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                  {evidenceAgainst.length > 0 && (
                    <div>
                      <SectionToggle
                        label={tTerminal("decisionEvidenceAgainst")}
                        count={evidenceAgainst.length}
                        open={evidenceAgainstOpen}
                        onToggle={() => setEvidenceAgainstOpen((v) => !v)}
                      />
                      {evidenceAgainstOpen && (
                        <ul className="mt-1.5 space-y-1.5">
                          {evidenceAgainst.map(({ ev, ri, ei }, i) => {
                            const id = evidenceQuoteElementId(ri, "against", ei);
                            return (
                              <EvidenceItem
                                key={i}
                                evidence={ev}
                                onClick={() => handleJumpToElement(id)}
                                active={id === activeHighlightId}
                              />
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}

              {hasAuthorities && (
                <div className="flex flex-col gap-3 border-t border-border pt-3 first:border-0 first:pt-0">
                  <Label>{t("workspace.sourcesAuthorities")}</Label>
                  {rules.length > 0 && (
                    <ul className="space-y-1">
                      {rules.map(({ rule, ri }, i) => {
                        const id = decisionAnchorElementId(latestDecisions!.index, ri);
                        return (
                          <RuleItem
                            key={i}
                            rule={rule}
                            onClick={() => handleJumpToElement(id)}
                            active={id === activeHighlightId}
                          />
                        );
                      })}
                    </ul>
                  )}
                  {relatedCases.length > 0 && (
                    <div>
                      {rules.length > 0 && (
                        <p className="mb-1 mt-1 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                          {t("workspace.relatedTab")}
                        </p>
                      )}
                      <ul className="space-y-1.5">
                        {relatedCases.map((rc, i) => (
                          <RelatedCaseRow
                            key={i}
                            relatedCase={rc}
                            onClick={latestAssistantIndex !== null ? () => handleJump(latestAssistantIndex) : undefined}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isGenerating ? (
            <TopicNavigatorLoading label={t("workspace.topicsGenerating")} />
          ) : !activeConsultationId ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("workspace.sourcesNoConsultation")}
            </p>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("workspace.sourcesEmpty")}</p>
          )}
        </div>
      )}
    </aside>
  );
}

// Collapsed-rail button for one section — same visual shape as Studio panel's own collapsed
// tile (studio-panel.tsx's StudioTile), so the two side panels' collapsed rails read as one
// pattern. Always expands the panel; the label also names which section, shown as a tooltip
// since there's no room for text at 56px wide.
function CollapsedSectionIcon({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ListTree;
  label: string;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="flex w-9 items-center justify-center rounded-xl border border-border px-0 py-2.5 transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
        >
          <Icon className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

// Shared by Evidence For/Against and Topics below — a dropdown-style section header, since a
// turn with a long evidence list would otherwise push everything after it out of view.
function SectionToggle({
  label,
  count,
  open,
  onToggle,
}: {
  label: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 text-left">
      <Label>
        {label}
        {count !== undefined ? ` · ${count}` : ""}
      </Label>
      {open ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
    </button>
  );
}

// Related Cases (useRelatedCasesQuery) have no per-item sentence anchor the way Decision Record
// evidence/rules do — the whole row jumps to the latest reply (`onClick`, wired to
// latestAssistantIndex) rather than a specific conclusion. `vetted` gets the same check-icon
// treatment as EvidenceItem/RuleItem's `verified`; unvetted rows just omit the icon rather than
// showing a red X — "not vetted" isn't a defect the way unverified evidence would be, just a
// lower-confidence citation.
const LEGISLATION_TYPES: Record<string, string> = {
  ukpga: "Act",
  uksi: "SI",
  asp: "Act of the Scottish Parliament",
  anaw: "Act of the Welsh Assembly",
  asc: "Act of Senedd Cymru",
  nia: "Northern Ireland Act",
  ukla: "Local Act",
  wsi: "Welsh SI",
  ssi: "Scottish SI",
};

// Chat Wonder sometimes returns a related item with only a `url` (title, case_number and
// ra_number all null), which rendered as a blank link. Derive a readable label from the URL so
// the row is still identifiable — legislation.gov.uk paths encode type/year/number/section.
function relatedCaseLabel(rc: RelatedCase): string {
  const named = [rc.title, rc.case_number, rc.ra_number].find((v) => typeof v === "string" && v.trim());
  if (named) return named.trim();
  if (!rc.url) return "";
  try {
    const u = new URL(rc.url);
    const parts = u.pathname.split("/").filter(Boolean);
    if (u.hostname.endsWith("legislation.gov.uk") && parts.length >= 3) {
      const [type, year, number, kind, section] = parts;
      const label = `${LEGISLATION_TYPES[type!] ?? type!.toUpperCase()} ${year}/${number}`;
      return kind === "section" && section ? `${label}, section ${section}` : label;
    }
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`;
  } catch {
    return rc.url;
  }
}

function RelatedCaseRow({ relatedCase, onClick }: { relatedCase: RelatedCase; onClick?: () => void }) {
  const label = relatedCaseLabel(relatedCase);
  return (
    <li
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`text-[12px] leading-4 text-muted-foreground ${onClick ? "cursor-pointer rounded-md p-1 -m-1 hover:bg-muted dark:hover:bg-overlay-hover" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <Gavel className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        {relatedCase.vetted && <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400" aria-hidden="true" />}
        {relatedCase.url && isInternalLibraryHref(relatedCase.url) ? (
          <Link
            href={relatedCase.url}
            onClick={(e: MouseEvent<HTMLAnchorElement>) => e.stopPropagation()}
            className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground underline decoration-dotted hover:text-brand-gold"
          >
            <span className="truncate">{label}</span>
          </Link>
        ) : relatedCase.url ? (
          <a
            href={relatedCase.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex min-w-0 items-center gap-1 font-medium text-foreground underline decoration-dotted hover:text-brand-gold"
          >
            <span className="truncate">{label}</span>
            <ExternalLink className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
          </a>
        ) : (
          <span className="truncate font-medium text-foreground">{label}</span>
        )}
      </div>
      {relatedCase.snippet && <p className="mt-0.5 ml-4 line-clamp-2 italic">{relatedCase.snippet}</p>}
    </li>
  );
}
