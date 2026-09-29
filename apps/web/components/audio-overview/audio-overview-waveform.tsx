import { useEffect, useState } from "react"

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

/** Mirrored (up/down from a center line), warm-gradient bars — after a sampler-plugin waveform
 * (Kontakt-style: dark backing, amber-to-red fill on the played portion, a thin playhead) rather
 * than a flat bottom-anchored bar or a bare range input. The loop/start/zoom chrome such editors
 * carry doesn't apply here — this is playback of a fixed recording, not a sample being edited —
 * only the waveform's look is borrowed. Shared by History's rows and the docked player bar
 * (Current), so both look the same whether or not a stored waveform is playing. */
export function AudioOverviewWaveform({
  url,
  progress,
  onSeek,
  className = "h-16",
}: {
  url: string
  /** 0–1 playback position. */
  progress: number
  /** Fraction (0–1) of the click position along the waveform. */
  onSeek: (fraction: number) => void
  className?: string
}) {
  const peaks = useWaveformPeaks(url)
  const playheadPct = Math.min(100, Math.max(0, progress * 100))
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
      className={`relative flex cursor-pointer items-center gap-px overflow-hidden rounded-md bg-brand-navy-950 px-1 ${className}`}
    >
      {/* Center line — the bars grow from here, both up and down, instead of sitting on the floor. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white/10" aria-hidden="true" />
      {peaks ? (
        peaks.map((p, i) => {
          const played = i / peaks.length < progress
          const heightPct = Math.max(8, p * 100)
          return (
            <span
              key={i}
              className="relative flex-1 self-center rounded-full transition-colors"
              style={{
                height: `${heightPct}%`,
                background: played
                  ? "linear-gradient(180deg, #fbbf24 0%, #dc2626 100%)"
                  : "rgba(251, 191, 36, 0.18)",
              }}
            />
          )
        })
      ) : (
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${playheadPct}%`, background: "linear-gradient(180deg, #fbbf24 0%, #dc2626 100%)", opacity: 0.5 }}
        />
      )}
      {/* Playhead — a thin bright line at the current position, on top of the bars. */}
      <div
        className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_6px_1px_rgba(255,255,255,0.6)]"
        style={{ left: `${playheadPct}%` }}
        aria-hidden="true"
      />
    </div>
  )
}
