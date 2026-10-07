import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Download, History, Loader2, Pause, Play, XCircle } from "lucide-react"
import { useAudioOverviewHistoryQuery, useRecordAudioOverviewMutation, type AudioOverviewHistoryEntry } from "@/lib/terminal/mutations"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"
import { AudioOverviewTurns } from "@/components/audio-overview/audio-overview-turns"
import { AudioOverviewWaveform } from "@/components/audio-overview/audio-overview-waveform"
import { formatClock } from "@/components/audio-overview/audio-overview-sync"
import { dateLocale } from "@/lib/i18n/date-locale"

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleString(dateLocale(), { dateStyle: "medium", timeStyle: "short" })
}

/** Fallback download name, matching the API's own audioOverviewFilename — the Content-Disposition
 * header normally supplies the real name, so this only matters when that's missing. */
function audioOverviewFallbackFilename(iso: string): string {
  return `audio-overview-${iso.slice(0, 16).replace("T", "-").replace(":", "")}.mp3`
}

type EntryState = "ready" | "rendering" | "failed" | "scriptOnly"

function entryState(entry: AudioOverviewHistoryEntry): EntryState {
  if (entry.audio) return "ready"
  if (entry.status === "IN_PROGRESS") return "rendering"
  if (entry.status === "FAILED") return "failed"
  return "scriptOnly"
}

const PILL_CLASS: Record<EntryState, string> = {
  ready: "bg-ok/12 text-ok",
  rendering: "bg-warn/12 text-warn",
  failed: "bg-danger/12 text-danger",
  scriptOnly: "bg-foreground/6 text-muted-foreground",
}

const SEEK_KEYS: Record<string, number> = { ArrowLeft: -5, ArrowRight: 5, PageDown: -10, PageUp: 10 }

/** Every Audio Overview generated for the case, newest first — the counterpart of the Case
 * Brief's history tab, loaded by scrolling (see CaseBriefHistory for why an observer rooted on
 * the scroll container rather than a Load More button). Each row plays its rendered audio and
 * expands to a waveform plus the script with Jev's verdicts. */
export function AudioOverviewHistory({ caseId }: { caseId: string }) {
  const { t } = useTranslation("case-portfolio")
  const history = useAudioOverviewHistoryQuery(caseId)
  const sentinelRef = useRef<HTMLLIElement>(null)
  const scrollContainerRef = useRef<HTMLUListElement>(null)
  // One row plays at a time — starting another pauses this one (see HistoryEntry's effect).
  const [playingId, setPlayingId] = useState<string | null>(null)
  // The newest row starts open, so the tab shows a script instead of a wall of collapsed rows.
  const [openIds, setOpenIds] = useState<Set<string> | null>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root || !history.hasNextPage) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !history.isFetchingNextPage) history.fetchNextPage()
      },
      { root, rootMargin: "100px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.hasNextPage, history.isFetchingNextPage, history.data])

  if (history.isPending) {
    return (
      <div role="status" className="flex h-full flex-col items-center justify-center gap-2.5 text-xs text-muted-foreground">
        <Loader2 className="h-5.5 w-5.5 animate-spin text-brand-gold" aria-hidden="true" />
        {t("workspace.audioOverviewHistoryLoading")}
      </div>
    )
  }
  if (history.isError) {
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-2.5 p-6 text-center">
        <XCircle className="h-5.5 w-5.5 text-danger" strokeWidth={1.8} aria-hidden="true" />
        <span className="text-[13px] text-foreground">{t("workspace.audioOverviewHistoryError")}</span>
        <span className="text-xs text-muted-foreground">{t("workspace.audioOverviewHistoryErrorHint")}</span>
        <button
          type="button"
          onClick={() => void history.refetch()}
          className="mt-1 h-7 rounded-full border border-border px-3 text-xs font-medium text-foreground transition-colors hover:border-muted-foreground"
        >
          {t("workspace.audioOverviewRetry")}
        </button>
      </div>
    )
  }
  const entries = history.data.pages.flatMap((page) => page.items)
  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2.5 p-6 text-center">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border text-muted-foreground">
          <History className="h-4.5 w-4.5" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="text-[13px] text-muted-foreground">{t("workspace.audioOverviewHistoryEmpty")}</span>
      </div>
    )
  }

  const open = openIds ?? new Set([entries[0]!.id])
  const toggleOpen = (id: string) => {
    const next = new Set(open)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setOpenIds(next)
  }

  return (
    <ul ref={scrollContainerRef} className="flex h-full min-h-0 flex-col gap-1.5 overflow-y-auto overscroll-contain px-3 pt-1 pb-3">
      <li className="flex shrink-0 items-center gap-2 pt-1.5 pb-0.5" aria-hidden="true">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{t("workspace.audioOverviewNewestFirst")}</span>
        <span className="h-px flex-1 bg-border/60" />
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {t("workspace.audioOverviewCount", { count: entries.length })}
          {history.hasNextPage ? "+" : ""}
        </span>
      </li>
      {entries.map((entry) => (
        <HistoryEntry
          key={entry.id}
          caseId={caseId}
          entry={entry}
          open={open.has(entry.id)}
          onToggleOpen={() => toggleOpen(entry.id)}
          playingId={playingId}
          onPlayingChange={setPlayingId}
        />
      ))}
      {history.hasNextPage ? (
        <li ref={sentinelRef} role="status" className="flex shrink-0 items-center justify-center gap-2 p-2.5 text-[11px] text-muted-foreground">
          {history.isFetchingNextPage && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t("workspace.audioOverviewLoadingOlder")}
            </>
          )}
        </li>
      ) : (
        <li className="shrink-0 p-2.5 text-center font-mono text-[10px] uppercase text-muted-foreground/60">
          {t("workspace.audioOverviewEndOfHistory")}
        </li>
      )}
    </ul>
  )
}

function HistoryEntry({
  caseId,
  entry,
  open,
  onToggleOpen,
  playingId,
  onPlayingChange,
}: {
  caseId: string
  entry: AudioOverviewHistoryEntry
  open: boolean
  onToggleOpen: () => void
  playingId: string | null
  onPlayingChange: (id: string | null) => void
}) {
  const { t } = useTranslation("case-portfolio")
  // The case route, not the chat one: an overview the case analysis wrote has no consultation.
  const renderAudio = useRecordAudioOverviewMutation(caseId)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  // Reactive twin of audioRef, so the waveform binds on the render after the <audio> mounts.
  const [mediaElement, setMediaElement] = useState<HTMLAudioElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const state = renderAudio.isPending ? "rendering" : entryState(entry)
  const playing = playingId === entry.id
  const label = formatEntryDate(entry.createdAt)

  useEffect(() => {
    if (!playing) audioRef.current?.pause()
  }, [playing])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }
  const seekBy = (delta: number) => {
    const audio = audioRef.current
    if (audio) audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + delta))
  }
  const render = () => renderAudio.mutate(entry.id)

  const note =
    state === "rendering"
      ? t("workspace.audioOverviewHistoryRenderingNote")
      : state === "failed"
        ? t("workspace.audioOverviewRenderError")
        : t("workspace.audioOverviewHistoryScriptOnlyNote")

  return (
    <li
      className={`shrink-0 rounded-lg border transition-colors ${playing ? "border-ok/45 bg-ok/5" : "border-border"}`}
    >
      <div className="flex items-center gap-2 py-2 pr-2 pl-2.5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!entry.audio}
          aria-label={t(playing ? "workspace.audioOverviewPauseEntry" : "workspace.audioOverviewPlayEntry", { date: label })}
          className={`flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-35 ${
            playing ? "border-ok bg-ok text-background" : "border-border text-foreground"
          }`}
        >
          {playing ? <Pause className="h-3 w-3 fill-current" aria-hidden="true" /> : <Play className="ml-px h-3 w-3 fill-current" aria-hidden="true" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate font-mono text-[11px] text-foreground">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {entry.audio ? `${formatClock(currentTime)} / ${formatClock(duration)}` : "--:-- / --:--"}
          </span>
        </div>
        <span
          className={`inline-flex h-4.5 shrink-0 items-center rounded-full px-1.75 text-[9.5px] font-semibold uppercase tracking-[0.08em] whitespace-nowrap ${PILL_CLASS[state]}`}
        >
          {t(`workspace.audioOverviewStatus.${state}`)}
        </span>
        <button
          type="button"
          onClick={() => entry.audio && triggerBriefDownload(entry.audio.fileUrl, audioOverviewFallbackFilename(entry.createdAt))}
          disabled={!entry.audio}
          aria-label={t("workspace.audioOverviewDownloadEntry", { date: label })}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35 dark:hover:bg-overlay-hover"
        >
          <Download className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-label={open ? t("workspace.audioOverviewHistoryHideScript") : t("workspace.audioOverviewHistoryShowScript")}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {entry.audio && (
        <audio
          ref={(el) => {
            audioRef.current = el
            setMediaElement(el)
          }}
          src={entry.audio.fileUrl}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => onPlayingChange(entry.id)}
          onPause={() => onPlayingChange(playing ? null : playingId)}
          onEnded={() => onPlayingChange(null)}
        />
      )}
      {open && (
        <div className="flex flex-col gap-2.5 border-t border-border/60 px-2.5 pt-0.5 pb-3">
          {entry.audio ? (
            <div className="flex flex-col gap-1 pt-2">
              <div
                role="slider"
                tabIndex={0}
                aria-label={t("workspace.audioOverviewSeekEntry", { date: label })}
                aria-valuemin={0}
                aria-valuemax={Math.floor(duration)}
                aria-valuenow={Math.floor(currentTime)}
                onKeyDown={(e) => {
                  const delta = SEEK_KEYS[e.key]
                  if (delta !== undefined) {
                    e.preventDefault()
                    seekBy(delta)
                  } else if (e.key === " ") {
                    e.preventDefault()
                    togglePlay()
                  }
                }}
                className="rounded"
              >
                <AudioOverviewWaveform url={entry.audio.fileUrl} mediaElement={mediaElement} scheme="history" className="h-8.5" />
              </div>
              <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{formatClock(currentTime)}</span>
                <span>{formatClock(duration)}</span>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-2 pt-2 text-xs ${state === "failed" ? "text-danger" : "text-muted-foreground"}`}>
              <span className="min-w-0 flex-1">{note}</span>
              {(state === "failed" || state === "scriptOnly") && (
                <button
                  type="button"
                  onClick={render}
                  className="h-6 shrink-0 rounded-full border border-border px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground"
                >
                  {state === "failed" ? t("workspace.audioOverviewTryAgain") : t("workspace.audioOverviewRenderAudio")}
                </button>
              )}
            </div>
          )}
          <AudioOverviewTurns turns={entry.turns} checks={entry.checks} turnTimings={entry.turnTimings} />
        </div>
      )}
    </li>
  )
}
