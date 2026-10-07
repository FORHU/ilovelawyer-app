import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Volume2, XCircle } from "lucide-react"
import { AudioOverviewPlayerBar } from "@/components/audio-overview-player"
import { useAudioOverviewPlayer } from "@/lib/chat/use-audio-overview-player"
import {
  useLatestAudioOverviewQuery,
  usePaneRegenerate,
  useRecordAudioOverviewMutation,
  type AudioOverviewHistoryEntry,
} from "@/lib/terminal/mutations"
import { PaneUpdatingNote, RegenerateButton } from "@/components/terminal/panel-kit"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"
import { AudioOverviewHistory } from "@/components/audio-overview/audio-overview-history"
import { AudioOverviewViewTabs, type AudioOverviewView } from "@/components/audio-overview/audio-overview-view-tabs"
import {
  AudioOverviewTranscript,
  FullScriptToggle,
  useFullScriptPreference,
} from "@/components/audio-overview/audio-overview-transcript"
import { activeTurnIndex, hasUsableTimings, hostBands } from "@/components/audio-overview/audio-overview-sync"
import { dateLocale } from "@/lib/i18n/date-locale"

// Not to be confused with CaseReconstructionPanel's audio (a single narrator reading Polly's
// OutputUri directly) — this is the two-host podcast-style overview. It shows the case's newest
// one from either source (useLatestAudioOverviewQuery): the one the case analysis writes on every
// run, or one a lawyer asked for in chat or Studio. Its own Regenerate writes a new case-owned
// overview and records it (usePaneRegenerate "audioOverview"), held back while the case analysis
// runs; the recording action covers an overview whose recording failed (or a chat-made script that
// was never recorded). Uses the same docked AudioOverviewPlayerBar as
// Studio (see use-audio-overview-player.tsx) and the same synced AudioOverviewTranscript.
/** Below this panel height the player switches to its compact layout and the chrome tightens —
 * a terminal tile is often a fraction of the screen, where the roomy Studio layout left the
 * script a single line. Measured, not a viewport breakpoint: tiles resize independently. */
const COMPACT_BELOW_PX = 560
/** Below this panel width the toolbar sheds the caption. */
const CAPTION_BELOW_PX = 560

function usePanelSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return { ref, size }
}

export function AudioOverviewPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("case-portfolio")
  const [view, setView] = useState<AudioOverviewView>("current")
  const { ref: panelRef, size } = usePanelSize()
  const compact = size !== null && size.height < COMPACT_BELOW_PX
  const showCaption = size === null || size.width >= CAPTION_BELOW_PX
  const [fullScript, setFullScript] = useFullScriptPreference()
  const latest = useLatestAudioOverviewQuery(caseId)
  const overview = latest.data ?? null
  const regen = usePaneRegenerate(caseId, "audioOverview")
  // A new overview is being written: by this analysis run (wave 3), this pane's Regenerate, or a
  // chat/Studio request (all hold the same "audioOverviewScript" job).
  const updating = regen.busy || latest.isWritingScript
  const turns = overview?.turns ?? []
  const synced = !!overview?.audio && hasUsableTimings(overview.turnTimings, turns.length)
  const caption = overview
    ? t("workspace.audioOverviewCaption", {
        date: new Date(overview.createdAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }),
        count: turns.length,
      })
    : ""
  const showsScript = view === "current" && !!overview

  // The current view stays mounted (just hidden) while History is open, so the player's <audio>
  // element — and whatever is playing — survives a tab switch.
  return (
    <div ref={panelRef} data-panel-scroll className="flex h-full min-h-0 flex-col text-[13px] text-foreground">
      <div className={`flex shrink-0 flex-wrap items-center gap-2 px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <AudioOverviewViewTabs view={view} onChange={setView} />
        {showsScript && showCaption ? (
          <span title={caption} className="min-w-0 flex-1 truncate px-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
            {caption}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {showsScript && synced && <FullScriptToggle fullScript={fullScript} onChange={setFullScript} />}
        {view === "current" && <RegenerateButton regen={regen} label={overview ? undefined : t("workspace.audioOverviewGenerateCta")} />}
      </div>
      {updating && view === "current" ? (
        <div className="shrink-0 px-3 pb-1.5">
          <PaneUpdatingNote>{t("workspace.audioOverviewUpdating")}</PaneUpdatingNote>
        </div>
      ) : null}
      <div className={view === "current" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <AudioOverviewCurrent
          caseId={caseId}
          overview={overview}
          loading={latest.isLoading}
          compact={compact}
          caption={caption}
          fullScript={fullScript}
        />
      </div>
      {view === "history" && (
        <div className="min-h-0 flex-1 border-t border-border/60">
          <AudioOverviewHistory caseId={caseId} />
        </div>
      )}
    </div>
  )
}

function CenteredState({ children, status }: { children: ReactNode; status?: boolean }) {
  return (
    <div
      role={status ? "status" : undefined}
      className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 border-t border-border/60 p-6 text-center"
    >
      {children}
    </div>
  )
}

function AudioOverviewCurrent({
  caseId,
  overview,
  loading,
  compact,
  caption,
  fullScript,
}: {
  caseId: string
  overview: AudioOverviewHistoryEntry | null
  loading: boolean
  compact: boolean
  caption: string
  fullScript: boolean
}) {
  const { t } = useTranslation("case-portfolio")
  const record = useRecordAudioOverviewMutation(caseId)
  const renderedAudioUrl = overview?.audio?.fileUrl ?? null
  const {
    audioElement,
    mediaElement,
    isPlaying,
    playbackTime,
    playbackDuration,
    playbackRate,
    playerBarDismissed,
    dismissPlayerBar,
    restorePlayerBar,
    togglePlayback,
    seek,
    skip,
    cycleRate,
    formatDuration,
  } = useAudioOverviewPlayer(renderedAudioUrl, overview?.id)

  if (loading) {
    return (
      <CenteredState status>
        <Loader2 className="h-5 w-5 animate-spin text-progress motion-reduce:animate-none" aria-hidden="true" />
        {audioElement}
      </CenteredState>
    )
  }

  if (!overview) {
    return (
      <CenteredState>
        <EmptyIcon />
        <p className="max-w-70 font-serif text-base leading-snug text-pretty">{t("workspace.audioOverviewAutoEmpty")}</p>
        <p className="max-w-67.5 text-xs leading-normal text-muted-foreground text-pretty">{t("workspace.audioOverviewAutoEmptyHint")}</p>
        {audioElement}
      </CenteredState>
    )
  }

  const turns = overview.turns
  const turnTimings = overview.turnTimings
  const status = overview.status
  const recording = record.isPending || (!renderedAudioUrl && status === "IN_PROGRESS")
  const recordFailed = !recording && !renderedAudioUrl && (record.isError || status === "FAILED")
  // A script nobody recorded yet: one a lawyer asked for in chat and never rendered.
  const scriptOnly = !recording && !recordFailed && !renderedAudioUrl && status === null
  const timed = !!renderedAudioUrl && hasUsableTimings(turnTimings, turns.length)
  const position = timed
    ? `${String(activeTurnIndex(playbackTime, turnTimings!) + 1).padStart(2, "0")} / ${String(turns.length).padStart(2, "0")}`
    : undefined

  const notice = recording ? (
    <div
      role="status"
      className="mx-3 mt-2.5 flex shrink-0 items-center gap-2 rounded-md border border-progress/40 bg-progress/10 px-3 py-2 text-xs font-medium text-progress"
    >
      <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      {t("workspace.audioOverviewRecording")}
      <span className="ml-auto font-mono text-[10px] text-muted-foreground/70">{t("workspace.audioOverviewScriptReady")}</span>
    </div>
  ) : recordFailed || scriptOnly ? (
    <div
      role={recordFailed ? "alert" : undefined}
      className={`mx-3 mt-2.5 flex shrink-0 items-center gap-2 rounded-md border py-2 pr-2 pl-3 text-xs ${
        recordFailed ? "border-danger bg-danger/7 text-danger" : "border-border text-muted-foreground"
      }`}
    >
      {recordFailed && <XCircle className="h-3.25 w-3.25 shrink-0" strokeWidth={2.2} aria-hidden="true" />}
      {recordFailed ? t("workspace.audioOverviewRenderError") : t("workspace.audioOverviewHistoryScriptOnlyNote")}
      <button
        type="button"
        onClick={() => record.mutate(overview.id)}
        className={`ml-auto h-6 shrink-0 rounded-full border bg-transparent px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
          recordFailed ? "border-danger text-danger" : "border-border text-foreground"
        }`}
      >
        {recordFailed ? t("workspace.audioOverviewRetryRecording") : t("workspace.audioOverviewRenderAudio")}
      </button>
    </div>
  ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <AudioOverviewTranscript
        compact={compact}
        turns={turns}
        checks={overview.checks}
        turnTimings={turnTimings}
        sentenceTimings={overview.sentenceTimings}
        wordTimings={overview.wordTimings}
        currentTime={playbackTime}
        duration={playbackDuration}
        onSeek={renderedAudioUrl ? seek : undefined}
        caption={caption}
        notice={notice}
        fullScript={fullScript}
        hideCaptionBar
      />
      {renderedAudioUrl &&
        (playerBarDismissed ? (
          <div className="flex shrink-0 items-center gap-2 border-t border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground">
              {t("workspace.audioOverviewPlayerHidden", { elapsed: formatDuration(playbackTime), total: formatDuration(playbackDuration) })}
            </span>
            <button
              type="button"
              onClick={restorePlayerBar}
              className="ml-auto h-6.5 rounded-full border border-border px-2.5 text-xs font-medium text-foreground"
            >
              {t("workspace.audioOverviewShowPlayer")}
            </button>
          </div>
        ) : (
          <AudioOverviewPlayerBar
            compact={compact}
            title={t("workspace.audioOverviewTile")}
            position={position}
            bands={hostBands(turns, turnTimings, playbackDuration)}
            hostALabel="A"
            hostBLabel="B"
            isPlaying={isPlaying}
            currentTime={playbackTime}
            duration={playbackDuration}
            playbackRate={playbackRate}
            onTogglePlay={togglePlayback}
            onSeek={seek}
            onSkip={skip}
            onCycleRate={cycleRate}
            onClose={dismissPlayerBar}
            onDownload={() => triggerBriefDownload(renderedAudioUrl, "audio-overview.mp3")}
            waveformUrl={renderedAudioUrl}
            waveformMedia={mediaElement}
            formatDuration={formatDuration}
          />
        ))}
      {audioElement}
    </div>
  )
}

function EmptyIcon() {
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-brand-gold">
      <Volume2 className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
    </span>
  )
}
