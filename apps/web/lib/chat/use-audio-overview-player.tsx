"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Wraps the one shared <audio> element's playback state (play/pause, scrub, duration, rate) plus
 * per-browser resume-position persistence keyed by the Audio Overview message id. Factored out of
 * Case Workspace's Studio panel so Legal Terminal's Audio Overview panel can drive the same
 * richer player (see components/audio-overview-player.tsx) instead of a bare native
 * `<audio controls>`. Mount the returned `audioElement` once per panel (not one per player UI —
 * a mini player row and a detail view should control the same actual playback, not each start
 * their own).
 */
export function useAudioOverviewPlayer(renderedAudioUrl: string | null | undefined, messageId: string | null | undefined) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  // Dismissing the bottom player bar (X button) only hides it — the underlying <audio> and its
  // position aren't touched, so reopening the source view brings it right back.
  const [playerBarDismissed, setPlayerBarDismissed] = useState(false);
  // Not reset on pause/end — onPause/onEnded below always save the exact position immediately
  // regardless of this ref's throttle state, so a stale threshold carried over from a previous
  // track only delays the periodic autosave for the new one, never loses the position entirely.
  const lastSavedPositionRef = useRef(0);

  const savePlaybackPosition = (id: string, seconds: number) => {
    try {
      localStorage.setItem(`audio-overview-position:${id}`, String(Math.floor(seconds)));
    } catch {
      // localStorage unavailable (private browsing, storage disabled) — resume just won't work
    }
  };
  const readPlaybackPosition = (id: string): number => {
    try {
      return Number(localStorage.getItem(`audio-overview-position:${id}`)) || 0;
    } catch {
      return 0;
    }
  };

  const togglePlayback = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };
  const seek = (seconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(seconds, playbackDuration || seconds));
  };
  const skip = (deltaSeconds: number) => {
    const el = audioRef.current;
    if (!el) return;
    seek(el.currentTime + deltaSeconds);
  };
  const cycleRate = () => {
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
  }, [renderedAudioUrl]);

  const audioElement =
    renderedAudioUrl && messageId ? (
      <audio
        ref={audioRef}
        src={renderedAudioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => {
          setIsPlaying(false);
          // Captured immediately on pause (not just the throttled interval above) so stopping
          // right after seeking, before the next timeupdate tick, isn't lost.
          savePlaybackPosition(messageId, audioRef.current?.currentTime ?? 0);
        }}
        onEnded={() => {
          setIsPlaying(false);
          // Finished — resume-from-here no longer makes sense; next play starts over.
          savePlaybackPosition(messageId, 0);
        }}
        onTimeUpdate={(e) => {
          const seconds = e.currentTarget.currentTime;
          setPlaybackTime(seconds);
          // Throttled to ~every 5s of playback (timeupdate fires several times a second) —
          // frequent enough that a crash/tab-close never loses more than a few seconds, without
          // hammering localStorage on every tick.
          if (seconds - lastSavedPositionRef.current >= 5) {
            lastSavedPositionRef.current = seconds;
            savePlaybackPosition(messageId, seconds);
          }
        }}
        onLoadedMetadata={(e) => {
          setPlaybackDuration(e.currentTarget.duration);
          const resumeAt = readPlaybackPosition(messageId);
          if (resumeAt > 0 && resumeAt < e.currentTarget.duration) {
            e.currentTarget.currentTime = resumeAt;
            setPlaybackTime(resumeAt);
            lastSavedPositionRef.current = resumeAt;
          }
        }}
        className="hidden"
      />
    ) : null;

  return {
    audioElement,
    isPlaying,
    playbackTime,
    playbackDuration,
    playbackRate,
    playerBarDismissed,
    setPlayerBarDismissed,
    togglePlayback,
    seek,
    skip,
    cycleRate,
    formatDuration,
  };
}
