import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, CircleHelp, XCircle } from "lucide-react"
import type { AudioOverviewTurn, AudioOverviewTurnCheck } from "@/lib/chat/mutations"

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

const SCROLL_SETTLE_MS = 250
// Matches the scrollIntoView smooth-scroll's own rough duration — past this, any further scroll
// on the container is the listener's doing, not the tail end of our own auto-scroll animation.
const AUTO_SCROLL_SETTLE_MS = 600

/** The script as a list of host turns, each with Jev's verdict when there is one. `checks` is
 * empty/absent when the check is off or hasn't finished — turns then render bare.
 *
 * With `currentTime` and `turnTimings` both given, the turn currently playing is picked out
 * (full brightness, a left accent) while the rest dim — Spotify's synced-lyrics look — and the
 * active turn is scrolled into view as playback moves past it. A listener who manually scrolls
 * the transcript re-anchors that sync to wherever they scrolled to, invisibly (a constant
 * seconds-offset applied to `currentTime` from then on, like a subtitle-offset control, but
 * driven by the scroll gesture itself rather than a visible +/- button) — the fix for
 * turnTimings drifting flatter across a long script than the actual audio, without adding any UI
 * chrome for it. Without `currentTime`/`turnTimings` (audio not rendered, or an overview from
 * before this shipped), every turn renders the same as before and the scroll area behaves like
 * a plain list. */
export function AudioOverviewTurns({
  turns,
  checks,
  currentTime,
  turnTimings,
  className = "",
}: {
  turns: AudioOverviewTurn[]
  checks?: AudioOverviewTurnCheck[] | null
  currentTime?: number
  turnTimings?: number[] | null
  /** Applied to the scrolling root alongside the base spacing — pass `"h-full overflow-y-auto"`
   * (or similar) to make this the scroll container itself; omit for a plain, non-scrolling list
   * (History's rows, which scroll as part of the whole list, not per-entry). */
  className?: string
}) {
  const { t } = useTranslation("case-portfolio")
  const byTurn = new Map((checks ?? []).map((c) => [c.turn, c]))

  const scrollRef = useRef<HTMLDivElement>(null)
  const turnRefs = useRef<(HTMLDivElement | null)[]>([])
  const syncOffsetRef = useRef(0)
  const programmaticScrollRef = useRef(false)
  const scrollSettleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A fresh overview starts with no correction — one script's drift has no business surviving
  // onto a completely different recording.
  useEffect(() => {
    syncOffsetRef.current = 0
  }, [turns])

  const canSync = currentTime !== undefined && !!turnTimings && turnTimings.length === turns.length
  const effectiveTime = canSync ? currentTime! - syncOffsetRef.current : undefined
  const activeIndex = activeTurnIndex(effectiveTime, turnTimings, turns.length)

  useEffect(() => {
    if (activeIndex === null) return
    const el = turnRefs.current[activeIndex]
    if (!el) return
    programmaticScrollRef.current = true
    el.scrollIntoView({ behavior: "smooth", block: "nearest" })
    const timeout = setTimeout(() => {
      programmaticScrollRef.current = false
    }, AUTO_SCROLL_SETTLE_MS)
    return () => clearTimeout(timeout)
  }, [activeIndex])

  const handleScroll = () => {
    if (!canSync || programmaticScrollRef.current) return
    if (scrollSettleTimeoutRef.current) clearTimeout(scrollSettleTimeoutRef.current)
    scrollSettleTimeoutRef.current = setTimeout(() => {
      const container = scrollRef.current
      if (!container || !turnTimings) return
      const containerMid = container.getBoundingClientRect().top + container.clientHeight / 2
      let closestIndex: number | null = null
      let closestDistance = Infinity
      turnRefs.current.forEach((el, i) => {
        if (!el) return
        const rect = el.getBoundingClientRect()
        const distance = Math.abs(rect.top + rect.height / 2 - containerMid)
        if (distance < closestDistance) {
          closestDistance = distance
          closestIndex = i
        }
      })
      // Re-anchors so effectiveTime reads as exactly this turn's nominal start right now — the
      // whole timeline shifts by that same constant from here on, not just this one turn.
      if (closestIndex !== null) syncOffsetRef.current = currentTime! - turnTimings[closestIndex]!
    }, SCROLL_SETTLE_MS)
  }

  return (
    <div ref={scrollRef} onScroll={handleScroll} className={`space-y-3 ${className}`}>
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
            <p className="text-[13px] leading-5 text-foreground">{turn.text}</p>
          </div>
        )
      })}
    </div>
  )
}
