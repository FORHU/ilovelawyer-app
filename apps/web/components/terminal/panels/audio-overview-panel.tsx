import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw, Volume2, XCircle } from "lucide-react"
import { AudioOverviewPlayerBar } from "@/components/audio-overview-player"
import { useConsultationsQuery } from "@/lib/chat/mutations"
import { useAudioOverview } from "@/lib/chat/use-audio-overview"
import { useAudioOverviewPlayer } from "@/lib/chat/use-audio-overview-player"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"
import { AudioOverviewHistory } from "@/components/audio-overview/audio-overview-history"
import { AudioOverviewViewTabs, type AudioOverviewView } from "@/components/audio-overview/audio-overview-view-tabs"
import {
  AudioOverviewTranscript,
  FullScriptToggle,
  useFullScriptPreference,
} from "@/components/audio-overview/audio-overview-transcript"
import { AudioOverviewGenerationSteps } from "@/components/audio-overview/audio-overview-generation-steps"
import { activeTurnIndex, hasUsableTimings, hostBands } from "@/components/audio-overview/audio-overview-sync"
import { dateLocale } from "@/lib/i18n/date-locale"

// Not to be confused with CaseReconstructionPanel's audio (a single narrator reading Polly's
// OutputUri directly) — this is the two-host podcast-style script from useAudioOverview (shared
// with Case Workspace's Studio panel), driven off whichever consultation is most recently
// active for this case, the same "isolated" resolution ConsultationChat does internally for
// ChatPanel/MindMapPanel above. Uses the same docked AudioOverviewPlayerBar as Studio (see
// use-audio-overview-player.tsx) and the same synced AudioOverviewTranscript.
/** Below this panel height the player switches to its compact layout and the chrome tightens —
 * a terminal tile is often a fraction of the screen, where the roomy Studio layout left the
 * script a single line. Measured, not a viewport breakpoint: tiles resize independently. */
const COMPACT_BELOW_PX = 560
/** Below these panel widths the toolbar sheds the caption, then Regenerate's label. */
const CAPTION_BELOW_PX = 560
const ICON_ONLY_BELOW_PX = 400

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
  const iconOnly = size !== null && size.width < ICON_ONLY_BELOW_PX
  const [fullScript, setFullScript] = useFullScriptPreference()
  const { data: caseConsultations } = useConsultationsQuery(caseId)
  const consultationId = caseConsultations?.[0]?.id ?? null
  const overview = useAudioOverview(consultationId, caseId)
  const { activeAudioOverviewMessage, isGeneratingScript, isConsultationBusy, generateScript } = overview
  const canRegenerate = view === "current" && !!activeAudioOverviewMessage
  // The script's own caption row (date · turns, Full script) is folded into this toolbar, so a
  // short tile spends one row on chrome instead of two.
  const showsScript = canRegenerate && !isGeneratingScript
  const turns = activeAudioOverviewMessage?.audioOverview?.turns ?? []
  const synced = !!overview.renderedAudioUrl && hasUsableTimings(activeAudioOverviewMessage?.audioOverview?.turnTimings, turns.length)
  const caption = activeAudioOverviewMessage
    ? t("workspace.audioOverviewCaption", {
        date: new Date(activeAudioOverviewMessage.createdAt).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" }),
        count: turns.length,
      })
    : ""

  // The current view stays mounted (just hidden) while History is open, so the player's <audio>
  // element — and whatever is playing — survives a tab switch.
  return (
    <div ref={panelRef} data-panel-scroll className="flex h-full min-h-0 flex-col text-[13px] text-foreground">
      <div className={`flex shrink-0 items-center gap-2 px-3 ${compact ? "py-1.5" : "py-2"}`}>
        <AudioOverviewViewTabs view={view} onChange={setView} />
        {showsScript && showCaption ? (
          <span title={caption} className="min-w-0 flex-1 truncate px-1 font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">
            {caption}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        {showsScript && synced && <FullScriptToggle fullScript={fullScript} onChange={setFullScript} />}
        {canRegenerate && (
          <button
            type="button"
            onClick={() => void generateScript()}
            disabled={isGeneratingScript || isConsultationBusy}
            title={
              isConsultationBusy
                ? t("workspace.replyInProgressHint")
                : isGeneratingScript
                  ? t("workspace.audioOverviewGenerating")
                  : t("workspace.audioOverviewRegenerateHint")
            }
            aria-label={iconOnly ? t("workspace.audioOverviewRegenerate") : undefined}
            className={`inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:border-muted-foreground disabled:opacity-45 ${
              iconOnly ? "w-7" : "px-3"
            }`}
          >
            {isGeneratingScript ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            {!iconOnly && (isGeneratingScript ? t("workspace.audioOverviewGeneratingShort") : t("workspace.audioOverviewRegenerate"))}
          </button>
        )}
      </div>
      <div className={view === "current" ? "flex min-h-0 flex-1 flex-col" : "hidden"}>
        <AudioOverviewCurrent consultationId={consultationId} overview={overview} compact={compact} caption={caption} fullScript={fullScript} />
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
  consultationId,
  overview,
  compact,
  caption,
  fullScript,
}: {
  consultationId: string | null
  overview: ReturnType<typeof useAudioOverview>
  compact: boolean
  caption: string
  fullScript: boolean
}) {
  const { t } = useTranslation("case-portfolio")
  const {
    activeAudioOverviewMessage,
    isGeneratingScript,
    scriptStep,
    isConsultationBusy,
    generateScriptError,
    generateScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    regenerateAudio,
    isGeneratingAudio,
  } = overview
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
  } = useAudioOverviewPlayer(renderedAudioUrl, activeAudioOverviewMessage?.id)

  if (!consultationId) {
    return (
      <CenteredState>
        <EmptyIcon />
        <p className="max-w-70 font-serif text-base leading-snug text-pretty">{t("workspace.audioOverviewNoConsultation")}</p>
      </CenteredState>
    )
  }

  if (isGeneratingScript) {
    return (
      <CenteredState status>
        <Loader2 className="h-5.5 w-5.5 animate-spin text-brand-gold" aria-hidden="true" />
        <p className="font-serif text-base">{t("workspace.audioOverviewGenerating")}</p>
        <p className="max-w-67.5 text-xs leading-normal text-muted-foreground text-pretty">{t("workspace.audioOverviewGeneratingHint")}</p>
        <AudioOverviewGenerationSteps step={scriptStep ?? 0} />
        {audioElement}
      </CenteredState>
    )
  }

  if (!activeAudioOverviewMessage) {
    return (
      <CenteredState>
        <EmptyIcon />
        <p className="max-w-70 font-serif text-base leading-snug text-pretty">{t("workspace.audioOverviewEmpty")}</p>
        <p className="max-w-67.5 text-xs leading-normal text-muted-foreground text-pretty">{t("workspace.audioOverviewEmptyHint")}</p>
        <button
          type="button"
          onClick={() => void generateScript()}
          disabled={isConsultationBusy}
          title={isConsultationBusy ? t("workspace.replyInProgressHint") : undefined}
          className="mt-1 inline-flex h-8 items-center gap-2 rounded-md bg-brand-gold px-3.5 text-[10px] font-semibold uppercase tracking-widest text-brand-gold-foreground transition-[filter] hover:brightness-110 disabled:opacity-45"
        >
          <Volume2 className="h-3.25 w-3.25" aria-hidden="true" />
          {t("workspace.audioOverviewGenerateCta")}
        </button>
        {isConsultationBusy && <p className="text-xs text-muted-foreground">{t("workspace.replyInProgressHint")}</p>}
        {generateScriptError && <p className="text-xs text-danger">{t("workspace.audioOverviewGenerateError")}</p>}
      </CenteredState>
    )
  }

  const audio = activeAudioOverviewMessage.audioOverview
  const turns = audio?.turns ?? []
  const turnTimings = audio?.turnTimings
  const status = audio?.audioStatus ?? null
  const rendering = audioRendering || isGeneratingAudio || (!renderedAudioUrl && status === "IN_PROGRESS")
  const renderFailed = !rendering && !renderedAudioUrl && (audioRenderError || status === "FAILED")
  const scriptOnly = !rendering && !renderFailed && !renderedAudioUrl && status === null
  const timed = !!renderedAudioUrl && hasUsableTimings(turnTimings, turns.length)
  const position = timed
    ? `${String(activeTurnIndex(playbackTime, turnTimings!) + 1).padStart(2, "0")} / ${String(turns.length).padStart(2, "0")}`
    : undefined

  const notice = rendering ? (
    <div role="status" className="mx-3 mt-2.5 flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
      <Loader2 className="h-3 w-3 animate-spin text-warn" aria-hidden="true" />
      {t("workspace.audioOverviewRendering")}
      <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">{t("workspace.audioOverviewScriptReady")}</span>
    </div>
  ) : renderFailed || scriptOnly ? (
    <div
      role={renderFailed ? "alert" : undefined}
      className={`mx-3 mt-2.5 flex shrink-0 items-center gap-2 rounded-md border py-2 pr-2 pl-3 text-xs ${
        renderFailed ? "border-danger bg-danger/7 text-danger" : "border-border text-muted-foreground"
      }`}
    >
      {renderFailed && <XCircle className="h-3.25 w-3.25 shrink-0" strokeWidth={2.2} aria-hidden="true" />}
      {renderFailed ? t("workspace.audioOverviewRenderError") : t("workspace.audioOverviewHistoryScriptOnlyNote")}
      <button
        type="button"
        onClick={regenerateAudio}
        className={`ml-auto h-6 shrink-0 rounded-full border bg-transparent px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${
          renderFailed ? "border-danger text-danger" : "border-border text-foreground"
        }`}
      >
        {renderFailed ? t("workspace.audioOverviewTryAgain") : t("workspace.audioOverviewRenderAudio")}
      </button>
    </div>
  ) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {(generateScriptError || isConsultationBusy) && (
        <p className={`shrink-0 px-3 pb-2 text-xs ${generateScriptError ? "text-danger" : "text-muted-foreground"}`}>
          {generateScriptError ? t("workspace.audioOverviewGenerateError") : t("workspace.replyInProgressHint")}
        </p>
      )}
      <AudioOverviewTranscript
        compact={compact}
        turns={turns}
        checks={audio?.checks}
        turnTimings={turnTimings}
        sentenceTimings={audio?.sentenceTimings}
        wordTimings={audio?.wordTimings}
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
