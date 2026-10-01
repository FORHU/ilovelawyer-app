import { useEffect, useRef, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronsUpDown } from "lucide-react"
import type { AudioOverviewTurn, AudioOverviewTurnCheck } from "@/lib/chat/mutations"
import { hostLabel, TurnCheckIcon } from "@/components/audio-overview/audio-overview-turns"
import {
  activeTurnIndex,
  formatClock,
  hasUsableTimings,
  turnEnd,
  wordStates,
  type WordState,
} from "@/components/audio-overview/audio-overview-sync"

const WORD_CLASS: Record<WordState, string> = {
  spoken: "text-foreground",
  speaking: "text-foreground shadow-[inset_0_-1.5px_0_var(--brand-gold)]",
  upcoming: "text-muted-foreground/60",
}

const pad2 = (n: number) => String(n).padStart(2, "0")

const FULL_SCRIPT_KEY = "audio-overview-full-script"

function readFullScriptPreference(): boolean {
  try {
    return localStorage.getItem(FULL_SCRIPT_KEY) === "1"
  } catch {
    return false // storage unavailable (private browsing, server render) — default to focus view
  }
}

function writeFullScriptPreference(fullScript: boolean) {
  try {
    localStorage.setItem(FULL_SCRIPT_KEY, fullScript ? "1" : "0")
  } catch {
    // storage unavailable — the choice just won't survive leaving the tile
  }
}

/** Full script vs. focus view, remembered per browser. The transcript component unmounts whenever
 * the listener leaves the tile (another tab, back to Studio), and dropping them back into focus
 * view each time read as the full script — and its scrollbar — disappearing. Exported so a host
 * that draws its own toolbar (the terminal panel) can own the toggle. */
export function useFullScriptPreference(): [boolean, (fullScript: boolean) => void] {
  const [fullScript, setFullScript] = useState(readFullScriptPreference)
  return [
    fullScript,
    (value: boolean) => {
      setFullScript(value)
      writeFullScriptPreference(value)
    },
  ]
}

/** The "Full script" / "Focus view" switch, sized to sit beside other h-7 toolbar pills. */
export function FullScriptToggle({ fullScript, onChange }: { fullScript: boolean; onChange: (fullScript: boolean) => void }) {
  const { t } = useTranslation("case-portfolio")
  return (
    <button
      type="button"
      onClick={() => onChange(!fullScript)}
      aria-pressed={fullScript}
      className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium whitespace-nowrap text-foreground transition-colors hover:border-muted-foreground"
    >
      <ChevronsUpDown className="h-3 w-3" aria-hidden="true" />
      {fullScript ? t("workspace.audioOverviewFocusView") : t("workspace.audioOverviewFullScript")}
    </button>
  )
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
}

/** The Current view's script, synced to playback (Legal Terminal's Audio Overview panel and Case
 * Workspace's Studio tile).
 *
 * Focus view (the default once audio is playable) shows only the turn being spoken, its words
 * lighting up as they're read, with the previous turn above and what's coming below as faint lines.
 * "Full script" switches to every turn, following playback until the listener scrolls away, at
 * which point a "Back to current" button picks the follow back up. Any line seeks the player to
 * where it starts. This replaces the old invisible scroll-to-re-anchor drift correction: clicking
 * the line you hear now does the same job in the open.
 *
 * Without usable timings (audio not rendered yet, or an overview from before turnTimings existed)
 * it's a plain readable list with nothing highlighted or clickable. */
export function AudioOverviewTranscript({
  turns,
  checks,
  turnTimings,
  currentTime,
  duration,
  onSeek,
  caption,
  notice,
  compact = false,
  fullScript: controlledFullScript,
  hideCaptionBar = false,
}: {
  /** Controlled Full script state, for a host that renders FullScriptToggle in its own toolbar.
   * Omitted, the transcript keeps its own (remembered) state and shows the toggle itself. */
  fullScript?: boolean
  /** Skip the caption row (caption + toggle) — the host shows both in its own toolbar. */
  hideCaptionBar?: boolean
  /** Tighter spacing and a smaller current-turn line, for short panes (a terminal tile). */
  compact?: boolean
  turns: AudioOverviewTurn[]
  checks?: AudioOverviewTurnCheck[] | null
  turnTimings?: number[] | null
  currentTime: number
  duration: number
  /** Omit until audio is playable — seeking, highlighting and the focus view all depend on it. */
  onSeek?: (seconds: number) => void
  /** The mono line above the script (date · turn count). */
  caption: string
  /** Status line under the caption (rendering / render failed). */
  notice?: ReactNode
}) {
  const { t } = useTranslation("case-portfolio")
  const byTurn = new Map((checks ?? []).map((c) => [c.turn, c]))
  const synced = !!onSeek && hasUsableTimings(turnTimings, turns.length)
  const active = synced ? activeTurnIndex(currentTime, turnTimings!) : -1

  const [ownFullScript, setOwnFullScript] = useFullScriptPreference()
  const expanded = controlledFullScript ?? ownFullScript
  const [follow, setFollow] = useState(true)
  const stageRef = useRef<HTMLDivElement>(null)

  // A new script, or switching between focus view and full script, starts following playback.
  const [shown, setShown] = useState({ turns, expanded })
  if (shown.turns !== turns || shown.expanded !== expanded) {
    setShown({ turns, expanded })
    setFollow(true)
  }

  // Scrolls the stage to where playback is. Re-run on resize too: a terminal tile can be dragged
  // smaller mid-playback, and a scroll position chosen for the old size can leave the current
  // turn out of view.
  const anchor = (behavior: ScrollBehavior) => {
    const stage = stageRef.current
    if (!stage || !synced) return
    if (!expanded) {
      // Focus view: the current turn always in view, with the previous turn just above it when
      // both fit — in a short pane, pinning the previous turn to the top pushed the current one
      // off the bottom. Earlier turns sit above, out of view until the listener scrolls up.
      const current = stage.querySelector<HTMLElement>("[data-current]")
      const previous = active > 0 ? stage.querySelector<HTMLElement>(`[data-turn="${active - 1}"]`) : null
      if (!current) return
      const fitsWithPrevious = previous && current.offsetTop + current.offsetHeight - previous.offsetTop <= stage.clientHeight
      stage.scrollTo({ top: fitsWithPrevious ? previous.offsetTop : current.offsetTop, behavior })
      return
    }
    if (!follow) return
    const row = stage.querySelector<HTMLElement>(`[data-turn="${active}"]`)
    if (row) stage.scrollTo({ top: Math.max(0, row.offsetTop - stage.clientHeight * 0.3), behavior })
  }
  // Latest `anchor` for the ResizeObserver callback; declared before the effect below so effects
  // (which run in order) always see this render's version.
  const anchorRef = useRef(anchor)
  useEffect(() => {
    anchorRef.current = anchor
  })

  useEffect(() => {
    anchorRef.current(prefersReducedMotion() ? "auto" : "smooth")
  }, [active, expanded, follow, synced])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(() => anchorRef.current("auto"))
    observer.observe(stage)
    return () => observer.disconnect()
  }, [])

  const seekTo = (i: number) => {
    if (!onSeek || !turnTimings) return
    onSeek(turnTimings[i]! + 0.01)
    setFollow(true)
  }
  const userScrolled = () => {
    if (expanded && follow && synced) setFollow(false)
  }

  const words = (i: number) =>
    wordStates(turns[i]!.text, turnTimings![i]!, turnEnd(i, turnTimings!, duration), currentTime).map(({ word, state }, k) => (
      <span key={k} className={`transition-colors duration-200 ${WORD_CLASS[state]}`}>
        {word}{" "}
      </span>
    ))
  const time = (i: number) => (synced ? formatClock(turnTimings![i]!) : "")
  const seekLabel = (i: number) =>
    t("workspace.audioOverviewPlayFrom", { time: time(i), host: hostLabel(t, turns[i]!.speaker) })
  const verdict = (i: number) => {
    const check = byTurn.get(i)
    return check ? <TurnCheckIcon check={check} /> : null
  }
  const position = synced ? `${pad2(active + 1)} / ${pad2(turns.length)}` : ""

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${hideCaptionBar ? "border-t border-border/60" : ""}`}>
      {!hideCaptionBar && (
        <div className="flex shrink-0 items-center gap-2 border-y border-border/60 px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[10px] uppercase tracking-[0.04em] text-muted-foreground">{caption}</span>
          {synced && controlledFullScript === undefined && (
            <button
              type="button"
              onClick={() => setOwnFullScript(!expanded)}
              aria-pressed={expanded}
              className="inline-flex h-5.5 shrink-0 items-center gap-1 rounded-full bg-foreground/6 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:bg-foreground/12"
            >
              <ChevronsUpDown className="h-2.75 w-2.75" aria-hidden="true" />
              {expanded ? t("workspace.audioOverviewFocusView") : t("workspace.audioOverviewFullScript")}
            </button>
          )}
        </div>
      )}
      {notice}

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          ref={stageRef}
          onWheel={userScrolled}
          onTouchMove={userScrolled}
          className="scrollbar-none relative min-h-0 flex-1 overflow-y-auto overscroll-contain pb-7 mask-[linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]"
        >
          {synced && !expanded ? (
            <>
              {/* Every earlier turn, not just the last one — the view is kept scrolled so the
               * previous turn sits at the top (see the effect above), so these only appear when
               * the listener scrolls up. Without them, near the end of the script there was
               * nothing left to scroll and the scrollbar vanished. */}
              {turns.slice(0, Math.max(0, active)).map((turn, i) => (
                <button
                  key={i}
                  type="button"
                  data-turn={i}
                  onClick={() => seekTo(i)}
                  aria-label={seekLabel(i)}
                  className="flex w-full items-baseline gap-2.5 border-b border-border/60 px-3 py-2 text-left text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                >
                  <span className="w-9 shrink-0 font-mono text-[10px]">{time(i)}</span>
                  <span className="shrink-0 text-[10px] font-semibold tracking-widest">{turn.speaker === "HOST_A" ? "A" : "B"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">{turn.text}</span>
                </button>
              ))}
              <div data-current className={`flex gap-2.5 px-3 ${compact ? "pt-2.5 pb-3" : "pt-4 pb-4.5"}`} aria-live="off">
                <span className="w-9 shrink-0 pt-px font-mono text-[10px] text-brand-gold">{time(active)}</span>
                <div className="-ml-0.5 flex min-w-0 flex-1 flex-col gap-2 border-l-2 border-brand-gold pl-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-gold">{hostLabel(t, turns[active]!.speaker)}</span>
                    {verdict(active)}
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">{position}</span>
                  </div>
                  <p className={`font-serif text-pretty ${compact ? "text-[15px] leading-normal" : "text-[17px] leading-[1.6]"}`}>{words(active)}</p>
                </div>
              </div>
              {active < turns.length - 1 && (
                <>
                  <div className="flex items-center gap-2 px-3 pb-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">{t("workspace.audioOverviewUpNext")}</span>
                    <span className="h-px flex-1 bg-border/60" />
                  </div>
                  {turns.slice(active + 1).map((turn, k) => {
                    const i = active + 1 + k
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => seekTo(i)}
                        aria-label={seekLabel(i)}
                        className="flex w-full items-baseline gap-2.5 border-b border-border/60 px-3 py-2 text-left text-muted-foreground/60 transition-colors hover:text-muted-foreground"
                      >
                        <span className="w-9 shrink-0 font-mono text-[10px]">{time(i)}</span>
                        <span className="shrink-0 text-[10px] font-semibold tracking-widest">{turn.speaker === "HOST_A" ? "A" : "B"}</span>
                        <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-normal">{turn.text}</span>
                      </button>
                    )
                  })}
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col py-1.5">
              {turns.map((turn, i) => {
                const isActive = synced && i === active
                return (
                  <div
                    key={i}
                    data-turn={i}
                    role={synced ? "button" : undefined}
                    tabIndex={synced ? 0 : undefined}
                    aria-label={synced ? seekLabel(i) : undefined}
                    onClick={synced ? () => seekTo(i) : undefined}
                    onKeyDown={
                      synced
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              seekTo(i)
                            }
                          }
                        : undefined
                    }
                    className={`flex gap-2.5 px-3 py-2 transition-opacity duration-300 ${
                      synced ? "cursor-pointer hover:opacity-100" : ""
                    } ${synced && !isActive ? "opacity-45" : ""}`}
                  >
                    {synced && (
                      <span className={`w-9 shrink-0 pt-0.5 font-mono text-[10px] ${isActive ? "text-brand-gold" : "text-muted-foreground/60"}`}>
                        {time(i)}
                      </span>
                    )}
                    <div className={`flex min-w-0 flex-1 flex-col gap-1 border-l-2 pl-2.5 ${isActive ? "border-brand-gold" : "border-transparent"}`}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-brand-gold">{hostLabel(t, turn.speaker)}</span>
                        {verdict(i)}
                      </div>
                      <p className="text-[13px] leading-5 text-foreground">{isActive ? words(i) : turn.text}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        {synced && expanded && !follow && (
          <button
            type="button"
            onClick={() => setFollow(true)}
            className="absolute right-3 bottom-2.5 h-6.5 rounded-full border border-brand-gold bg-background px-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-brand-gold"
          >
            {t("workspace.audioOverviewBackToCurrent")}
          </button>
        )}
      </div>
    </div>
  )
}
