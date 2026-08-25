"use client";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Workflow, Clock, AudioLines, PanelRight, PanelRightClose, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import { AUTO_MINDMAP_PROMPT } from "@/components/chat/consultation-chat";
import { useMessagesQuery, useChatSessionQuery, sendChatMessage } from "@/lib/chat/mutations";
import { useCaseQuery } from "@/lib/cases/mutations";
import { getActiveMindMap } from "@/lib/chat/mind-map-parser";
import { chatKeys } from "@/lib/query-keys";

export type StudioTileKind = "mindmap" | "timeline";

interface StudioPanelProps {
  caseId: string;
  /** Mind Map is per-consultation (see thread-picker.tsx) — whichever thread is active there
   * is what the tile renders. */
  consultationId: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

/** Case Workspace's right panel. Deliberately only 3 tiles — Mind Map and Timeline (existing
 * Conversation views) plus a disabled Audio Overview placeholder — not the reference design's
 * full generative toolset (see docs/adr/0012). A live tile opens *inline*, widening the panel
 * (not a modal) with a breadcrumb back control, matching the reference layout. */
export function StudioPanel({ caseId, consultationId, expanded, onExpandedChange }: StudioPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const [openTile, setOpenTile] = useState<StudioTileKind | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(false);

  const { data: caseRecord } = useCaseQuery(caseId);
  const { data: session } = useChatSessionQuery();
  const queryClient = useQueryClient();
  const { data: history } = useMessagesQuery(openTile === "mindmap" ? (consultationId ?? undefined) : undefined);
  const activeMindMap = useMemo(
    () => getActiveMindMap((history ?? []).map((m) => ({ mindMap: m.mindMap?.data }))),
    [history],
  );

  const openStudioTile = (kind: StudioTileKind) => {
    setOpenTile(kind);
    if (!expanded) onExpandedChange(true);
  };

  // Sends the same system-driven prompt ConsultationChat's own Mind Map tab uses to trigger
  // generation (consultation-chat.tsx) — sent directly rather than routed through the embedded
  // Chat panel next door, since Studio has no way to reach into a sibling component's state.
  // ConsultationChat's `visibleMessages` filter matches on this exact string, so the turn still
  // stays hidden from the transcript regardless of which panel sent it.
  const handleGenerateMindMap = async () => {
    if (!consultationId || !session || isGenerating) return;
    setIsGenerating(true);
    setGenerateError(false);
    try {
      await sendChatMessage({
        consultationId,
        sessionId: session.session_id,
        message: AUTO_MINDMAP_PROMPT,
        caseId,
        onChunk: () => {},
      });
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(consultationId) });
    } catch {
      setGenerateError(true);
    } finally {
      setIsGenerating(false);
    }
  };

  const tileLabel = openTile === "mindmap" ? t("workspace.mindMapTile") : openTile === "timeline" ? t("workspace.timelineTile") : null;

  return (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-card transition-[width] duration-200 ${
        !expanded ? "w-14" : openTile ? "w-[38%] min-w-[420px] max-w-[640px]" : "w-80"
      }`}
    >
      <div
        className={`flex h-14 shrink-0 items-center gap-1 border-b border-border ${
          expanded ? "justify-between px-4" : "justify-center"
        }`}
      >
        {expanded && (
          <div className="flex min-w-0 items-center gap-1.5">
            {openTile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setOpenTile(null)}
                    aria-label={t("workspace.backToStudio")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">{t("workspace.backToStudio")}</TooltipContent>
              </Tooltip>
            )}
            {openTile ? (
              <span className="flex min-w-0 items-center gap-1 text-[13px] font-semibold">
                <span className="text-muted-foreground">{t("workspace.studio")}</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate text-foreground">{tileLabel}</span>
              </span>
            ) : (
              <span className="text-[13px] font-semibold text-foreground">{t("workspace.studio")}</span>
            )}
          </div>
        )}
        {expanded && openTile === "mindmap" && consultationId && activeMindMap && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void handleGenerateMindMap()}
                disabled={!session || isGenerating}
                aria-label={t("workspace.mindMapRegenerateCta")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("workspace.mindMapRegenerateCta")}</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("workspace.collapseStudio") : t("workspace.expandStudio")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              {expanded ? (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRight className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            {expanded ? t("workspace.collapseStudio") : t("workspace.expandStudio")}
          </TooltipContent>
        </Tooltip>
      </div>

      {(!expanded || !openTile) && (
        <div className={`flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3 ${expanded ? "" : "items-center"}`}>
          <StudioTile icon={Workflow} label={t("workspace.mindMapTile")} expanded={expanded} onClick={() => openStudioTile("mindmap")} />
          <StudioTile icon={Clock} label={t("workspace.timelineTile")} expanded={expanded} onClick={() => openStudioTile("timeline")} />
          <StudioTile
            icon={AudioLines}
            label={t("workspace.audioOverviewTile")}
            expanded={expanded}
            disabled
            disabledHint={t("workspace.audioComingSoon")}
          />
        </div>
      )}

      {expanded && openTile && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {openTile === "mindmap" ? (
            consultationId ? (
              activeMindMap ? (
                <div className="flex h-full flex-col gap-2">
                  {generateError && (
                    <p className="shrink-0 text-center text-xs text-red-600 dark:text-red-400">
                      {t("workspace.mindMapGenerateError")}
                    </p>
                  )}
                  <div className="min-h-0 flex-1">
                    <MindMap rootTitle={caseRecord?.caseName} data={activeMindMap} consultationId={consultationId} />
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {isGenerating ? t("workspace.mindMapGenerating") : t("workspace.mindMapEmpty")}
                  </p>
                  {!isGenerating && (
                    <button
                      type="button"
                      onClick={() => void handleGenerateMindMap()}
                      disabled={!session}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                    >
                      {t("workspace.mindMapGenerateCta")}
                    </button>
                  )}
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                  {generateError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{t("workspace.mindMapGenerateError")}</p>
                  )}
                </div>
              )
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("workspace.mindMapNoConsultation")}
              </p>
            )
          ) : (
            <CaseTimelineView caseId={caseId} fill />
          )}
        </div>
      )}
    </aside>
  );
}

function StudioTile({
  icon: Icon,
  label,
  expanded,
  onClick,
  disabled = false,
  disabledHint,
}: {
  icon: typeof Workflow;
  label: string;
  expanded: boolean;
  onClick?: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const tile = (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors enabled:hover:bg-muted enabled:hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50 disabled:cursor-default ${
        expanded ? "w-full" : "w-9 justify-center px-0"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0 text-brand-gold" aria-hidden="true" />
      {expanded && <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{label}</span>}
    </button>
  );

  if (!disabled) return tile;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tile}</TooltipTrigger>
      <TooltipContent side={expanded ? "top" : "left"}>{disabledHint ?? label}</TooltipContent>
    </Tooltip>
  );
}
