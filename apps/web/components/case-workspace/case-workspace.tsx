"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import ConsultationChat from "@/components/chat/consultation-chat";
import { SourcesPanel } from "@/components/case-workspace/sources-panel";
import { StudioPanel } from "@/components/case-workspace/studio-panel";
import { ResizeHandle } from "@/components/case-workspace/resize-handle";
import { ThreadPicker } from "@/components/chat/thread-picker";
import { useResizableWidth } from "@/lib/case-workspace/use-resizable-width";

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
const STUDIO_MAX_WIDTH = 460;
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
  const basePath = `/homepage/v2/case-portfolio/${caseId}`;
  const searchParams = useSearchParams();
  const activeConsultationId = searchParams.get("c");

  const [sourcesExpanded, setSourcesExpanded] = useState(true);
  const [studioExpanded, setStudioExpanded] = useState(true);

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

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-1 overflow-hidden">
      <SourcesPanel
        caseId={caseId}
        expanded={sourcesExpanded}
        onExpandedChange={setSourcesExpanded}
        activeConsultationId={activeConsultationId}
        width={sourcesRenderWidth}
        isResizing={sources.isDragging}
      />
      {sourcesExpanded && (
        <ResizeHandle ariaLabel={t("workspace.resizeSources")} onPointerDown={sources.handlePointerDown} isDragging={sources.isDragging} />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-6">
          {/* Same px-6 gutter as ConsultationChat's `centerContent` column below (uncapped —
           * see its doc comment), so the thread title's left edge lines up with the transcript,
           * input dock, and message bubbles beneath it at any sidebar width. */}
          <ThreadPicker caseId={caseId} activeConsultationId={activeConsultationId} />
        </div>
        <div className="min-h-0 flex-1">
          <ConsultationChat embedded centerContent caseId={caseId} basePath={basePath} />
        </div>
      </div>

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
      />
    </div>
  );
}
