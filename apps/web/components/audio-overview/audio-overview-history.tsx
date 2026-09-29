import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Download, Loader2, Pause, Play } from "lucide-react"
import { useAudioOverviewHistoryQuery, type AudioOverviewHistoryEntry } from "@/lib/terminal/mutations"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"
import { AudioOverviewTurns } from "@/components/audio-overview/audio-overview-turns"

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

type EntryState = "ready" | "rendering" | "failed" | "scriptOnly"

function entryState(entry: AudioOverviewHistoryEntry): EntryState {
  if (entry.audio) return "ready"
  if (entry.status === "IN_PROGRESS") return "rendering"
  if (entry.status === "FAILED") return "failed"
  return "scriptOnly"
}

const PILL_CLASS: Record<EntryState, string> = {
  ready: "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
  rendering: "border-amber-500/60 bg-amber-500/10 text-amber-400",
  failed: "border-red-500/60 bg-red-500/10 text-red-400",
  scriptOnly: "border-border bg-muted/30 text-muted-foreground",
}

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
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("workspace.audioOverviewHistoryLoading")}
      </div>
    )
  }
  if (history.isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {t("workspace.audioOverviewHistoryError")}
      </div>
    )
  }
  const entries = history.data.pages.flatMap((page) => page.items)
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        {t("workspace.audioOverviewHistoryEmpty")}
      </div>
    )
  }

  return (
    <ul ref={scrollContainerRef} className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      {entries.map((entry) => (
        <HistoryEntry key={entry.id} entry={entry} playingId={playingId} onPlayingChange={setPlayingId} />
      ))}
      {history.hasNextPage && (
        <li ref={sentinelRef} className="flex shrink-0 items-center justify-center py-2" aria-hidden="true">
          {history.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </li>
      )}
    </ul>
  )
}

function HistoryEntry({
  entry,
  playingId,
  onPlayingChange,
}: {
  entry: AudioOverviewHistoryEntry
  playingId: string | null
  onPlayingChange: (id: string | null) => void
}) {
  const { t } = useTranslation("case-portfolio")
  const [open, setOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)
  const state = entryState(entry)
  const playing = playingId === entry.id

  useEffect(() => {
    if (!playing) audioRef.current?.pause()
  }, [playing])

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) void audio.play()
    else audio.pause()
  }

  const seekTo = (fraction: number) => {
    const audio = audioRef.current
    if (audio && duration) audio.currentTime = fraction * duration
  }

  return (
    <li
      className={`rounded-lg border transition-colors ${
        playing ? "border-emerald-500/50 bg-emerald-500/5" : "border-border bg-card"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button
          type="button"
          onClick={togglePlay}
          disabled={!entry.audio}
          aria-label={playing ? t("workspace.audioOverviewPause") : t("workspace.audioOverviewPlay")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-brand-gold transition-colors hover:bg-muted/40 disabled:opacity-40"
        >
          {playing ? <Pause className="h-3.5 w-3.5" aria-hidden="true" /> : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
        </button>
        <p className="min-w-0 flex-1 truncate font-mono text-[13px] font-semibold text-foreground">
          {formatEntryDate(entry.createdAt)}
        </p>
        {entry.audio && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {formatClock(currentTime)} / {formatClock(duration)}
          </span>
        )}
        <span
          className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${PILL_CLASS[state]}`}
        >
          {t(`workspace.audioOverviewStatus.${state}`)}
        </span>
        {entry.audio && (
          <button
            type="button"
            onClick={() => entry.audio && triggerBriefDownload(entry.audio.fileUrl, "audio-overview.mp3")}
            aria-label={t("workspace.audioOverviewDownload")}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("workspace.audioOverviewHistoryHideScript") : t("workspace.audioOverviewHistoryShowScript")}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {entry.audio && (
        <audio
          ref={audioRef}
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
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          {entry.audio && (
            <Waveform url={entry.audio.fileUrl} progress={duration ? currentTime / duration : 0} onSeek={seekTo} />
          )}
          <AudioOverviewTurns turns={entry.turns} checks={entry.checks} />
        </div>
      )}
    </li>
  )
}

const WAVEFORM_BARS = 96

/** Peak-per-bucket amplitudes of the rendered audio, decoded in the browser (there's no stored
 * waveform). Null while loading or if the file can't be fetched/decoded — the caller then shows
 * a plain progress bar rather than an invented shape. */
function useWaveformPeaks(url: string): number[] | null {
  const [peaks, setPeaks] = useState<number[] | null>(null)
  useEffect(() => {
    let cancelled = false
    const ctx = new AudioContext()
    fetch(url, { credentials: "include" })
      .then((res) => res.arrayBuffer())
      .then((buf) => ctx.decodeAudioData(buf))
      .then((decoded) => {
        const data = decoded.getChannelData(0)
        const size = Math.max(1, Math.floor(data.length / WAVEFORM_BARS))
        const out: number[] = []
        for (let i = 0; i < WAVEFORM_BARS; i++) {
          let max = 0
          for (let j = i * size; j < Math.min(data.length, (i + 1) * size); j++) max = Math.max(max, Math.abs(data[j]!))
          out.push(max)
        }
        const top = Math.max(...out, 0.01)
        if (!cancelled) setPeaks(out.map((p) => p / top))
      })
      .catch(() => {
        if (!cancelled) setPeaks(null)
      })
    return () => {
      cancelled = true
      void ctx.close()
    }
  }, [url])
  return peaks
}

function Waveform({ url, progress, onSeek }: { url: string; progress: number; onSeek: (fraction: number) => void }) {
  const peaks = useWaveformPeaks(url)
  return (
    <div
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      tabIndex={0}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect()
        onSeek((e.clientX - rect.left) / rect.width)
      }}
      className="relative flex h-14 cursor-pointer items-center gap-px overflow-hidden rounded-md bg-muted/20"
    >
      {peaks ? (
        peaks.map((p, i) => (
          <span
            key={i}
            className={`flex-1 rounded-full ${i / peaks.length < progress ? "bg-brand-gold" : "bg-brand-gold/40"}`}
            style={{ height: `${Math.max(6, p * 100)}%` }}
          />
        ))
      ) : (
        <span className="absolute inset-y-0 left-0 bg-brand-gold/40" style={{ width: `${progress * 100}%` }} />
      )}
    </div>
  )
}
