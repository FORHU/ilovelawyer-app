import type { KeyboardEvent } from "react";
import { Download, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { AudioOverviewWaveform } from "@/components/audio-overview/audio-overview-waveform";

/** One host-colored span of the recording, as percentages — see hostBands in audio-overview-sync. */
export interface AudioOverviewBand {
  left: number;
  width: number;
  speaker: "HOST_A" | "HOST_B";
}

const SEEK_KEYS: Record<string, number> = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -10, PageUp: 10 };

// Extracted out of Case Workspace's Studio panel so Legal Terminal's Audio Overview panel can
// use the same richer player instead of a bare native <audio controls> — see
// apps/web/lib/chat/use-audio-overview-player.tsx for the playback state/handlers these expect.

// The reference (NotebookLM's Studio list) shows a play button and progress bar directly on the
// collapsed row, playable without opening the item — this is that, for Audio Overview
// specifically. Not folded into a generic result-row component (used by other tiles too) since a
// play/pause button with its own click target inside a row that also opens on click needs
// event.stopPropagation() precision a generic component has no reason to carry.
// The reference's persistent bottom "now playing" bar — richer than AudioOverviewMiniPlayer
// (scrub, ±10s skip, speed). Deliberately omits the reference's thumbs up/down and
// history/queue icons — no feedback or playback-history feature exists behind them, and a
// button that does nothing on click doesn't belong here just to match a screenshot.
export function AudioOverviewPlayerBar({
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
  onDownload,
  waveformUrl,
  waveformMedia,
  formatDuration,
  position,
  bands = [],
  hostALabel = "A",
  hostBLabel = "B",
  compact = false,
}: {
  /** Short-pane layout — see COMPACT_LAYOUT. Switching it never interrupts playback. */
  compact?: boolean;
  title: string;
  /** "03 / 08" — which turn is speaking, shown beside the title. */
  position?: string;
  /** Host-colored strip under the waveform; omitted (with the legend) when empty. */
  bands?: AudioOverviewBand[];
  hostALabel?: string;
  hostBLabel?: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (seconds: number) => void;
  onSkip: (deltaSeconds: number) => void;
  onCycleRate: () => void;
  onClose: () => void;
  /** Saves the rendered audio; the button only shows when given. */
  onDownload?: () => void;
  /** The audio being played, so this bar can show the same wavesurfer.js waveform History rows
   * show (same component) instead of a bare range input. `waveformMedia` is the `<audio>` element
   * wavesurfer binds playback/seeking to — the plain slider is the fallback while either is
   * missing (rendering not finished yet), not a degraded state to fix. */
  waveformUrl?: string;
  waveformMedia?: HTMLAudioElement | null;
  formatDuration: (seconds: number) => string;
}) {
  // This bar is Audio Overview's Current view specifically (both its callers — Studio and the
  // terminal panel — use it that way); History rows use the "history" waveform scheme so the two
  // views stay visually distinct at a glance.
  const onSeekKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const delta = SEEK_KEYS[e.key];
    if (delta !== undefined) {
      e.preventDefault();
      onSeek(currentTime + delta);
    } else if (e.key === "Home") {
      e.preventDefault();
      onSeek(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onSeek(duration);
    } else if (e.key === " ") {
      e.preventDefault();
      onTogglePlay();
    }
  };
  // One flat grid for both layouts, rearranged by grid-template-areas rather than rendering a
  // second tree: switching layouts must not remount AudioOverviewWaveform, since re-creating
  // wavesurfer re-loads the shared <audio> element and stops playback (see that file).
  const layout = compact ? COMPACT_LAYOUT : FULL_LAYOUT;
  const area = (name: string) => ({ gridArea: name });
  return (
    <div
      className={`grid shrink-0 items-center border-t border-border bg-card ${compact ? "gap-x-3 gap-y-1.5 px-3 py-2" : "gap-x-2.5 gap-y-2 px-3 pt-2.5 pb-3"}`}
      style={layout}
    >
      <p style={area("title")} className="flex min-w-0 items-baseline gap-2">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">{title}</span>
        {position && <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">{position}</span>}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        style={area("close")}
        className="flex h-6 w-6 shrink-0 items-center justify-center justify-self-end self-start rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <div style={area("seek")} className="min-w-0">
        {waveformUrl && waveformMedia ? (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek audio"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatDuration(currentTime)} of ${formatDuration(duration)}`}
            onKeyDown={onSeekKey}
            className="relative overflow-hidden rounded-md"
          >
            <AudioOverviewWaveform url={waveformUrl} mediaElement={waveformMedia} scheme="current" className="h-10" />
            {bands.map((band, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={`pointer-events-none absolute bottom-0 h-0.75 shadow-[inset_-1px_0_0_var(--card)] ${
                  band.speaker === "HOST_A" ? "bg-brand-gold" : "bg-(--ao-host-b)"
                }`}
                style={{ left: `${band.left}%`, width: `${band.width}%` }}
              />
            ))}
          </div>
        ) : (
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
        )}
      </div>
      <span style={area("elapsed")} className={`font-mono text-[10.5px] text-foreground ${compact ? "justify-self-end" : ""}`}>
        {formatDuration(currentTime)}
        {compact && <span className="text-muted-foreground"> / {formatDuration(duration)}</span>}
      </span>
      {!compact && (
        <span style={area("total")} className="justify-self-end font-mono text-[10.5px] text-muted-foreground">
          {formatDuration(duration)}
        </span>
      )}
      {bands.length > 0 ? (
        <span
          style={area("legend")}
          className={`inline-flex items-center gap-1 text-[9.5px] font-semibold tracking-widest text-muted-foreground ${compact ? "justify-self-end" : "justify-self-center"}`}
          aria-hidden="true"
        >
          <span className="h-0.75 w-2 bg-brand-gold" />
          {hostALabel}
          <span className="ml-1.5 h-0.75 w-2 bg-(--ao-host-b)" />
          {hostBLabel}
        </span>
      ) : (
        <span style={area("legend")} aria-hidden="true" />
      )}
      <button
        type="button"
        onClick={onCycleRate}
        aria-label={`Playback speed ${playbackRate}×, change speed`}
        style={area("speed")}
        className={`min-w-10 justify-self-start border border-border px-2 font-mono text-foreground transition-colors hover:border-muted-foreground ${
          compact ? "h-6.5 rounded text-[10.5px]" : "h-7 rounded-full text-[11px]"
        }`}
      >
        {playbackRate}×
      </button>
      <button
        type="button"
        onClick={() => onSkip(-10)}
        aria-label="Back 10 seconds"
        style={area("back")}
        className={`relative flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${compact ? "h-8 w-8" : "h-8.5 w-8.5"}`}
      >
        <RotateCcw className={compact ? "h-5 w-5" : "h-5.5 w-5.5"} strokeWidth={1.6} aria-hidden="true" />
        <span aria-hidden="true" className="absolute top-1/2 left-1/2 translate-x-[-45%] translate-y-[-40%] font-mono text-[7px] font-medium">10</span>
      </button>
      <button
        type="button"
        onClick={onTogglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        style={area("play")}
        className={`flex shrink-0 items-center justify-center rounded-full bg-brand-gold text-brand-navy-950 transition-[filter] hover:brightness-110 ${
          compact ? "h-10 w-10" : "h-11.5 w-11.5"
        }`}
      >
        {isPlaying ? <Pause className="h-4.5 w-4.5 fill-current" aria-hidden="true" /> : <Play className="ml-0.5 h-4.5 w-4.5 fill-current" aria-hidden="true" />}
      </button>
      <button
        type="button"
        onClick={() => onSkip(10)}
        aria-label="Forward 10 seconds"
        style={area("fwd")}
        className={`relative flex shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${compact ? "h-8 w-8" : "h-8.5 w-8.5"}`}
      >
        <RotateCw className={compact ? "h-5 w-5" : "h-5.5 w-5.5"} strokeWidth={1.6} aria-hidden="true" />
        <span aria-hidden="true" className="absolute top-1/2 left-1/2 translate-x-[-55%] translate-y-[-40%] font-mono text-[7px] font-medium">10</span>
      </button>
      {onDownload ? (
        <button
          type="button"
          onClick={onDownload}
          aria-label="Download audio"
          title="Download"
          style={area("dl")}
          className="flex h-7 w-7 items-center justify-center justify-self-end rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : (
        <span style={area("dl")} aria-hidden="true" />
      )}
    </div>
  );
}

/** Roomy layout (Studio, tall panes): title row, full-width wave, clock with the host legend,
 * then transport controls centered around a large play button. */
const FULL_LAYOUT = {
  gridTemplateColumns: "1fr auto auto auto 1fr",
  gridTemplateAreas: `
    "title   title  title  title  close"
    "seek    seek   seek   seek   seek"
    "elapsed legend legend legend total"
    "speed   back   play   fwd    dl"`,
} as const;

/** Short panes (a Legal Terminal tile): title and clock share one line, the wave runs full width,
 * and the transport row centers play between the ±10s skips — clearly less height than the full
 * layout, leaving room for the script. The two outer 28px columns mirror each other (speed's side,
 * download/close's side), which is what keeps play exactly centered. */
const COMPACT_LAYOUT = {
  gridTemplateColumns: "28px 1fr auto auto auto 1fr 28px",
  gridTemplateAreas: `
    "title title title title title elapsed close"
    "seek  seek  seek  seek  seek  seek    seek"
    "speed speed back  play  fwd   legend  dl"`,
} as const;

export function AudioOverviewMiniPlayer({
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
    <div className="flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 transition-colors hover:border-brand-gold/40 hover:bg-muted dark:hover:bg-overlay-hover">
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
