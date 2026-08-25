"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Workflow, Clock, Table as TableIcon, AudioLines, PanelRight, PanelRightClose, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import { AUTO_MINDMAP_PROMPT } from "@/components/chat/consultation-chat";
import { useMessagesQuery, useChatSessionQuery, sendChatMessage } from "@/lib/chat/mutations";
import { useCaseQuery } from "@/lib/cases/mutations";
import { useCaseSnapshotQuery, useCaseTimelineQuery } from "@/lib/terminal/mutations";
import { getActiveMindMap } from "@/lib/chat/mind-map-parser";
import { chatKeys } from "@/lib/query-keys";

export type StudioTileKind = "mindmap" | "timeline" | "dataTable";

// How wide the panel gets once a tile's detail view is open — tuned per tile rather than one
// fixed size, since they need very different amounts of room: Mind Map is an interactive
// node canvas (wants the most space to actually be usable), Data Table has three text columns
// that truncate awkwardly if too narrow, Timeline is just a scrollable vertical list.
const OPEN_TILE_WIDTH_CLASS: Record<StudioTileKind, string> = {
  mindmap: "w-[70%] min-w-[640px] max-w-[1100px]",
  dataTable: "w-[58%] min-w-[520px] max-w-[900px]",
  timeline: "w-[42%] min-w-[420px] max-w-[680px]",
};

interface DataTableRow {
  type: string;
  label: string;
  detail: string;
}

// Findings/Damages categories are SCREAMING_SNAKE_CASE enum values (LEGAL_ISSUE,
// ATTORNEYS_FEES, ...) with no existing display-label translation anywhere in the app —
// PANEL_TITLES in legal-terminal.tsx is the same kind of hardcoded-English precedent for
// category-ish labels, so this matches rather than introducing a new one-off i18n key per enum
// value across three languages for what's a data-density convenience view.
function formatCategory(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Static at render time (doesn't tick live) — acceptable here since other query activity in
// this panel re-renders it often enough that the label stays close to accurate.
function formatUpdatedAt(t: (key: string, options?: Record<string, unknown>) => string, iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return t("workspace.updatedJustNow");
  if (minutes < 60) return t("workspace.updatedMinutesAgo", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("workspace.updatedHoursAgo", { count: hours });
  return t("workspace.updatedDaysAgo", { count: Math.floor(hours / 24) });
}

interface StudioPanelProps {
  caseId: string;
  /** Mind Map is per-consultation (see thread-picker.tsx) — whichever thread is active there
   * is what the tile renders. */
  consultationId: string | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

/** Case Workspace's right panel. Deliberately only 4 tiles — Mind Map (per-consultation),
 * Timeline and Data Table (both existing case data, just not previously surfaced here) — plus
 * a disabled Audio Overview placeholder — not the reference design's full generative toolset
 * (see docs/adr/0012). A live tile's click triggers its action (generate/refresh) in place; the
 * result row that appears below the grid once there's something to show is what actually opens
 * the view *inline*, widening the panel (not a modal) with a breadcrumb back control. */
export function StudioPanel({ caseId, consultationId, expanded, onExpandedChange }: StudioPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const [openTile, setOpenTile] = useState<StudioTileKind | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(false);

  const { data: caseRecord } = useCaseQuery(caseId);
  const { data: session } = useChatSessionQuery();
  const queryClient = useQueryClient();
  // Lifted up from CaseTimelineView (same query key, so this doesn't add a second network
  // call) so the Timeline tile's click can trigger a refetch directly, the same way the Mind
  // Map tile triggers a (re)generation, instead of the tile just opening the view.
  const timelineQuery = useCaseTimelineQuery(caseId);
  // Case Workspace didn't fetch the full snapshot before — Sources/Mind Map/Timeline each pull
  // their own narrower query. Data Table combines four of its already-structured sections
  // (Witnesses, Damages, Deadlines, Findings) that otherwise only have dedicated views in the
  // Legal Terminal, not here.
  const snapshotQuery = useCaseSnapshotQuery(caseId);
  const dataTableRows = useMemo<DataTableRow[]>(() => {
    const snap = snapshotQuery.data;
    if (!snap) return [];
    const rows: DataTableRow[] = [];
    snap.witnesses.forEach((w) => {
      rows.push({
        type: t("workspace.dataTableTypeWitness"),
        label: w.name,
        detail: [w.role, w.contact].filter((v) => v?.trim()).join(" · ") || "—",
      });
    });
    snap.damages.forEach((d) => {
      rows.push({
        type: `${t("workspace.dataTableTypeDamage")} · ${formatCategory(d.category)}`,
        label: d.description?.trim() || "—",
        detail: d.amount != null ? d.amount.toLocaleString() : "—",
      });
    });
    snap.procedure.deadlines.forEach((dl) => {
      rows.push({
        type: t("workspace.dataTableTypeDeadline"),
        label: dl.label,
        detail: dl.computedDueDate ? new Date(dl.computedDueDate).toLocaleDateString() : "—",
      });
    });
    snap.findings.forEach((f) => {
      rows.push({
        type: formatCategory(f.category),
        label: f.label,
        detail: f.notes === "AI" ? t("workspace.dataTableAiGenerated") : "—",
      });
    });
    return rows;
  }, [snapshotQuery.data, t]);
  // Unconditional (not gated on the tile being open) so a map can start generating in the
  // background the moment a consultation exists — see the auto-generate effect below — and the
  // collapsed tile itself can show a "Generating…" spinner before the user ever opens it.
  const { data: history } = useMessagesQuery(consultationId ?? undefined);
  const activeMindMap = useMemo(
    () => getActiveMindMap((history ?? []).map((m) => ({ mindMap: m.mindMap?.data }))),
    [history],
  );
  // The message that actually carried the current map, walked the same way getActiveMindMap
  // does (most recent first) — just kept as the raw message here instead of only its map data,
  // so the result row below can show when it was generated.
  const mindMapUpdatedAt = useMemo(() => {
    const list = history ?? [];
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i]?.mindMap?.data) return list[i]!.createdAt;
    }
    return null;
  }, [history]);
  const mindMapStatusLabel = isGenerating
    ? t("workspace.mindMapGenerating")
    : formatUpdatedAt(t, mindMapUpdatedAt);

  const openStudioTile = (kind: StudioTileKind) => {
    setOpenTile(kind);
    if (!expanded) onExpandedChange(true);
  };

  // Sends the same system-driven prompt ConsultationChat's own Mind Map tab uses to trigger
  // generation (consultation-chat.tsx) — sent directly rather than routed through the embedded
  // Chat panel next door, since Studio has no way to reach into a sibling component's state.
  // ConsultationChat's `visibleMessages` filter matches on this exact string, so the turn still
  // stays hidden from the transcript regardless of which panel sent it.
  const handleGenerateMindMap = useCallback(async () => {
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
  }, [consultationId, session, isGenerating, caseId, queryClient]);

  // Auto-triggers the same generation the manual CTA below fires — once per consultation, as
  // soon as its message history has actually loaded (not on the very first render, where
  // `history` is still undefined and we can't yet tell whether a map already exists) and only
  // if it turns out there's no map yet. Keyed by consultationId (not a plain boolean) so
  // switching to a different, still-map-less consultation retries instead of staying stuck on
  // whichever one first triggered it.
  const autoGeneratedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!consultationId || !session || history === undefined || activeMindMap) return;
    if (autoGeneratedForRef.current === consultationId) return;
    autoGeneratedForRef.current = consultationId;
    void handleGenerateMindMap();
  }, [consultationId, session, history, activeMindMap, handleGenerateMindMap]);

  const tileLabel =
    openTile === "mindmap"
      ? t("workspace.mindMapTile")
      : openTile === "timeline"
        ? t("workspace.timelineTile")
        : openTile === "dataTable"
          ? t("workspace.dataTableTile")
          : null;

  return (
    <aside
      className={`flex h-full min-h-0 shrink-0 flex-col border-l border-border bg-card transition-[width] duration-200 ${
        !expanded ? "w-14" : openTile ? OPEN_TILE_WIDTH_CLASS[openTile] : "w-80"
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
          {/* Triggers a (re)generation in place — it does not open the detail view. Once
           * something exists (or is generating), the result row below is what opens it; this
           * tile is purely the "make/remake one" action, same as the header's regenerate
           * button when the detail view happens to already be open. */}
          <StudioTile
            icon={isGenerating ? Loader2 : Workflow}
            iconSpinning={isGenerating}
            label={isGenerating ? t("workspace.mindMapGenerating") : t("workspace.mindMapTile")}
            expanded={expanded}
            disabled={isGenerating}
            onClick={() => void handleGenerateMindMap()}
          />
          {/* Same idea as the Mind Map tile above: triggers a refetch in place rather than
           * opening the view. Timeline has no "generate" step (it's live case data, not an
           * AI artifact), so "refresh" is this tile's equivalent action. */}
          <StudioTile
            icon={timelineQuery.isFetching ? Loader2 : Clock}
            iconSpinning={timelineQuery.isFetching}
            label={timelineQuery.isFetching ? t("workspace.timelineRefreshing") : t("workspace.timelineTile")}
            expanded={expanded}
            disabled={timelineQuery.isFetching}
            onClick={() => void timelineQuery.refetch()}
          />
          {/* Same pattern again: Witnesses/Damages/Deadlines/Findings are lawyer-entered or
           * Refresh-Analysis-populated data, not something to generate on click — so this tile
           * refetches the case snapshot in place. */}
          <StudioTile
            icon={snapshotQuery.isFetching ? Loader2 : TableIcon}
            iconSpinning={snapshotQuery.isFetching}
            label={snapshotQuery.isFetching ? t("workspace.dataTableRefreshing") : t("workspace.dataTableTile")}
            expanded={expanded}
            disabled={snapshotQuery.isFetching}
            onClick={() => void snapshotQuery.refetch()}
          />
          <StudioTile
            icon={AudioLines}
            label={t("workspace.audioOverviewTile")}
            expanded={expanded}
            disabled
            disabledHint={t("workspace.audioComingSoon")}
          />

          {/* Result of clicking a tile above — persists here once a tile actually has something
           * to show (generated/generating, or fetched data), so it stays reachable without
           * re-opening the tile grid. Nothing shown for Audio Overview — still disabled, no
           * feature behind it yet. */}
          {expanded &&
            ((consultationId && (isGenerating || activeMindMap)) ||
              (timelineQuery.data && timelineQuery.data.length > 0) ||
              timelineQuery.isFetching ||
              dataTableRows.length > 0 ||
              snapshotQuery.isFetching) && (
              <div className="mt-1 flex flex-col gap-1.5 border-t border-border pt-2">
                {consultationId && (isGenerating || activeMindMap) && (
                  <ResultRow
                    icon={isGenerating ? Loader2 : Workflow}
                    iconSpinning={isGenerating}
                    title={t("workspace.mindMapTile")}
                    subtitle={mindMapStatusLabel}
                    onClick={() => openStudioTile("mindmap")}
                  />
                )}
                {((timelineQuery.data && timelineQuery.data.length > 0) || timelineQuery.isFetching) && (
                  <ResultRow
                    icon={timelineQuery.isFetching ? Loader2 : Clock}
                    iconSpinning={timelineQuery.isFetching}
                    title={t("workspace.timelineTile")}
                    subtitle={
                      timelineQuery.isFetching
                        ? t("workspace.timelineRefreshing")
                        : t("workspace.timelineEventCount", { count: timelineQuery.data?.length ?? 0 })
                    }
                    onClick={() => openStudioTile("timeline")}
                  />
                )}
                {(dataTableRows.length > 0 || snapshotQuery.isFetching) && (
                  <ResultRow
                    icon={snapshotQuery.isFetching ? Loader2 : TableIcon}
                    iconSpinning={snapshotQuery.isFetching}
                    title={t("workspace.dataTableTile")}
                    subtitle={
                      snapshotQuery.isFetching
                        ? t("workspace.dataTableRefreshing")
                        : t("workspace.dataTableFactCount", { count: dataTableRows.length })
                    }
                    onClick={() => openStudioTile("dataTable")}
                  />
                )}
              </div>
            )}
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
          ) : openTile === "timeline" ? (
            <CaseTimelineView caseId={caseId} fill />
          ) : dataTableRows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="py-2 pr-3">{t("workspace.dataTableColType")}</th>
                    <th className="py-2 pr-3">{t("workspace.dataTableColLabel")}</th>
                    <th className="py-2">{t("workspace.dataTableColDetail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {dataTableRows.map((row, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="py-2 pr-3 align-top text-muted-foreground">{row.type}</td>
                      <td className="py-2 pr-3 align-top text-foreground">{row.label}</td>
                      <td className="py-2 align-top text-muted-foreground">{row.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("workspace.dataTableEmpty")}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}

function ResultRow({
  icon: Icon,
  iconSpinning = false,
  title,
  subtitle,
  onClick,
}: {
  icon: typeof Workflow;
  iconSpinning?: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:border-brand-gold/40 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
    >
      <Icon className={`h-4 w-4 shrink-0 text-brand-gold ${iconSpinning ? "animate-spin" : ""}`} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

function StudioTile({
  icon: Icon,
  iconSpinning = false,
  label,
  expanded,
  onClick,
  disabled = false,
  disabledHint,
}: {
  icon: typeof Workflow;
  /** Spins the icon in place — used for a Loader2 icon while a tile is generating in the
   * background, so the collapsed rail itself communicates progress without needing the tile
   * open (see the Mind Map tile's auto-generate effect above). */
  iconSpinning?: boolean;
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
      <Icon className={`h-4 w-4 shrink-0 text-brand-gold ${iconSpinning ? "animate-spin" : ""}`} aria-hidden="true" />
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
