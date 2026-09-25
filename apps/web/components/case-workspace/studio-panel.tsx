"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Workflow, Clock, Table as TableIcon, AudioLines, Files, Scale, PanelRight, PanelRightClose, ChevronLeft, ChevronRight, ChevronDown, Loader2, RefreshCw, Download, Search, Play } from "lucide-react";
import { CaseBriefContent } from "@/components/case-brief/case-brief-content";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover";
import { MindMap } from "@/components/chat/mind-map";
import { CaseTimelineView } from "@/components/cases/case-timeline";
import { DocumentFolderBrowser } from "@/components/cases/document-folder-browser";
import { DecisionConfidenceBadge, DecisionDetailBody } from "@/components/shared/decision-detail";
import { ResearchTraceList } from "@/components/chat/research-trace-list";
import type { DecisionRecordPayload, FindingCategory } from "@/lib/terminal/types";
import { AudioOverviewPlayerBar } from "@/components/audio-overview-player";
import { AUTO_MINDMAP_PROMPT } from "@/lib/chat/auto-prompts";
import { useMessagesQuery, useChatSessionQuery, useCreateConsultationMutation, sendChatMessageAndWait } from "@/lib/chat/mutations";
import { useTopicNavigator } from "@/lib/chat/use-topic-navigator";
import { useAudioOverview } from "@/lib/chat/use-audio-overview";
import { useAudioOverviewPlayer } from "@/lib/chat/use-audio-overview-player";
import { useSendingConsultationsStore } from "@/lib/store/sending-consultations.store";
import { useCaseQuery, useCaseDocumentsQuery } from "@/lib/cases/mutations";
import { useCaseSnapshotQuery, useAiJobStatus, useGenerateTimelineMutation } from "@/lib/terminal/mutations";
import { useGraphViewQuery } from "@/lib/graph-view/mutations";
import { getActiveMindMap, getActiveMindMapRecord } from "@/lib/chat/mind-map-parser";
import { useMindMapExpansion, type MindMapExpansionTarget } from "@/lib/chat/use-mind-map-expansion";
import { useCaseMindMap, useGenerateCaseMindMapMutation } from "@/lib/case-workspace/case-mind-map";
import { chatKeys } from "@/lib/query-keys";

export type StudioTileKind = "documents" | "decisions" | "mindmap" | "timeline" | "dataTable" | "audioOverview" | "caseBrief";

interface DataTableRow {
  type: string;
  label: string;
  detail: string;
}

// Fixed review order for the Findings section of the Data Table — matches the order lawyers
// scan a case in (issue, then case-for/case-against, then how to press/defend it).
const FINDING_CATEGORY_ORDER: FindingCategory[] = [
  "LEGAL_ISSUE",
  "WEAKNESS",
  "STRENGTH",
  "ATTACK_STRATEGY",
  "DEFENSE_STRATEGY",
];

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
  /** Expanded width in px, owned by case-workspace.tsx's useResizableWidth — applies whether
   * the tile grid or an open tile's detail view is showing, so opening Mind Map/Timeline/Data
   * Table/Audio Overview never grows the panel past the same resizable bounds (260–460px) the
   * user already controls via the divider. Ignored while collapsed (fixed slim rail). */
  width: number;
  /** True mid-drag — suppresses the width transition so the panel tracks the pointer 1:1
   * instead of easing behind it, while collapse/expand and tile open/close keep their
   * animation. */
  isResizing: boolean;
  /** Lets case-workspace.tsx auto-widen the panel (up to a point) the moment Mind Map opens —
   * its node canvas needs more room than the other three tiles do. Only ever grows the width
   * (never shrinks one the user already dragged past it), and the result stays a normal
   * user-draggable width afterwards. */
  onOpenMindMap?: () => void;
  /** Same auto-widen-once pattern as onOpenMindMap, for Data Table's 3-column layout — Type
   * and Detail auto-size to their own (short) content regardless of panel width (see the
   * table below), so this isn't needed to keep them legible; it's purely so Label's full
   * paragraph text gets more breathing room to wrap into, rather than a tall, narrow column. */
  onOpenDataTable?: () => void;
  /** Mind Map needs a consultation to send its generation prompt into. When none is active yet,
   * handleGenerateMindMap creates one on demand (same pattern as ConsultationChat's own
   * ensureConsultationId) and reports the new id back up here so case-workspace.tsx can put it
   * in the URL — the single place activeConsultationId is read from, shared by every sibling
   * (ThreadPicker, ConsultationChat) that needs to agree on which consultation is active. */
  onConsultationCreated?: (consultationId: string) => void;
  /** Below md, case-workspace.tsx renders this inside a narrow sliding drawer instead of a
   * resizable docked sidebar — there's no room for three side-by-side columns on a phone.
   * Ignores `width`/`isResizing` and fills its container instead. */
  fullWidth?: boolean;
  /** Extra classes merged onto the root `<aside>` — default "flex" carries all display
   * responsibility (case-workspace.tsx overrides it per-instance: `hidden md:flex` for the
   * docked/resizable copy, `flex md:hidden` for the always-collapsed mobile rail whose expand
   * toggle opens the mobile drawer instead of growing in place). */
  className?: string;
}

/** Case Workspace's right panel. Documents, Mind Map (per-consultation), Timeline and Data
 * Table (both existing case data, just not previously surfaced here) — plus a disabled Audio
 * Overview placeholder — not the reference design's full generative toolset (see docs/adr/0012).
 * A live tile's click triggers its action (generate/refresh) in place; the result row that
 * appears below the grid once there's something to show is what actually opens the view
 * *inline* (not a modal) with a breadcrumb back control, within the panel's existing resizable
 * width rather than growing past it — the user can still drag it wider first if a tile's content
 * (e.g. Mind Map's node canvas) needs more room. Documents is the one exception to that
 * trigger-then-result-row shape: it's already-there data (this case's Case Documents), not
 * something to generate/refresh, so its tile opens the detail view directly — the same
 * DocumentFolderBrowser this used to render in the (now Related-Cases-only) Sources panel,
 * reused as-is; only where it's surfaced moved, not how documents are stored or uploaded. */
export function StudioPanel({ caseId, consultationId, expanded, onExpandedChange, width, isResizing, onOpenMindMap, onOpenDataTable, onConsultationCreated, fullWidth = false, className = "flex" }: StudioPanelProps) {
  const { t } = useTranslation("case-portfolio");
  const [openTile, setOpenTile] = useState<StudioTileKind | null>(null);
  const [isGeneratingLocal, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(false);
  // Collapsed by default — a sub-section of the Decisions tile (ilovelawyer-api#119's replay),
  // not its own tile, since it's turn-scoped the same way a decision is and would otherwise
  // compete with Decisions for the same "this turn's reasoning" attention. Keyed by promptIndex
  // (Map, same idiom as decisionOverrides below) rather than one shared boolean, now that several
  // prompts' decision groups can be open at once — a single flag would otherwise toggle every
  // group's research steps in lockstep instead of each independently.
  const [researchStepsOverrides, setResearchStepsOverrides] = useState<Map<number, boolean>>(() => new Map());
  const isResearchStepsOpen = (promptIndex: number) => researchStepsOverrides.get(promptIndex) ?? false;
  const toggleResearchSteps = (promptIndex: number) =>
    setResearchStepsOverrides((prev) => new Map(prev).set(promptIndex, !isResearchStepsOpen(promptIndex)));
  const mindMapJob = useAiJobStatus(caseId, "mindMap");
  // Combines this tab's own in-flight request with the persisted job status, so a job kicked
  // off from another tab (or this one, before a refresh) still shows as generating here too.
  const isGenerating = isGeneratingLocal || mindMapJob.data?.status === "IN_PROGRESS";
  // The composer may already have a turn in flight for this same consultation — both share one
  // Chat Wonder session per consultation, and firing a second concurrent turn onto it silently
  // orphans one of them. Same cross-panel flag the composer's own send already gates on.
  const isMindMapConsultationBusy = useSendingConsultationsStore((s) =>
    consultationId ? s.sendingConsultationIds.has(consultationId) : false,
  );

  const { data: caseRecord } = useCaseQuery(caseId);
  // Same PENDING-polling query DocumentFolderBrowser's own indexing badge uses — reused here
  // rather than duplicated, so the Documents tile and the detail view it opens always agree.
  const caseDocumentsQuery = useCaseDocumentsQuery(caseId);
  const isIndexingDocuments = caseDocumentsQuery.data?.some((doc) => doc.ragStatus === "PENDING") ?? false;
  const documentCount = caseDocumentsQuery.data?.length ?? 0;
  const readyDocumentCount = caseDocumentsQuery.data?.filter((doc) => doc.ragStatus === "READY").length ?? 0;
  // Timeline and Data Table are populated from document analysis — nothing to show (or refresh)
  // until at least one document exists.
  const noDocuments = documentCount === 0;
  const indexingDocumentCount = caseDocumentsQuery.data?.filter((doc) => doc.ragStatus === "PENDING").length ?? 0;
  const documentsNote =
    documentCount === 0
      ? undefined
      : indexingDocumentCount > 0
        ? t("workspace.documentsNoteIndexing", { count: documentCount, indexing: indexingDocumentCount })
        : t("workspace.documentsNoteReady", { count: documentCount });
  const { data: session } = useChatSessionQuery();
  const queryClient = useQueryClient();
  // Lifted up from CaseTimelineView (same query key, so this doesn't add a second network
  // call) so the tile's note (event count) and the header's generate button (rendered further
  // down, once the detail view is open) can both read/drive the same cache.
  const timelineQuery = useGraphViewQuery(caseId, "timeline");
  const timelineEventCount = useMemo(
    () => (timelineQuery.data?.nodes ?? []).filter((node) => node.type === "TIMELINE_EVENT").length,
    [timelineQuery.data],
  );
  // Timeline dates are extracted by a Chat Wonder call (case-strategy.service.ts) — either
  // manually (kind "timelineGenerate", triggered only from the open detail view's header refresh
  // button — the tile itself just opens that view, see StudioTile below) or automatically as one
  // step inside a document upload's post-extraction "caseRefresh" job (queues/case-post-
  // extraction.ts). Both kinds feed the same "is it generating right now" state and the same
  // refetch-on-completion below, so the tile's spinner/label and the header button react the same
  // way regardless of which path is actually running — "caseRefresh" IN_PROGRESS is a coarser
  // signal (that job also runs contradictions/case-finding, not just the timeline step), but
  // AiGenerationLockSvc has no finer-grained per-step status to read instead.
  const generateTimelineMutation = useGenerateTimelineMutation(caseId);
  const timelineGenerateJob = useAiJobStatus(caseId, "timelineGenerate");
  const caseRefreshJob = useAiJobStatus(caseId, "caseRefresh");
  const isGeneratingTimeline =
    generateTimelineMutation.isPending ||
    timelineGenerateJob.data?.status === "IN_PROGRESS" ||
    caseRefreshJob.data?.status === "IN_PROGRESS";
  const handleGenerateTimeline = useCallback(() => {
    if (isGeneratingTimeline) return;
    generateTimelineMutation.mutate();
  }, [isGeneratingTimeline, generateTimelineMutation]);
  // useAiJobStatus only auto-invalidates the case snapshot on an IN_PROGRESS -> DONE transition —
  // this tile reads the timeline via graph-view, a separate cache, so it refetches that itself.
  const prevTimelineGenerateStatus = useRef(timelineGenerateJob.data?.status);
  useEffect(() => {
    if (prevTimelineGenerateStatus.current === "IN_PROGRESS" && timelineGenerateJob.data?.status === "DONE") {
      void timelineQuery.refetch();
    }
    prevTimelineGenerateStatus.current = timelineGenerateJob.data?.status;
  }, [timelineGenerateJob.data?.status, timelineQuery]);
  const prevCaseRefreshStatus = useRef(caseRefreshJob.data?.status);
  useEffect(() => {
    if (prevCaseRefreshStatus.current === "IN_PROGRESS" && caseRefreshJob.data?.status === "DONE") {
      void timelineQuery.refetch();
    }
    prevCaseRefreshStatus.current = caseRefreshJob.data?.status;
  }, [caseRefreshJob.data?.status, timelineQuery]);
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
    // Findings arrive in whatever order the API/DB returned them (insertion order), which
    // interleaves categories — group them into the fixed review order below so all of one
    // category's rows (e.g. every Weakness) sit together instead of scattered through the table.
    const findingsByCategory = [...snap.findings].sort(
      (a, b) => FINDING_CATEGORY_ORDER.indexOf(a.category) - FINDING_CATEGORY_ORDER.indexOf(b.category),
    );
    findingsByCategory.forEach((f) => {
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
  // Decisions, Mind Map and Audio Overview are all derived from the conversation — hidden until
  // the lawyer has sent a first prompt, so there's nothing to open that would just be empty.
  const hasPrompt = (history?.length ?? 0) > 0;
  const activeMindMap = useMemo(
    () => getActiveMindMap((history ?? []).map((m) => ({ mindMap: m.mindMap?.data }))),
    [history],
  );
  const activeMindMapRecord = useMemo(() => getActiveMindMapRecord(history ?? []), [history]);
  // The case's document-built map (ilovelawyer-api's CaseMindMapSvc, rebuilt by the post-upload
  // refresh like the timeline) is what Studio shows; a consultation's chat-generated map is only
  // the fallback while the case has none yet.
  const caseMindMap = useCaseMindMap(caseId);
  const generateCaseMindMap = useGenerateCaseMindMapMutation(caseId);
  const showingCaseMap = Boolean(caseMindMap.tree);
  const shownMindMap = caseMindMap.tree ?? activeMindMap;
  const isBuildingCaseMap = caseMindMap.isBuilding || generateCaseMindMap.isPending;
  // "Something is about to replace the shown map" — Regenerate and Expand both wait it out.
  const isShownMapBusy = showingCaseMap ? isBuildingCaseMap : isGenerating || isMindMapConsultationBusy;
  const mindMapExpansionTarget = useMemo<MindMapExpansionTarget | undefined>(
    () =>
      showingCaseMap && caseMindMap.map
        ? { kind: "case", caseId, expandedCount: caseMindMap.map.expandedCount ?? 0 }
        : consultationId && activeMindMapRecord
          ? { kind: "consultation", consultationId, record: activeMindMapRecord }
          : undefined,
    [showingCaseMap, caseMindMap.map, caseId, consultationId, activeMindMapRecord],
  );
  const mindMapExpansion = useMindMapExpansion(mindMapExpansionTarget, {
    disabledReason: !isShownMapBusy
      ? undefined
      : showingCaseMap
        ? t("caseMindMap.rebuilding")
        : t("workspace.replyInProgressHint"),
  });
  // Regenerate replaces expansions too — the header's icon button asks first (MindMap's own
  // toolbar button has its inline version of the same warning).
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const mindMapExpandedCount = mindMapExpansion?.expandedCount ?? 0;

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
  const mindMapStatusLabel = showingCaseMap && caseMindMap.map
    ? isBuildingCaseMap
      ? t("caseMindMap.building")
      : [
          t("caseMindMap.fromDocuments", { count: caseMindMap.map.documentCount }),
          formatUpdatedAt(t, caseMindMap.map.generatedAt),
        ].join(" · ")
    : isGenerating
      ? t("workspace.mindMapGenerating")
      : formatUpdatedAt(t, mindMapUpdatedAt);

  // Decision Records are already-there data (this thread's own audited turns), not something to
  // generate/refresh — same "open directly" shape as Documents, not the generate-then-result-row
  // shape the other tiles use. Every prompt that produced any, grouped and dropdown-able (same
  // shared grouping Sources panel uses — see use-topic-navigator.ts's decisionGroups) — not the
  // case-wide list (that's Legal Terminal's Decisions panel, read via useCaseSnapshotQuery, left
  // untouched by this tile). Each group carries its own researchSteps (ilovelawyer-api#119's
  // persisted replay of that same turn's research/verification trace), absent when that turn made
  // no tool calls, same as everywhere else this field shows up.
  const { decisionGroups } = useTopicNavigator(consultationId);
  const decisionGroupsNewestFirst = useMemo(() => [...decisionGroups].reverse(), [decisionGroups]);
  // Newest prompt open by default, same "only an explicit toggle is stored" idiom as
  // TopicNavigatorList's own `overrides` (topic-navigator.tsx) and Sources panel's decision
  // groups (sources-panel.tsx) — kept consistent across all three so a lawyer doesn't have to
  // learn a different expand/collapse behavior per panel.
  const [decisionOverrides, setDecisionOverrides] = useState<Map<number, boolean>>(() => new Map());
  const latestDecisionPromptIndex = decisionGroups[decisionGroups.length - 1]?.promptIndex ?? null;
  const isDecisionGroupOpen = (promptIndex: number) =>
    decisionOverrides.get(promptIndex) ?? promptIndex === latestDecisionPromptIndex;
  const toggleDecisionGroup = (promptIndex: number) =>
    setDecisionOverrides((prev) => new Map(prev).set(promptIndex, !isDecisionGroupOpen(promptIndex)));

  const openStudioTile = (kind: StudioTileKind) => {
    setOpenTile(kind);
    if (!expanded) onExpandedChange(true);
    if (kind === "mindmap") onOpenMindMap?.();
    if (kind === "dataTable") onOpenDataTable?.();
    if (kind === "audioOverview") restorePlayerBar();
  };

  const createConsultation = useCreateConsultationMutation();

  // Sends the same system-driven prompt ConsultationChat's own Mind Map tab uses to trigger
  // generation (consultation-chat.tsx) — sent directly rather than routed through the embedded
  // Chat panel next door, since Studio has no way to reach into a sibling component's state.
  // ConsultationChat's `visibleMessages` filter matches on this exact string, so the turn still
  // stays hidden from the transcript regardless of which panel sent it.
  // Mind Map's generation lock and grounding are already case-scoped (AiGenerationLockSvc.run
  // keyed on caseId, not consultationId — see ilovelawyer-api's chat.service.ts), so the only
  // reason this needs a consultationId at all is that the prompt has to travel through the
  // per-consultation messages endpoint. When one isn't active yet, create it here first — same
  // pattern as ConsultationChat's own ensureConsultationId — instead of requiring the lawyer to
  // go start a chat manually before Mind Map does anything.
  const handleGenerateMindMap = useCallback(async () => {
    if (!session || isGenerating || isMindMapConsultationBusy) return;
    setIsGenerating(true);
    setGenerateError(false);
    try {
      let targetConsultationId = consultationId;
      if (!targetConsultationId) {
        const consultation = await createConsultation.mutateAsync({ caseId });
        targetConsultationId = consultation.id;
        onConsultationCreated?.(consultation.id);
      }
      await sendChatMessageAndWait(queryClient, {
        consultationId: targetConsultationId,
        sessionId: session.session_id,
        message: AUTO_MINDMAP_PROMPT,
        caseId,
      });
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(targetConsultationId) });
    } catch {
      setGenerateError(true);
    } finally {
      setIsGenerating(false);
    }
  }, [consultationId, session, isGenerating, isMindMapConsultationBusy, caseId, queryClient, createConsultation, onConsultationCreated]);

  // Regenerate whichever map is on screen: the case map is rebuilt from the documents (queued on
  // the API, progress via the "caseMindMap" AI job); a chat map by sending the prompt again.
  const regenerateShownMap = useCallback(() => {
    if (showingCaseMap) generateCaseMindMap.mutate();
    else void handleGenerateMindMap();
  }, [showingCaseMap, generateCaseMindMap, handleGenerateMindMap]);

  // Mind Map generation is request-only — no auto-fire on mount (see the matching removal in
  // consultation-chat.tsx for why: every case was showing the same generic strategy outline
  // without the lawyer having asked for it). The CTA buttons below are the only trigger now.

  // The Audio Overview lives on a consultation's messages, but the active consultation is only the
  // `?c=` URL param — leaving the case and coming back (or opening it fresh) drops it, so the
  // generated overview looked lost and had to be regenerated. Remember which consultation last
  // held this case's overview and fall back to it when the URL has none.
  const audioConsultationKey = `audio-overview-consultation:${caseId}`;
  const [storedAudioConsultationId, setStoredAudioConsultationId] = useState<string | null>(null);
  useEffect(() => {
    try {
      setStoredAudioConsultationId(localStorage.getItem(audioConsultationKey));
    } catch {
      setStoredAudioConsultationId(null);
    }
  }, [audioConsultationKey]);
  const audioConsultationId = consultationId ?? storedAudioConsultationId;

  // Script generation → Polly render polling → playable URL — shared with the Legal
  // Terminal's Audio Overview panel via useAudioOverview (lib/chat/use-audio-overview.ts).
  const {
    activeAudioOverviewMessage,
    isGeneratingScript: isGeneratingAudioOverview,
    isConsultationBusy: isAudioOverviewConsultationBusy,
    generateScriptError: audioOverviewGenerateError,
    generateScript: handleGenerateAudioOverviewScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    regenerateAudio: handleGenerateAudioOverviewAudio,
    isGeneratingAudio: generateAudioOverviewAudioPending,
  } = useAudioOverview(audioConsultationId, caseId);
  const audioOverviewMessageId = activeAudioOverviewMessage?.id;
  useEffect(() => {
    if (!audioConsultationId || !activeAudioOverviewMessage) return;
    try {
      localStorage.setItem(audioConsultationKey, audioConsultationId);
    } catch {
      // storage unavailable — fallback just won't survive a reload
    }
  }, [audioConsultationId, activeAudioOverviewMessage, audioConsultationKey]);
  const audioOverviewStatusLabel =
    isGeneratingAudioOverview || audioRendering || generateAudioOverviewAudioPending
      ? isGeneratingAudioOverview
        ? t("workspace.audioOverviewGenerating")
        : t("workspace.audioOverviewRendering")
      : formatUpdatedAt(t, activeAudioOverviewMessage?.createdAt ?? null);

  const {
    audioElement,
    isPlaying,
    playbackTime,
    playbackDuration,
    playbackRate,
    playerBarDismissed,
    dismissPlayerBar,
    restorePlayerBar,
    togglePlayback: toggleAudioOverviewPlayback,
    seek: seekAudioOverview,
    skip: skipAudioOverview,
    cycleRate: cycleAudioOverviewRate,
    formatDuration,
  } = useAudioOverviewPlayer(renderedAudioUrl, audioOverviewMessageId);

  // Playback belongs to the Audio Overview view only — leaving it (back arrow, another tile, or
  // collapsing the panel) stops the audio rather than leaving a hidden player running.
  const inAudioOverview = expanded && openTile === "audioOverview";
  useEffect(() => {
    if (!inAudioOverview) dismissPlayerBar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inAudioOverview]);

  const tileLabel =
    openTile === "documents"
      ? t("workspace.documentsTab")
      : openTile === "decisions"
        ? t("workspace.decisionsTile")
        : openTile === "mindmap"
        ? t("workspace.mindMapTile")
        : openTile === "timeline"
          ? t("workspace.timelineTile")
          : openTile === "dataTable"
            ? t("workspace.dataTableTile")
            : openTile === "audioOverview"
              ? t("workspace.audioOverviewTile")
              : openTile === "caseBrief"
                ? t("workspace.downloadCaseBrief")
                : null;

  return (
    <aside
      // `className` (default "flex") carries all display responsibility — see the prop's doc
      // comment for why an unconditional `flex` can't live here directly.
      className={`h-full min-h-0 shrink-0 flex-col border-l border-border bg-card ${
        fullWidth ? "w-full" : isResizing ? "" : "transition-[width] duration-200"
      } ${!fullWidth && !expanded ? "w-14" : ""} ${className}`}
      style={expanded && !fullWidth ? { width } : undefined}
    >
      <div
        className={`flex h-14 shrink-0 items-center gap-1 border-b border-border ${
          expanded ? "justify-between px-4" : "justify-center"
        }`}
      >
        {expanded && (
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {openTile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setOpenTile(null)}
                    aria-label={t("workspace.backToStudio")}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
        {expanded && openTile === "mindmap" && shownMindMap && (showingCaseMap || consultationId) && (
          <Popover open={regenerateConfirmOpen} onOpenChange={setRegenerateConfirmOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      // No expansions to lose: regenerate straight away, and preventDefault keeps
                      // the PopoverTrigger from opening the warning.
                      if (mindMapExpandedCount === 0) {
                        e.preventDefault();
                        regenerateShownMap();
                      }
                    }}
                    disabled={showingCaseMap ? isBuildingCaseMap : !session || isGenerating || isMindMapConsultationBusy}
                    aria-label={t("workspace.mindMapRegenerateCta")}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
                  >
                    {(showingCaseMap ? isBuildingCaseMap : isGenerating) ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="left">
                {!showingCaseMap && isMindMapConsultationBusy ? t("workspace.replyInProgressHint") : t("workspace.mindMapRegenerateCta")}
              </TooltipContent>
            </Tooltip>
            <PopoverContent side="bottom" align="end" role="alertdialog" className="w-72">
              <p className="text-[13px] leading-snug text-foreground">
                {t("mindMapExpand.regenerateWarning", { count: mindMapExpandedCount })}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRegenerateConfirmOpen(false)}
                  className="rounded-lg px-3 py-1.5 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  {t("mindMapExpand.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRegenerateConfirmOpen(false);
                    regenerateShownMap();
                  }}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700"
                >
                  {t("mindMapExpand.regenerateConfirm")}
                </button>
              </div>
            </PopoverContent>
          </Popover>
        )}
        {expanded && openTile === "timeline" && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleGenerateTimeline}
                disabled={isGeneratingTimeline}
                aria-label={t("workspace.timelineGenerateCta")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                {isGeneratingTimeline ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("workspace.timelineGenerateCta")}</TooltipContent>
          </Tooltip>
        )}
        {expanded && openTile === "audioOverview" && audioConsultationId && activeAudioOverviewMessage && (
          <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void handleGenerateAudioOverviewScript()}
                disabled={!session || isGeneratingAudioOverview || isAudioOverviewConsultationBusy}
                aria-label={t("workspace.audioOverviewGenerateCta")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
              >
                {isGeneratingAudioOverview ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">
              {isAudioOverviewConsultationBusy ? t("workspace.replyInProgressHint") : t("workspace.audioOverviewGenerateCta")}
            </TooltipContent>
          </Tooltip>
          {renderedAudioUrl && playerBarDismissed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    restorePlayerBar();
                    toggleAudioOverviewPlayback();
                  }}
                  aria-label={t("workspace.audioOverviewTile")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-gold transition-colors hover:bg-muted dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">{t("workspace.audioOverviewTile")}</TooltipContent>
            </Tooltip>
          )}
          </div>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onExpandedChange(!expanded)}
              aria-label={expanded ? t("workspace.collapseStudio") : t("workspace.expandStudio")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          {/* One column on phones (the mobile full-width Studio tab) — a 2-up grid there left
           * every tile's icon/label/note cramped. Two columns from tablet width up. */}
          <div className={expanded ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-col items-center gap-2"}>
            {/* Documents is already-there data (this case's Case Documents), not something to
             * generate/refresh — so unlike the three tiles below, this one opens the detail view
             * directly instead of triggering an action first. The spinner here is purely a status
             * signal (any row still PENDING indexing), not a disable-while-busy state like the
             * other tiles' — the tile stays clickable so the lawyer can open Documents and watch
             * individual rows flip to ready, same as Mind Map's own generating indicator. */}
            <StudioTile
              icon={isIndexingDocuments ? Loader2 : Files}
              iconSpinning={isIndexingDocuments}
              label={isIndexingDocuments ? t("workspace.documentsIndexing") : t("workspace.documentsTab")}
              note={documentsNote}
              expanded={expanded}
              onClick={() => openStudioTile("documents")}
            />
            {/* Same "already-there data, open directly" shape as Documents above — Decision
             * Records are produced automatically per legal chat turn, nothing to generate here. */}
            {hasPrompt && (<StudioTile
              icon={Scale}
              label={t("workspace.decisionsTile")}
              note={
                decisionGroups.length > 0
                  ? t("workspace.decisionsNoteCount", { count: decisionGroups.reduce((sum, g) => sum + g.records.length, 0) })
                  : undefined
              }
              expanded={expanded}
              onClick={() => openStudioTile("decisions")}
            />)}
            {/* Same "open directly" shape as Documents/Timeline/Data Table below — opens the
             * detail view if a map already exists, otherwise triggers the first generation (the
             * view itself has its own Regenerate control once something's there, same as the
             * header's regenerate button). While generating, the tile is disabled, so the only
             * way to watch it finish is the detail view already open. */}
            {/* Also shown before any chat once the case has documents (or a map built from them) —
             * the case map doesn't need a prompt. With no map yet, a click builds one from the
             * documents when there are any, else falls back to the chat-generated map. */}
            {(hasPrompt || showingCaseMap || isBuildingCaseMap || readyDocumentCount > 0) && (<StudioTile
              icon={isShownMapBusy && (isBuildingCaseMap || isGenerating) ? Loader2 : Workflow}
              iconSpinning={isBuildingCaseMap || (!showingCaseMap && isGenerating)}
              label={isBuildingCaseMap ? t("caseMindMap.building") : !showingCaseMap && isGenerating ? t("workspace.mindMapGenerating") : t("workspace.mindMapTile")}
              note={isBuildingCaseMap || (!showingCaseMap && isGenerating) ? undefined : mindMapStatusLabel || undefined}
              expanded={expanded}
              disabled={isBuildingCaseMap || (!showingCaseMap && (isGenerating || isMindMapConsultationBusy))}
              disabledHint={!showingCaseMap && isMindMapConsultationBusy ? t("workspace.replyInProgressHint") : undefined}
              onClick={() => {
                if (shownMindMap) openStudioTile("mindmap");
                else if (readyDocumentCount > 0) {
                  generateCaseMindMap.mutate();
                  openStudioTile("mindmap");
                } else void handleGenerateMindMap();
              }}
            />)}
            {/* Unlike Mind Map above, this opens the detail view directly — same "already-there
             * data" shape as Documents/Decisions — rather than triggering a generation. The tile
             * still passively reflects isGeneratingTimeline (icon spin + label) when a run is
             * already in progress, but starting one is only ever the open view's own header
             * refresh button (see studio-panel's header block for openTile === "timeline"). */}
            <StudioTile
              icon={isGeneratingTimeline ? Loader2 : Clock}
              iconSpinning={isGeneratingTimeline}
              label={isGeneratingTimeline ? t("workspace.timelineGenerating") : t("workspace.timelineTile")}
              note={
                isGeneratingTimeline
                  ? undefined
                  : timelineEventCount > 0
                    ? t("workspace.timelineEventCount", { count: timelineEventCount })
                    : undefined
              }
              expanded={expanded}
              disabled={noDocuments}
              disabledHint={noDocuments ? t("workspace.needsDocumentsHint") : undefined}
              onClick={() => openStudioTile("timeline")}
            />
            {/* Same pattern again: Witnesses/Damages/Deadlines/Findings are lawyer-entered or
             * Refresh-Analysis-populated data, not something to generate on click — so this tile
             * refetches the case snapshot in place. */}
            <StudioTile
              icon={snapshotQuery.isFetching ? Loader2 : TableIcon}
              iconSpinning={snapshotQuery.isFetching}
              label={snapshotQuery.isFetching ? t("workspace.dataTableRefreshing") : t("workspace.dataTableTile")}
              note={
                snapshotQuery.isFetching
                  ? undefined
                  : dataTableRows.length > 0
                    ? t("workspace.dataTableFactCount", { count: dataTableRows.length })
                    : undefined
              }
              expanded={expanded}
              disabled={noDocuments}
              disabledHint={t("workspace.needsDocumentsHint")}
              onClick={() => {
                void snapshotQuery.refetch();
                openStudioTile("dataTable");
              }}
            />
            {/* Same pattern as Documents/Case Brief below: opens the inline detail view directly
             * rather than generating in place first — that view still asks for an explicit
             * "Generate" click before kicking off script generation (see openTile ===
             * "audioOverview" below), so a bare tile click never silently starts a generation. */}
            {(hasPrompt || activeAudioOverviewMessage) && (<StudioTile
              icon={isGeneratingAudioOverview ? Loader2 : AudioLines}
              iconSpinning={isGeneratingAudioOverview}
              label={isGeneratingAudioOverview ? t("workspace.audioOverviewGenerating") : t("workspace.audioOverviewTile")}
              note={isGeneratingAudioOverview ? undefined : audioOverviewStatusLabel || undefined}
              expanded={expanded}
              disabled={isGeneratingAudioOverview}
              onClick={() => openStudioTile("audioOverview")}
            />)}
            {/* Same pattern as Documents above: opens the inline detail view directly rather
             * than generating in place first — CaseBriefContent handles generating the preview
             * once opened. */}
            <StudioTile
              icon={Download}
              label={t("workspace.downloadCaseBrief")}
              expanded={expanded}
              onClick={() => openStudioTile("caseBrief")}
            />
          </div>
        </div>
      )}

      {expanded && openTile && (
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {openTile === "documents" ? (
            <DocumentFolderBrowser caseId={caseId} variant="full" />
          ) : openTile === "decisions" ? (
            decisionGroupsNewestFirst.length > 0 ? (
              <div className="flex flex-col gap-2">
                {decisionGroupsNewestFirst.map((group) => {
                  const isOpen = isDecisionGroupOpen(group.promptIndex);
                  const researchStepsOpen = isResearchStepsOpen(group.promptIndex);
                  return (
                    <div key={group.promptIndex} className="rounded-md border border-border">
                      <button
                        type="button"
                        onClick={() => toggleDecisionGroup(group.promptIndex)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left"
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "" : "-rotate-90"}`}
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground" title={group.promptTitle}>
                          {group.promptTitle || "Untitled prompt"}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {t("workspace.decisionsNoteCount", { count: group.records.length })}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="flex flex-col gap-3 border-t border-border px-3 py-2.5">
                          <ul className="space-y-4">
                            {group.records.map((record, i) => (
                              <DecisionRecordCard key={record.anchor || i} payload={record} />
                            ))}
                          </ul>
                          {group.researchSteps && group.researchSteps.length > 0 && (
                            <div className="rounded-md border border-border px-3 py-2.5">
                              <button
                                type="button"
                                onClick={() => toggleResearchSteps(group.promptIndex)}
                                className="flex w-full items-center justify-between gap-2 text-left"
                              >
                                <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                                  {t("workspace.researchStepsTile")}
                                </span>
                                <ChevronDown
                                  className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${researchStepsOpen ? "" : "-rotate-90"}`}
                                  aria-hidden="true"
                                />
                              </button>
                              {researchStepsOpen && (
                                <div className="mt-2.5 border-t border-border pt-2.5">
                                  <ResearchTraceList steps={group.researchSteps} variant="replay" />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {consultationId ? t("workspace.decisionsEmpty") : t("workspace.decisionsNoConsultation")}
              </p>
            )
          ) : openTile === "caseBrief" ? (
            <CaseBriefContent caseId={caseId} />
          ) : openTile === "mindmap" ? (
            shownMindMap && (showingCaseMap || consultationId) ? (
              <div className="flex h-full flex-col gap-2">
                {(showingCaseMap ? caseMindMap.buildFailed || generateCaseMindMap.isError : generateError) && (
                  <p className="shrink-0 text-center text-xs text-red-600 dark:text-red-400">
                    {showingCaseMap ? t("caseMindMap.buildError") : t("workspace.mindMapGenerateError")}
                  </p>
                )}
                <div className="min-h-0 flex-1">
                  <MindMap
                    rootTitle={caseRecord?.caseName}
                    data={shownMindMap}
                    // Only scopes the canvas's localStorage cache (collapse state etc.) — the case
                    // map gets its own key so it never borrows a chat map's.
                    consultationId={showingCaseMap ? `case:${caseId}` : consultationId ?? undefined}
                    isStale={showingCaseMap ? snapshotQuery.data?.caseMindMap?.isStale : snapshotQuery.data?.mindMap.isStale}
                    regenerating={showingCaseMap ? isBuildingCaseMap : isGenerating}
                    onRegenerate={regenerateShownMap}
                    expansion={mindMapExpansion}
                  />
                </div>
              </div>
            ) : readyDocumentCount > 0 || isBuildingCaseMap ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                <p className="max-w-xs text-sm text-muted-foreground">
                  {isBuildingCaseMap ? t("caseMindMap.building") : t("caseMindMap.emptyWithDocuments")}
                </p>
                {isBuildingCaseMap ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
                ) : (
                  <button
                    type="button"
                    onClick={() => generateCaseMindMap.mutate()}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                  >
                    {t("caseMindMap.buildCta")}
                  </button>
                )}
                {(caseMindMap.buildFailed || generateCaseMindMap.isError) && !isBuildingCaseMap && (
                  <p className="text-xs text-red-600 dark:text-red-400">{t("caseMindMap.buildError")}</p>
                )}
              </div>
            ) : consultationId ? (
              (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {isGenerating ? t("workspace.mindMapGenerating") : t("workspace.mindMapEmpty")}
                  </p>
                  {!isGenerating && (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleGenerateMindMap()}
                        disabled={!session || isMindMapConsultationBusy}
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                      >
                        {t("workspace.mindMapGenerateCta")}
                      </button>
                      {isMindMapConsultationBusy && (
                        <p className="text-xs text-muted-foreground">{t("workspace.replyInProgressHint")}</p>
                      )}
                    </>
                  )}
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
                  {generateError && (
                    <p className="text-xs text-red-600 dark:text-red-400">{t("workspace.mindMapGenerateError")}</p>
                  )}
                  <p className="max-w-xs text-xs text-muted-foreground">{t("caseMindMap.uploadHint")}</p>
                </div>
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-muted-foreground">{t("workspace.mindMapNoConsultation")}</p>
                <p className="max-w-xs text-xs text-muted-foreground">{t("caseMindMap.uploadHint")}</p>
              </div>
            )
          ) : openTile === "timeline" ? (
            <CaseTimelineView caseId={caseId} fill hideGenerateButton />
          ) : openTile === "dataTable" ? (
            dataTableRows.length > 0 ? (
              <div className="overflow-x-auto">
                {/* Type and Detail hold short labels ("Weakness", "AI-generated") — Label holds
                 * a full paragraph. Giving all three equal footing (the previous `w-full` +
                 * min-width-floor version) meant Label's long content pushed Type and Detail
                 * down to a sliver regardless of how wide the table was allowed to get. `w-1` +
                 * `whitespace-nowrap` on the narrow columns is the standard plain-<table> trick
                 * for the opposite: with nothing constraining their width, table-layout:auto
                 * sizes each column to its own content, so a non-wrapping column's "natural"
                 * width is just its longest cell — short and predictable here — and Label (left
                 * unconstrained) absorbs whatever space is left over and wraps normally. No
                 * table-wide min-width needed; overflow-x-auto above still catches the rare
                 * genuinely-long Type/Detail value instead of crushing it. */}
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="w-1 py-2 pr-3 whitespace-nowrap">{t("workspace.dataTableColType")}</th>
                      <th className="py-2 pr-3">{t("workspace.dataTableColLabel")}</th>
                      <th className="w-1 py-2 whitespace-nowrap">{t("workspace.dataTableColDetail")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dataTableRows.map((row, i) => (
                      <tr key={i} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 align-top whitespace-nowrap text-muted-foreground">{row.type}</td>
                        <td className="py-2 pr-3 align-top text-foreground">{row.label}</td>
                        <td className="py-2 align-top whitespace-nowrap text-muted-foreground">{row.detail}</td>
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
          ) : audioConsultationId ? (
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
                  <>
                    <button
                      type="button"
                      onClick={() => void handleGenerateAudioOverviewScript()}
                      disabled={!session || isAudioOverviewConsultationBusy}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-navy-950 px-5 py-2.5 text-[13px] font-medium text-white shadow-md transition-colors hover:bg-[#162244] disabled:opacity-50"
                    >
                      {t("workspace.audioOverviewGenerateCta")}
                    </button>
                    {isAudioOverviewConsultationBusy && (
                      <p className="text-xs text-muted-foreground">{t("workspace.replyInProgressHint")}</p>
                    )}
                  </>
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

      {expanded && openTile === "audioOverview" && renderedAudioUrl && !playerBarDismissed && (
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
          onClose={dismissPlayerBar}
          formatDuration={formatDuration}
        />
      )}

      {/* One <audio> for the whole panel — not rendered with the native `controls` UI; the
       * mini player row and the detail view (both below) drive it via the shared player hook, so
       * playback started from one keeps going (and stays reflected) if you open/close the detail
       * view mid-play. */}
      {audioElement}
    </aside>
  );
}

// Read-only — same conclusion+badge header and DecisionDetailBody body as the case-level
// DecisionCard (decisions-panel.tsx) and the chat DecisionDrawer, minus dispute/annotations:
// this thread's decision hasn't necessarily been promoted into the case graph (only happens for
// case-linked consultations), so there's no case-level row here to dispute against yet.
function DecisionRecordCard({ payload }: { payload: DecisionRecordPayload }) {
  return (
    <li className="@container rounded-lg border border-border px-4 py-4">
      {/* Stacked (badge above, full-width text) below the container's own `@sm` — not the
       * viewport's — since this renders inside both the mobile Studio tab and a resizable
       * desktop panel that can be narrower than the viewport implies. Side-by-side once there's
       * room; `flex-col-reverse` keeps the badge visually first without reordering the DOM. */}
      <div className="flex flex-col-reverse items-start gap-1.5 @sm:flex-row @sm:items-start @sm:justify-between @sm:gap-3">
        <p className="leading-5 font-medium text-foreground @sm:flex-1">{payload.conclusion}</p>
        <DecisionConfidenceBadge confidence={payload.confidence} />
      </div>
      <div className="mt-3">
        <DecisionDetailBody payload={payload} />
      </div>
    </li>
  );
}

function StudioTile({
  icon: Icon,
  iconSpinning = false,
  label,
  note,
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
  /** Secondary status line under the label (e.g. "3 file(s)", "6 event(s)") — omitted when
   * there's nothing real to report yet, rather than showing a placeholder. Collapsed rail has
   * no room for it regardless. */
  note?: string;
  expanded: boolean;
  onClick?: () => void;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const tile = expanded ? (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full flex-col gap-2.5 rounded-xl border border-border p-3 text-left transition-colors enabled:hover:bg-muted dark:enabled:hover:bg-overlay-hover enabled:hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50 disabled:cursor-default"
    >
      <Icon className={`h-4 w-4 shrink-0 text-brand-gold ${iconSpinning ? "animate-spin" : ""}`} aria-hidden="true" />
      {/* w-full (not items-start's shrink-to-fit) so this wrapper is actually width-constrained
       * by the tile — otherwise min-w-0/truncate below have no smaller width to clip against,
       * and a long label like "Generating audio overview…" renders at its full natural width
       * and visually spills out of the card instead of ellipsis-truncating in place. */}
      <span className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium text-foreground">{label}</span>
        {note && <span className="truncate text-[11px] text-muted-foreground">{note}</span>}
      </span>
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-9 items-center justify-center rounded-xl border border-border px-0 py-2.5 transition-colors enabled:hover:bg-muted dark:enabled:hover:bg-overlay-hover enabled:hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 disabled:opacity-50 disabled:cursor-default"
    >
      <Icon className={`h-4 w-4 shrink-0 text-brand-gold ${iconSpinning ? "animate-spin" : ""}`} aria-hidden="true" />
    </button>
  );

  // Only wrap in a tooltip when a caller has something to say beyond what's already visible on
  // the tile itself (e.g. a busy tile's label already reads "Generating…"/"Refreshing…" — a
  // tooltip repeating that would just be a redundant, portaled duplicate that can render on top
  // of the case's own tab bar above this panel, with no boundary tying it to the panel's bounds).
  if (!disabled || !disabledHint) return tile;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{tile}</TooltipTrigger>
      <TooltipContent side={expanded ? "top" : "left"}>{disabledHint}</TooltipContent>
    </Tooltip>
  );
}
