"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import ConsultationChat from "@/components/chat/consultation-chat";
import { SourcesPanel } from "@/components/case-workspace/sources-panel";
import { StudioPanel } from "@/components/case-workspace/studio-panel";
import { ResizeHandle } from "@/components/case-workspace/resize-handle";
import { ThreadPicker } from "@/components/chat/thread-picker";
import { useResizableWidth } from "@/lib/case-workspace/use-resizable-width";
import { useCaseQuery } from "@/lib/cases/mutations";

interface CaseWorkspaceProps {
  caseId: string;
}

// Sizing baseline modeled on NotebookLM's own three-panel proportions — Sources narrower than
// Studio (Studio's 3-column artifact card grid needs more room than a document list does).
const SOURCES_DEFAULT_WIDTH = 300;
const SOURCES_MIN_WIDTH = 220;
const SOURCES_MAX_WIDTH = 420;
const STUDIO_DEFAULT_WIDTH = 340;
const STUDIO_MIN_WIDTH = 260;
// Raised from 460 so Mind Map's node canvas has real room to breathe once opened (see
// STUDIO_MINDMAP_WIDTH below) — still just a ceiling, so Timeline/Data Table/Audio Overview
// stay at whatever width the user actually left the panel at.
const STUDIO_MAX_WIDTH = 760;
// Auto-widens Studio to this width the moment Mind Map is opened (only grows it — never
// shrinks a width the user already dragged past this), so the map is legible without the user
// having to discover the divider first. It stays a normal, user-draggable width afterwards:
// this only sets a floor for the one moment it opens.
const STUDIO_MINDMAP_WIDTH = 620;
// The center chat column's hard floor — both panels' dynamic max clamps to this so dragging
// either sidebar can never crush the reading area into overflow.
const CENTER_MIN_WIDTH = 400;
// w-14 — matches both panels' collapsed-rail class, needed here to budget space for the
// *other* panel while it's collapsed (see the getDynamicMax callbacks below).
const COLLAPSED_RAIL_WIDTH = 56;
const RESIZE_HANDLE_WIDTH = 6;

/** The 3-panel (Sources / Chat / Studio) layout for a case's detail page — see
 * ilovelawyer-app/CONTEXT.md's "Case Workspace" terms and docs/adr/0012-case-workspace-parallel-route.md.
 * The Chat column reuses ConsultationChat's `embedded` mode as-is (streaming, uploads, mic —
 * all unchanged); Sources and Studio are new panels built from already-existing pieces.
 * Sources/Studio widths are user-resizable (drag the dividers either side of Chat), styled and
 * constrained after NotebookLM's own resizable Sources/Studio panels. */
export function CaseWorkspace({ caseId }: CaseWorkspaceProps) {
  const { t } = useTranslation("case-portfolio");
  const basePath = `/homepage/case-portfolio/${caseId}`;
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeConsultationId = searchParams.get("c");
  const { data: caseRecord } = useCaseQuery(caseId);
  // Studio tiles (Mind Map) that need a consultation but don't have one yet create one
  // on demand and report the new id back here, so the URL (and every sibling reading
  // activeConsultationId off it — ThreadPicker, ConsultationChat) picks it up the same
  // way a first chat message already does via ConsultationChat's own navigateToConsultation.
  const handleConsultationCreated = (id: string) => {
    router.replace(`${basePath}?c=${id}`);
  };

  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [studioExpanded, setStudioExpanded] = useState(true);
  // Desktop-only concern (the docked panels' own expand/collapse). Mobile uses a completely
  // different layout below — a 3-way tab bar, not a resizable column — with its own state.
  const [mobileTab, setMobileTab] = useState<"sources" | "chat" | "studio">("chat");

  const containerRef = useRef<HTMLDivElement>(null);
  // Tracked in state (not just read off the ref) so a *passive* container resize — the window
  // shrinking, with no drag involved — also re-renders and re-clamps below. Without this, two
  // sidebars already dragged wide on a large screen would stay at their full pixel widths after
  // the window shrinks, crushing the center column arbitrarily thin instead of the 400px floor
  // being an actual hard minimum.
  const [containerWidth, setContainerWidth] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width !== undefined) setContainerWidth(width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const sources = useResizableWidth({
    storageKey: "case-workspace:sources-width",
    defaultWidth: SOURCES_DEFAULT_WIDTH,
    min: SOURCES_MIN_WIDTH,
    max: SOURCES_MAX_WIDTH,
    // Handle sits to the right of Sources — dragging right grows it.
    direction: 1,
    getDynamicMax: () => {
      const studioSpace = studioExpanded ? studio.width : COLLAPSED_RAIL_WIDTH;
      return containerWidth - studioSpace - CENTER_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2;
    },
  });

  const studio = useResizableWidth({
    storageKey: "case-workspace:studio-width",
    defaultWidth: STUDIO_DEFAULT_WIDTH,
    min: STUDIO_MIN_WIDTH,
    max: STUDIO_MAX_WIDTH,
    // Handle sits to the left of Studio — dragging left grows it.
    direction: -1,
    getDynamicMax: () => {
      const sourcesSpace = sourcesExpanded ? sources.width : COLLAPSED_RAIL_WIDTH;
      return containerWidth - sourcesSpace - CENTER_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2;
    },
  });

  // The *rendered* width, as opposed to each hook's own (persisted) preferred width above —
  // reclamped against the other panel and the live container size on every render, so a window
  // resize alone (no drag) can never crush the center column, and widening the window back out
  // restores the full preferred width rather than leaving it stuck at whatever it was crushed
  // to. `containerWidth` starts at 0 before the ResizeObserver's first measurement lands, which
  // would otherwise clamp everything to ~0 for a frame — skip clamping until it's measured.
  const sourcesRenderWidth = sourcesExpanded
    ? containerWidth === 0
      ? sources.width
      : Math.max(
          SOURCES_MIN_WIDTH,
          Math.min(
            sources.width,
            containerWidth - (studioExpanded ? studio.width : COLLAPSED_RAIL_WIDTH) - CENTER_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2,
          ),
        )
    : COLLAPSED_RAIL_WIDTH;
  // Which of the two structural layouts below is mounted — a real conditional, not just a
  // Tailwind `md:hidden` pair. Both branches render `chatColumn`, and mounting it twice at once
  // (previously: the mobile tab body whenever mobileTab==="chat" — the default — *and* the
  // desktop row unconditionally, merely CSS-hidden below `md`) put two elements with the same
  // `chat-msg-{i}` id in the DOM; TopicNavigator's `getElementById` always found the hidden
  // mobile copy first, so "jump to topic" silently scrolled an invisible pane instead of the
  // one on screen. Threshold matches Tailwind's default `md` breakpoint (768px), measured off
  // the same ResizeObserver as the panel-width clamping above rather than viewport width, since
  // that's the space this layout actually has to work with. Defaults to desktop before the
  // first measurement lands (containerWidth === 0) to match that same clamping's own fallback.
  const isDesktop = containerWidth === 0 || containerWidth >= 768;
  const studioRenderWidth = studioExpanded
    ? containerWidth === 0
      ? studio.width
      : Math.max(
          STUDIO_MIN_WIDTH,
          Math.min(
            studio.width,
            containerWidth - (sourcesExpanded ? sources.width : COLLAPSED_RAIL_WIDTH) - CENTER_MIN_WIDTH - RESIZE_HANDLE_WIDTH * 2,
          ),
        )
    : COLLAPSED_RAIL_WIDTH;

  // Rendered twice below (once in the mobile tab body, once in the desktop 3-column row) — a
  // plain JSX value, not a component, so this is just choosing which branch mounts it.
  const chatColumn = (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex h-11 md:h-14 shrink-0 items-center border-b border-border px-4 md:px-6">
        {/* Same px-6 gutter as ConsultationChat's `centerContent` column below (uncapped —
         * see its doc comment), so the thread title's left edge lines up with the transcript,
         * input dock, and message bubbles beneath it at any sidebar width. */}
        <ThreadPicker caseId={caseId} activeConsultationId={activeConsultationId} />
      </div>
      <div className="min-h-0 flex-1">
        <ConsultationChat
          embedded
          centerContent
          showSuggestedPrompts
          caseId={caseId}
          basePath={basePath}
          emptyStateHeading={caseRecord ? t("chat.emptyHeading", { caseName: caseRecord.caseName }) : undefined}
          emptyStateSubheading={t("chat.emptySubheading")}
          // Fallback pool only — ConsultationChat prioritizes this case's own uploaded
          // documents ("Summarize <file>") and its past consultation titles first, and
          // only fills remaining pill slots from this generic case-shaped list when
          // there's nothing case-specific yet to suggest (see its suggestedPrompts memo).
          emptyStatePrompts={[
            t("chat.emptyPromptSummarizeCase", { defaultValue: "Summarize this case's key facts" }),
            t("chat.emptyPromptNextSteps", { defaultValue: "What are the next steps for this case?" }),
            t("chat.emptyPromptRisks", { defaultValue: "Identify potential risks in this case" }),
            t("chat.emptyPromptStatusUpdate", { defaultValue: "Draft a case status update" }),
          ]}
        />
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {isDesktop ? (
        <div className="flex min-h-0 flex-1">
          <SourcesPanel
            expanded={sourcesExpanded}
            onExpandedChange={setSourcesExpanded}
            activeConsultationId={activeConsultationId}
            width={sourcesRenderWidth}
            isResizing={sources.isDragging}
          />
          {sourcesExpanded && (
            <ResizeHandle ariaLabel={t("workspace.resizeSources")} onPointerDown={sources.handlePointerDown} isDragging={sources.isDragging} />
          )}

          {chatColumn}

          {studioExpanded && (
            <ResizeHandle ariaLabel={t("workspace.resizeStudio")} onPointerDown={studio.handlePointerDown} isDragging={studio.isDragging} />
          )}
          <StudioPanel
            caseId={caseId}
            consultationId={activeConsultationId}
            expanded={studioExpanded}
            onExpandedChange={setStudioExpanded}
            width={studioRenderWidth}
            isResizing={studio.isDragging}
            onOpenMindMap={() => studio.requestWidth(STUDIO_MINDMAP_WIDTH)}
            onConsultationCreated={handleConsultationCreated}
          />
        </div>
      ) : (
        // Mobile: a 3-way tab bar (Sources / Chat / Studio), exactly one panel mounted at a time
        // — NotebookLM's own mobile pattern (the same product this workspace's desktop layout is
        // modeled after), rather than trying to fit three columns, an icon rail, or a drawer into
        // a phone-width screen.
        <>
          <div className="flex h-11 shrink-0 border-b border-border">
            <MobileWorkspaceTab active={mobileTab === "sources"} onClick={() => setMobileTab("sources")}>
              {t("workspace.sources")}
            </MobileWorkspaceTab>
            <MobileWorkspaceTab active={mobileTab === "chat"} onClick={() => setMobileTab("chat")}>
              {t("workspace.chatTab")}
            </MobileWorkspaceTab>
            <MobileWorkspaceTab active={mobileTab === "studio"} onClick={() => setMobileTab("studio")}>
              {t("workspace.studio")}
            </MobileWorkspaceTab>
          </div>
          <div className="flex min-h-0 flex-1">
            {mobileTab === "sources" && (
              // Collapsing (the panel's own header toggle) returns to the Chat tab — there's no
              // "rail" state to fall back to in a single-panel-at-a-time mobile layout.
              <SourcesPanel
                expanded
                fullWidth
                onExpandedChange={() => setMobileTab("chat")}
                activeConsultationId={activeConsultationId}
                width={0}
                isResizing={false}
              />
            )}
            {mobileTab === "chat" && chatColumn}
            {mobileTab === "studio" && (
              <StudioPanel
                caseId={caseId}
                consultationId={activeConsultationId}
                expanded
                fullWidth
                onExpandedChange={() => setMobileTab("chat")}
                width={0}
                isResizing={false}
                onConsultationCreated={handleConsultationCreated}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MobileWorkspaceTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex-1 text-[11.5px] font-semibold uppercase tracking-[0.5px] transition-colors cursor-pointer ${
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-gold" aria-hidden="true" />}
    </button>
  );
}
