import type { AudioOverviewMarkTiming, AudioOverviewTurn } from "@/lib/chat/mutations"

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

/** A run of a turn's text with one playback state — the unit the transcript renders. */
export interface TextSegment {
  text: string
  state: WordState
}

/** Index of the last mark whose start is at or before `time`, or -1 before the first one. */
function lastStartedMark(time: number, marks: AudioOverviewMarkTiming[]): number {
  let active = -1
  for (let i = 0; i < marks.length; i++) {
    if (marks[i]!.time <= time) active = i
    else break
  }
  return active
}

/** Splits a turn into states using the best timing data available:
 *  1. `words` — Polly's word speech marks (ilovelawyer-api's wordTimings): exact.
 *  2. `sentences` — Polly's sentence speech marks: each sentence's span is exact, and words
 *     within it are estimated by character share (wordStates).
 *  3. Neither (overviews rendered before either existed): the whole turn estimated by character
 *     share across [start, end).
 * Every character of `text` lands in exactly one segment, so the turn always reads as its full
 * text whatever ranges Polly reported. */
export function turnSegments(
  text: string,
  start: number,
  end: number,
  time: number,
  words?: AudioOverviewMarkTiming[] | null,
  sentences?: AudioOverviewMarkTiming[] | null,
): TextSegment[] {
  if (words?.length) {
    const active = lastStartedMark(time, words)
    const segments: TextSegment[] = []
    let cursor = 0
    // Text before word i (spaces, punctuation, an opening quote) reads as spoken once the word
    // before it has started — or, for the leading text, once the first word has.
    const gap = (i: number): WordState => (active >= Math.max(i - 1, 0) ? "spoken" : "upcoming")
    words.forEach((word, i) => {
      const state: WordState = i < active ? "spoken" : i === active ? "speaking" : "upcoming"
      const from = Math.max(word.start, cursor)
      if (from > cursor) segments.push({ text: text.slice(cursor, from), state: gap(i) })
      if (word.end > from) segments.push({ text: text.slice(from, word.end), state })
      cursor = Math.max(cursor, word.end)
    })
    if (cursor < text.length) segments.push({ text: text.slice(cursor), state: gap(words.length) })
    return segments
  }

  if (sentences?.length) {
    const segments: TextSegment[] = []
    let cursor = 0
    sentences.forEach((sentence, i) => {
      const from = Math.max(sentence.start, cursor)
      if (from > cursor) segments.push({ text: text.slice(cursor, from), state: time >= sentence.time ? "spoken" : "upcoming" })
      const sentenceEnd = sentences[i + 1]?.time ?? end
      for (const { word, state } of wordStates(text.slice(from, sentence.end), sentence.time, sentenceEnd, time)) {
        segments.push({ text: `${word} `, state })
      }
      cursor = Math.max(cursor, sentence.end)
    })
    if (cursor < text.length) segments.push({ text: text.slice(cursor), state: time >= end ? "spoken" : "upcoming" })
    return segments
  }

  return wordStates(text, start, end, time).map(({ word, state }) => ({ text: `${word} `, state }))
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
