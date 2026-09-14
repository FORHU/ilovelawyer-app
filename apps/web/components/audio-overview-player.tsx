import { Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";

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
