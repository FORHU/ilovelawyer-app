import { useEffect, useRef, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react"
import type { AudioOverviewMarkTiming, AudioOverviewTurn, AudioOverviewTurnCheck } from "@/lib/chat/mutations"

const VERDICT_STYLE = {
  SUPPORTED: { Icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400", key: "supported" },
  UNSUPPORTED: { Icon: CircleHelp, className: "text-amber-600 dark:text-amber-400", key: "unsupported" },
  CONTRADICTED: { Icon: XCircle, className: "text-red-600 dark:text-red-400", key: "contradicted" },
} as const

/** Jev's verdict on one script turn — an icon with the reading as its tooltip, so it stays out of
 * the way of the text being read (ilovelawyer-api's audio-overview-jev.ts). */
function TurnCheckIcon({ check }: { check: AudioOverviewTurnCheck }) {
  const { t } = useTranslation("case-portfolio")
  const { Icon, className, key } = VERDICT_STYLE[check.verdict]
  const label = t(`audioOverviewCheck.${key}`)
  return <Icon className={`h-3.5 w-3.5 shrink-0 ${className}`} aria-label={label} role="img" />
}

/** Index of the turn playing at `time`, or null when there's nothing to sync to (audio not
 * rendered yet, an older overview from before turnTimings existed, or a length mismatch). The last
 * turn whose start is at or before `time` — turnTimings is a cumulative, ascending offset per
 * turn (ilovelawyer-api's turnStartTimes), so this is the one currently speaking. */
function activeTurnIndex(time: number | undefined, turnTimings: number[] | null | undefined, turnCount: number): number | null {
  if (time === undefined || !turnTimings || turnTimings.length !== turnCount) return null
  let active = 0
  for (let i = 0; i < turnTimings.length; i++) {
    if (turnTimings[i]! <= time) active = i
    else break
  }
  return active
}

/** Index of the sentence or word playing at `time` within one turn — the last whose start is at
 * or before it, or -1 while the turn's opening silence plays. */
function activeMarkIndex(time: number, marks: AudioOverviewMarkTiming[]): number {
  let active = -1
  for (let i = 0; i < marks.length; i++) {
    if (marks[i]!.time <= time) active = i
    else break
  }
  return active
}

/** A turn's text filling in as it's spoken: everything before the current word at full
 * brightness, the current word in gold, the rest dimmed — still readable, so a listener can
 * read ahead. Before the first word starts, the whole turn reads as not-yet-spoken. */
function TurnWords({ text, words, activeWord }: { text: string; words: AudioOverviewMarkTiming[]; activeWord: number }) {
  const current = words[activeWord]
  const spokenEnd = current?.start ?? 0
  const currentEnd = current?.end ?? 0
  return (
    <>
      {text.slice(0, spokenEnd)}
      <span className="text-brand-gold">{text.slice(spokenEnd, currentEnd)}</span>
      <span className="opacity-45">{text.slice(currentEnd)}</span>
    </>
  )
}

/** A turn's text with the sentence at `activeSentence` picked out — the fallback for overviews
 * rendered before word timings existed. Whatever falls between or after Polly's sentence ranges
 * (spacing, trailing text) renders unhighlighted, so the turn always reads as its full text. */
function TurnSentences({
  text,
  sentences,
  activeSentence,
}: {
  text: string
  sentences: AudioOverviewMarkTiming[]
  activeSentence: number
}) {
  const parts: ReactNode[] = []
  let cursor = 0
  sentences.forEach((sentence, i) => {
    const start = Math.max(sentence.start, cursor)
    if (start > cursor) parts.push(text.slice(cursor, start))
    parts.push(
      <span
        key={i}
        className={`rounded-sm transition-colors duration-200 ${i === activeSentence ? "bg-brand-gold/20" : ""}`}
      >
        {text.slice(start, sentence.end)}
      </span>,
    )
    cursor = Math.max(cursor, sentence.end)
  })
  if (cursor < text.length) parts.push(text.slice(cursor))
  return <>{parts}</>
}

/** The script as a list of host turns, each with Jev's verdict when there is one. `checks` is
 * empty/absent when the check is off or hasn't finished — turns then render bare.
 *
 * With `currentTime` and `turnTimings` both given, the turn currently playing is picked out
 * (full brightness, a left accent) while the rest dim — Spotify's synced-lyrics look — and the
 * active turn is scrolled into view as playback moves past it. Without `currentTime`/
 * `turnTimings` (audio not rendered, or an overview from before this shipped), every turn
 * renders the same as before and the scroll area behaves like a plain list.
 *
 * With `wordTimings` too, the active turn fills in word by word as it's spoken (TurnWords).
 * Overviews rendered before word timings existed fall back to highlighting the sentence being
 * spoken (`sentenceTimings`), and ones from before that to the turn-level highlight only.
 *
 * turnTimings used to drift later than the audio across a long script, and a manual scroll used
 * to re-anchor the clock to compensate. The drift was each clip's MP3 header frame being counted
 * though the merge drops it (ilovelawyer-api's headerFrameSeconds) — fixed at the source, so
 * scrolling the transcript is just scrolling again. */
export function AudioOverviewTurns({
  turns,
  checks,
  currentTime,
  turnTimings,
  sentenceTimings,
  wordTimings,
  className = "",
}: {
  turns: AudioOverviewTurn[]
  checks?: AudioOverviewTurnCheck[] | null
  currentTime?: number
  turnTimings?: number[] | null
  sentenceTimings?: AudioOverviewMarkTiming[][] | null
  wordTimings?: AudioOverviewMarkTiming[][] | null
  /** Applied to the scrolling root alongside the base spacing — pass `"h-full overflow-y-auto"`
   * (or similar) to make this the scroll container itself; omit for a plain, non-scrolling list
   * (History's rows, which scroll as part of the whole list, not per-entry). */
  className?: string
}) {
  const { t } = useTranslation("case-portfolio")
  const byTurn = new Map((checks ?? []).map((c) => [c.turn, c]))

  const turnRefs = useRef<(HTMLDivElement | null)[]>([])

  const activeIndex = activeTurnIndex(currentTime, turnTimings, turns.length)
  const marksForActiveTurn = (timings: AudioOverviewMarkTiming[][] | null | undefined) =>
    activeIndex !== null && timings?.length === turns.length ? timings[activeIndex] : undefined
  const activeTurnWords = marksForActiveTurn(wordTimings)
  const activeTurnSentences = marksForActiveTurn(sentenceTimings)

  useEffect(() => {
    if (activeIndex === null) return
    turnRefs.current[activeIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }, [activeIndex])

  return (
    <div className={`space-y-3 ${className}`}>
      {turns.map((turn, i) => {
        const check = byTurn.get(i)
        const isActive = activeIndex === null || activeIndex === i
        return (
          <div
            key={i}
            ref={(el) => {
              turnRefs.current[i] = el
            }}
            className={`rounded-md border-l-2 py-0.5 pl-2 transition-[opacity,border-color] duration-300 ${
              activeIndex === i ? "border-brand-gold opacity-100" : "border-transparent"
            } ${isActive ? "" : "opacity-45"}`}
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-gold">
              {turn.speaker === "HOST_A" ? t("workspace.audioOverviewHostA") : t("workspace.audioOverviewHostB")}
              {check && <TurnCheckIcon check={check} />}
            </p>
            <p className="text-[13px] leading-5 text-foreground">
              {activeIndex === i && activeTurnWords?.length ? (
                <TurnWords
                  text={turn.text}
                  words={activeTurnWords}
                  activeWord={activeMarkIndex(currentTime!, activeTurnWords)}
                />
              ) : activeIndex === i && activeTurnSentences?.length ? (
                <TurnSentences
                  text={turn.text}
                  sentences={activeTurnSentences}
                  activeSentence={activeMarkIndex(currentTime!, activeTurnSentences)}
                />
              ) : (
                turn.text
              )}
            </p>
          </div>
        )
      })}
    </div>
  )
}
