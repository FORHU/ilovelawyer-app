import type { AudioOverviewTurn } from "@/lib/chat/mutations"

/** "mm:ss" for transcript gutters and the player's clock. */
export function formatClock(seconds: number): string {
  const s = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

/** True when `turnTimings` can actually be lined up against `turns` — null on an overview that
 * hasn't been rendered yet (or was rendered before timings shipped), and a length mismatch means
 * the two came from different generations. */
export function hasUsableTimings(turnTimings: number[] | null | undefined, turnCount: number): turnTimings is number[] {
  return !!turnTimings && turnCount > 0 && turnTimings.length === turnCount
}

/** Index of the turn speaking at `time`: the last one whose start is at or before it.
 * turnTimings is cumulative and ascending (ilovelawyer-api's turnStartTimes). */
export function activeTurnIndex(time: number, turnTimings: number[]): number {
  let active = 0
  for (let i = 0; i < turnTimings.length; i++) {
    if (turnTimings[i]! <= time) active = i
    else break
  }
  return active
}

/** Where turn `i` ends: the next turn's start, or the recording's length for the last turn.
 * Falls back to a nominal 30s when the duration isn't known yet (metadata still loading). */
export function turnEnd(i: number, turnTimings: number[], duration: number): number {
  const next = turnTimings[i + 1]
  if (next !== undefined) return next
  const start = turnTimings[i]!
  return duration > start ? duration : start + 30
}

export type WordState = "spoken" | "speaking" | "upcoming"

/** Splits a turn into words with a playback state each. There are no per-word timestamps from
 * Polly, so each word's slot is its share of the turn's characters across the turn's time span —
 * close enough at speaking pace that the highlight tracks the voice. */
export function wordStates(text: string, start: number, end: number, time: number): { word: string; state: WordState }[] {
  const words = text.split(/\s+/).filter(Boolean)
  const total = words.reduce((n, w) => n + w.length + 1, 0) || 1
  const fraction = end > start ? (time - start) / (end - start) : 0
  let consumed = 0
  return words.map((word) => {
    const from = consumed / total
    consumed += word.length + 1
    const to = consumed / total
    const state: WordState = fraction >= to ? "spoken" : fraction >= from ? "speaking" : "upcoming"
    return { word, state }
  })
}

/** One host-colored band per turn, as percentages of the recording, for the strip under the
 * player's waveform. Empty when there's nothing reliable to place them on. */
export function hostBands(
  turns: AudioOverviewTurn[],
  turnTimings: number[] | null | undefined,
  duration: number,
): { left: number; width: number; speaker: AudioOverviewTurn["speaker"] }[] {
  if (!hasUsableTimings(turnTimings, turns.length) || duration <= 0) return []
  return turns.map((turn, i) => {
    const start = Math.min(turnTimings[i]!, duration)
    const end = Math.min(turnEnd(i, turnTimings, duration), duration)
    return { left: (start / duration) * 100, width: Math.max(0, ((end - start) / duration) * 100), speaker: turn.speaker }
  })
}
