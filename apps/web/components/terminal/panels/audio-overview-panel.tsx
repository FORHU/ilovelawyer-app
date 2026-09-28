import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Volume2 } from "lucide-react"
import { AudioOverviewPlayerBar } from "@/components/audio-overview-player"
import { useConsultationsQuery } from "@/lib/chat/mutations"
import { useAudioOverview } from "@/lib/chat/use-audio-overview"
import { useAudioOverviewPlayer } from "@/lib/chat/use-audio-overview-player"
import { AudioOverviewHistory } from "@/components/audio-overview/audio-overview-history"
import { AudioOverviewViewTabs, type AudioOverviewView } from "@/components/audio-overview/audio-overview-view-tabs"
import { AudioOverviewTurns } from "@/components/audio-overview/audio-overview-turns"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, primaryBtnClass } from "@/components/terminal/panel-kit"

// Not to be confused with CaseReconstructionPanel's audio (a single narrator reading Polly's
// OutputUri directly) — this is the two-host podcast-style script from useAudioOverview (shared
// with Case Workspace's Studio panel), driven off whichever consultation is most recently
// active for this case, the same "isolated" resolution ConsultationChat does internally for
// ChatPanel/MindMapPanel above. Uses the same docked AudioOverviewPlayerBar as Studio (see
// use-audio-overview-player.tsx) instead of a plain native <audio controls> — the two surfaces
// used to ship two different player UIs for the same data.
export function AudioOverviewPanel({ caseId }: { caseId: string }) {
  const [view, setView] = useState<AudioOverviewView>("current")

  // The current view stays mounted (just hidden) while History is open, so the player's <audio>
  // element — and whatever is playing — survives a tab switch.
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <AudioOverviewViewTabs view={view} onChange={setView} />
      <div className={view === "current" ? "min-h-0 flex-1" : "hidden"}>
        <AudioOverviewCurrent caseId={caseId} />
      </div>
      {view === "history" && (
        <div className="min-h-0 flex-1 px-1 pb-1">
          <AudioOverviewHistory caseId={caseId} />
        </div>
      )}
    </div>
  )
}

function AudioOverviewCurrent({ caseId }: { caseId: string }) {
  const { t } = useTranslation(["terminal", "case-portfolio"])
  const { data: caseConsultations } = useConsultationsQuery(caseId)
  const consultationId = caseConsultations?.[0]?.id ?? null
  const {
    activeAudioOverviewMessage,
    isGeneratingScript,
    isConsultationBusy,
    generateScriptError,
    generateScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    isGeneratingAudio,
  } = useAudioOverview(consultationId, caseId)
  const audioOverviewMessageId = activeAudioOverviewMessage?.id
  const {
    audioElement,
    isPlaying,
    playbackTime,
    playbackDuration,
    playbackRate,
    playerBarDismissed,
    dismissPlayerBar,
    togglePlayback,
    seek,
    skip,
    cycleRate,
    formatDuration,
  } = useAudioOverviewPlayer(renderedAudioUrl, audioOverviewMessageId)

  if (!consultationId) {
    return (
      <PanelBody gap="4">
        <EmptyNote>
          {t("case-portfolio:workspace.audioOverviewNoConsultation")}
        </EmptyNote>
      </PanelBody>
    )
  }

  if (!activeAudioOverviewMessage) {
    return (
      <PanelBody gap="4">
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <Volume2
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="max-w-xs text-muted-foreground">
            {isGeneratingScript
              ? t("case-portfolio:workspace.audioOverviewGenerating")
              : t("case-portfolio:workspace.audioOverviewEmpty")}
          </p>
          {isGeneratingScript ? (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <button
              type="button"
              onClick={() => void generateScript()}
              disabled={isConsultationBusy}
              className={primaryBtnClass}
            >
              {t("case-portfolio:workspace.audioOverviewGenerateCta")}
            </button>
          )}
          {!isGeneratingScript && isConsultationBusy && (
            <p className="text-xs text-muted-foreground">
              {t("case-portfolio:workspace.replyInProgressHint")}
            </p>
          )}
          {generateScriptError && (
            <p className="text-xs text-danger">
              {t("case-portfolio:workspace.audioOverviewGenerateError")}
            </p>
          )}
        </div>
      </PanelBody>
    )
  }

  const rendering = audioRendering || isGeneratingAudio

  return (
    <PanelBody gap="4">
      {audioRenderError && (
        <p className="text-center text-xs text-danger">
          {t("case-portfolio:workspace.audioOverviewRenderError")}
        </p>
      )}
      {!renderedAudioUrl && (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          {rendering && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {rendering
            ? t("case-portfolio:workspace.audioOverviewRendering")
            : null}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-1">
          <AudioOverviewTurns
            turns={activeAudioOverviewMessage.audioOverview?.turns ?? []}
            checks={activeAudioOverviewMessage.audioOverview?.checks}
          />
        </div>
      </div>
      {renderedAudioUrl && !playerBarDismissed && (
        <AudioOverviewPlayerBar
          title={t("case-portfolio:workspace.audioOverviewTile")}
          isPlaying={isPlaying}
          currentTime={playbackTime}
          duration={playbackDuration}
          playbackRate={playbackRate}
          onTogglePlay={togglePlayback}
          onSeek={seek}
          onSkip={skip}
          onCycleRate={cycleRate}
          onClose={dismissPlayerBar}
          formatDuration={formatDuration}
        />
      )}
      {audioElement}
    </PanelBody>
  )
}
