"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Workflow, Clock, Table as TableIcon, AudioLines, PanelRight, PanelRightClose, ChevronLeft, ChevronRight, Loader2, RefreshCw, Play, Pause, RotateCcw, RotateCw, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import { AUTO_MINDMAP_PROMPT } from "@/components/chat/consultation-chat";
import { useMessagesQuery, useChatSessionQuery, sendChatMessage } from "@/lib/chat/mutations";
import { useAudioOverview } from "@/lib/chat/use-audio-overview";
import { useCaseQuery } from "@/lib/cases/mutations";
import { useCaseSnapshotQuery, useCaseTimelineQuery } from "@/lib/terminal/mutations";
import { getActiveMindMap } from "@/lib/chat/mind-map-parser";
import { chatKeys } from "@/lib/query-keys";

export type StudioTileKind = "mindmap" | "timeline" | "dataTable" | "audioOverview";

// How wide the panel gets once a tile's detail view is open — tuned per tile rather than one
// fixed size, since they need very different amounts of room: Mind Map is an interactive
// node canvas (wants the most space to actually be usable), Data Table has three text columns
// that truncate awkwardly if too narrow, Timeline is just a scrollable vertical list, Audio
// Overview is a transcript list plus a single <audio> player.
const OPEN_TILE_WIDTH_CLASS: Record<StudioTileKind, string> = {
  mindmap: "w-[70%] min-w-[640px] max-w-[1100px]",
  dataTable: "w-[58%] min-w-[520px] max-w-[900px]",
  timeline: "w-[42%] min-w-[420px] max-w-[680px]",
  audioOverview: "w-[46%] min-w-[440px] max-w-[720px]",
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

  // Script generation → Polly render polling → playable URL — shared with the Legal
  // Terminal's Audio Overview panel via useAudioOverview (lib/chat/use-audio-overview.ts).
  const {
    activeAudioOverviewMessage,
    isGeneratingScript: isGeneratingAudioOverview,
    generateScriptError: audioOverviewGenerateError,
    generateScript: handleGenerateAudioOverviewScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    regenerateAudio: handleGenerateAudioOverviewAudio,
    isGeneratingAudio: generateAudioOverviewAudioPending,
  } = useAudioOverview(consultationId, caseId);
  const audioOverviewMessageId = activeAudioOverviewMessage?.id;
  const audioOverviewStatusLabel =
    isGeneratingAudioOverview || audioRendering || generateAudioOverviewAudioPending
      ? isGeneratingAudioOverview
        ? t("workspace.audioOverviewGenerating")
        : t("workspace.audioOverviewRendering")
      : formatUpdatedAt(t, activeAudioOverviewMessage?.createdAt ?? null);

  // One <audio> element for the whole panel (not one per player UI) so the compact row's mini
  // player and the detail view's player control the same actual playback instead of each
  // starting their own — see the hidden <audio> mounted near the bottom of the JSX below.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  // Dismissing the bottom player bar (X button) only hides it — the underlying <audio> and its
  // position aren't touched, so switching back to the Audio Overview tile brings it right back.
  const [playerBarDismissed, setPlayerBarDismissed] = useState(false);
  const toggleAudioOverviewPlayback = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const seekAudioOverview = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, playbackDuration || seconds));
  };
  const skipAudioOverview = (deltaSeconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    seekAudioOverview(el.currentTime + deltaSeconds);
  };
  const cycleAudioOverviewRate = () => {
    const el = audioRef.current;
    const next = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(next);
    if (el) el.playbackRate = next;
  };
  function formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  useEffect(() => {
    setIsPlaying(false);
    setPlaybackTime(0);
    setPlaybackDuration(0);
    setPlaybackRate(1);
    setPlayerBarDismissed(false);
    // Not resetting lastSavedPositionRef here — onPause/onEnded on the <audio> element below
    // always save the exact position immediately regardless of this ref's throttle state, so a
    // stale threshold carried over from a previous track only delays the periodic autosave for
    // the new one, never loses the position entirely.
  }, [renderedAudioUrl]);

  // Resume position — per-browser (localStorage, same pattern this app already uses for
  // Display Preferences/Language Preference), not per-account: it survives a refresh or a
  // logout/login in the same browser, which is what was actually asked for, without needing a
  // backend column just to remember a scrub position. Keyed by messageId, not audioFileId, so
  // it still resolves correctly across a "Regenerate audio" that reuses the same script.
  const lastSavedPositionRef = useRef(0);
  const savePlaybackPosition = (messageId: string, seconds: number) => {
    try {
      localStorage.setItem(`audio-overview-position:${messageId}`, String(Math.floor(seconds)));
    } catch {
      // localStorage unavailable (private browsing, storage disabled) — resume just won't work
    }
  };
  const readPlaybackPosition = (messageId: string): number => {
    try {
      return Number(localStorage.getItem(`audio-overview-position:${messageId}`)) || 0;
    } catch {
      return 0;
    }
  };

  const tileLabel =
    openTile === "mindmap"
      ? t("workspace.mindMapTile")
      : openTile === "timeline"
        ? t("workspace.timelineTile")
        : openTile === "dataTable"
          ? t("workspace.dataTableTile")
          : openTile === "audioOverview"
            ? t("workspace.audioOverviewTile")
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
          {/* Same tile/result-row split as Mind Map, but deliberately no auto-generate-on-mount
           * effect — see activeAudioOverviewMessage's comment above for why. */}
          <StudioTile
            icon={isGeneratingAudioOverview ? Loader2 : AudioLines}
            iconSpinning={isGeneratingAudioOverview}
            label={isGeneratingAudioOverview ? t("workspace.audioOverviewGenerating") : t("workspace.audioOverviewTile")}
            expanded={expanded}
            disabled={isGeneratingAudioOverview}
            onClick={() => void handleGenerateAudioOverviewScript()}
          />

          {/* Result of clicking a tile above — persists here once a tile actually has something
           * to show (generated/generating, or fetched data), so it stays reachable without
           * re-opening the tile grid. */}
          {expanded &&
            ((consultationId && (isGenerating || activeMindMap)) ||
              (timelineQuery.data && timelineQuery.data.length > 0) ||
              timelineQuery.isFetching ||
              dataTableRows.length > 0 ||
              snapshotQuery.isFetching ||
              (consultationId && (isGeneratingAudioOverview || activeAudioOverviewMessage))) && (
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
                {consultationId &&
                  (isGeneratingAudioOverview || audioRendering || generateAudioOverviewAudioPending || activeAudioOverviewMessage) &&
                  (renderedAudioUrl ? (
                    <AudioOverviewMiniPlayer
                      title={t("workspace.audioOverviewTile")}
                      isPlaying={isPlaying}
                      currentTime={playbackTime}
                      duration={playbackDuration}
                      onTogglePlay={toggleAudioOverviewPlayback}
                      onOpen={() => openStudioTile("audioOverview")}
                      formatDuration={formatDuration}
                    />
                  ) : (
                    <ResultRow
                      icon={isGeneratingAudioOverview || audioRendering || generateAudioOverviewAudioPending ? Loader2 : AudioLines}
                      iconSpinning={isGeneratingAudioOverview || audioRendering || generateAudioOverviewAudioPending}
                      title={t("workspace.audioOverviewTile")}
                      subtitle={audioOverviewStatusLabel}
                      onClick={() => openStudioTile("audioOverview")}
                    />
                  ))}
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
          ) : openTile === "dataTable" ? (
            dataTableRows.length > 0 ? (
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
            )
          ) : consultationId ? (
            activeAudioOverviewMessage ? (
              <div className="flex h-full flex-col gap-3">
                {audioRenderError && (
                  <p className="shrink-0 text-center text-xs text-red-600 dark:text-red-400">
                    {t("workspace.audioOverviewRenderError")}
                  </p>
                )}
                {/* Once audio exists, playback is entirely the bottom-docked player bar's job
                 * (play/pause, scrub, skip, speed) — this used to also render its own inline
                 * play/progress block here, duplicating the same controls at the same time.
                 * Only the pre-render "Generate audio" state still needs anything here. */}
                {!renderedAudioUrl && (
                  <div className="flex shrink-0 flex-col gap-2 rounded-xl border border-border p-3">
                    <button
                      type="button"
                      onClick={handleGenerateAudioOverviewAudio}
                      disabled={audioRendering || generateAudioOverviewAudioPending}
                      className="inline-flex items-center justify-center gap-1.5 self-start rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                    >
                      {audioRendering || generateAudioOverviewAudioPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : null}
                      {audioRendering || generateAudioOverviewAudioPending
                        ? t("workspace.audioOverviewRendering")
                        : t("workspace.audioOverviewGenerateAudioCta")}
                    </button>
                  </div>
                )}
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
                  {activeAudioOverviewMessage.audioOverview?.turns.map((turn, i) => (
                    <div key={i}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
                        {turn.speaker === "HOST_A" ? t("workspace.audioOverviewHostA") : t("workspace.audioOverviewHostB")}
                      </p>
                      <p className="text-[13px] leading-5 text-foreground">{turn.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  {isGeneratingAudioOverview ? t("workspace.audioOverviewGenerating") : t("workspace.audioOverviewEmpty")}
                </p>
                {!isGeneratingAudioOverview && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateAudioOverviewScript()}
                    disabled={!session}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                  >
                    {t("workspace.audioOverviewGenerateCta")}
                  </button>
                )}
                {isGeneratingAudioOverview && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
                {audioOverviewGenerateError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{t("workspace.audioOverviewGenerateError")}</p>
                )}
              </div>
            )
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {t("workspace.audioOverviewNoConsultation")}
            </p>
          )}
        </div>
      )}

      {expanded && renderedAudioUrl && !playerBarDismissed && (
        <AudioOverviewPlayerBar
          title={t("workspace.audioOverviewTile")}
          isPlaying={isPlaying}
          currentTime={playbackTime}
          duration={playbackDuration}
          playbackRate={playbackRate}
          onTogglePlay={toggleAudioOverviewPlayback}
          onSeek={seekAudioOverview}
          onSkip={skipAudioOverview}
          onCycleRate={cycleAudioOverviewRate}
          onClose={() => setPlayerBarDismissed(true)}
          formatDuration={formatDuration}
        />
      )}

      {/* One <audio> for the whole panel — not rendered with the native `controls` UI; the
       * mini player row and the detail view (both below) drive it via audioRef and read its
       * play/pause/time state back out through these event handlers, so playback started from
       * one keeps going (and stays reflected) if you open/close the detail view mid-play. */}
      {renderedAudioUrl && audioOverviewMessageId && (
        <audio
          ref={audioRef}
          src={renderedAudioUrl}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            setIsPlaying(false);
            // Captured immediately on pause (not just the throttled interval below) so
            // stopping right after seeking, before the next timeupdate tick, isn't lost.
            savePlaybackPosition(audioOverviewMessageId, audioRef.current?.currentTime ?? 0);
          }}
          onEnded={() => {
            setIsPlaying(false);
            // Finished — resume-from-here no longer makes sense; next play starts over.
            savePlaybackPosition(audioOverviewMessageId, 0);
          }}
          onTimeUpdate={(e) => {
            const seconds = e.currentTarget.currentTime;
            setPlaybackTime(seconds);
            // Throttled to ~every 5s of playback (timeupdate fires several times a second) —
            // frequent enough that a crash/tab-close never loses more than a few seconds,
            // without hammering localStorage on every tick.
            if (seconds - lastSavedPositionRef.current >= 5) {
              lastSavedPositionRef.current = seconds;
              savePlaybackPosition(audioOverviewMessageId, seconds);
            }
          }}
          onLoadedMetadata={(e) => {
            setPlaybackDuration(e.currentTarget.duration);
            const resumeAt = readPlaybackPosition(audioOverviewMessageId);
            if (resumeAt > 0 && resumeAt < e.currentTarget.duration) {
              e.currentTarget.currentTime = resumeAt;
              setPlaybackTime(resumeAt);
              lastSavedPositionRef.current = resumeAt;
            }
          }}
          className="hidden"
        />
      )}
    </aside>
  );
}

// The reference (NotebookLM's Studio list) shows a play button and progress bar directly on
// the collapsed row, playable without opening the item — this is that, for Audio Overview
// specifically. Not folded into ResultRow (used by the other three tiles too) since a
// play/pause button with its own click target inside a row that also opens on click needs
// event.stopPropagation() precision the generic component has no reason to carry.
// The reference's persistent bottom "now playing" bar — richer than AudioOverviewMiniPlayer
// (scrub, ±10s skip, speed), docked to the bottom of the panel itself (not the whole browser
// window — Studio is a side panel, not a full page) whenever audio is loaded and hasn't been
// dismissed. Deliberately omits the reference's thumbs up/down and history/queue icons — no
// feedback or playback-history feature exists behind them, and a button that does nothing on
// click doesn't belong here just to match a screenshot.
function AudioOverviewPlayerBar({
  title,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onSeek,
  onSkip,
  onCycleRate,
  onClose,
  formatDuration,
}: {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onCycleRate: () => void;
  onClose: () => void;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-card px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[12px] font-medium text-foreground">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close player"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || currentTime)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full accent-brand-gold"
          aria-label="Seek"
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{formatDuration(currentTime)}</span>
          <span>{formatDuration(duration)}</span>
        </div>
      </div>
      <div className="flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={onCycleRate}
          className="w-9 shrink-0 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          {playbackRate}x
        </button>
        <button
          type="button"
          onClick={() => onSkip(-10)}
          aria-label="Back 10 seconds"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-colors hover:bg-brand-gold/85"
        >
          {isPlaying ? <Pause className="h-4 w-4 fill-current" aria-hidden="true" /> : <Play className="h-4 w-4 fill-current" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => onSkip(10)}
          aria-label="Forward 10 seconds"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="w-9 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

function AudioOverviewMiniPlayer({
  title,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  onOpen,
  formatDuration,
}: {
  title: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay: () => void;
  onOpen: () => void;
  formatDuration: (seconds: number) => string;
}) {
  return (
    <div className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-brand-gold/40 hover:bg-muted">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePlay();
        }}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-colors hover:bg-brand-gold/85"
      >
        {isPlaying ? <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />}
      </button>
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="mt-1 flex items-center gap-2">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-brand-gold"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">{formatDuration(duration)}</span>
        </span>
      </button>
    </div>
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
