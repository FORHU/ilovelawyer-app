import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@workspace/ui/lib/utils"
import { TopicRow } from "@/components/chat/topic-navigator"
import { EmptyNote, PanelBody, TonePill, fieldClass, ghostBtnClass } from "@/components/terminal/panel-kit"
import { isTurnLive, useTraceEventsQuery, useTraceTurnsQuery } from "@/lib/terminal/trace-queries"
import { countSources, countTraceTypes, filterEvents, filterTurns, memberInitial, traceStyle } from "@/lib/terminal/trace-style"
import type { TraceEvent, TraceTurn } from "@/lib/terminal/types"

const ANY = ""

type Translate = (key: string, options?: Record<string, unknown>) => string

function memberName(turn: TraceTurn, t: Translate): string {
  if (turn.userId) return turn.userName ?? t("traceMember")
  // A pane's generation started by the system (a background job) has no one behind it; a chat
  // question always does, so a chat run without a user is a member who has since been removed.
  return turn.source === "chat" ? t("traceFormerMember") : t("traceAutomatic")
}

/** "Question 3", "Witness scoring 2": what produced the run, numbered within its own kind. */
function runLabel(turn: TraceTurn, t: Translate): string {
  return `${t(`traceSource_${turn.source}`, { defaultValue: turn.source })} ${turn.number}`
}

/** The text on a trace row: the first line of the plain-language summary, so a long explanation
 * stays one row until it is opened. */
function firstLine(summary: string): string {
  return summary.split("\n").find((line) => line.trim())?.trim() ?? summary
}

// How the AI reached each answer, one run at a time. A run is a question and its reply, or one of
// the panes' own generations (witness scoring, case reconstruction, ...); each is named by what
// produced it and numbered within that kind, and the pane can be narrowed to one kind and to one
// member. The steps under a run are laid out like the chat's topic navigator (the same row), and
// each opens to the full explanation; the bar and legend above them filter the steps by type.
// Everything shown was written for the customer by chat-wonder and stored by ilovelawyer-api as the
// work happened — nothing here is reconstructed after the fact. Colors: lib/terminal/trace-style.ts.
export function TracePanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const turnsQuery = useTraceTurnsQuery(caseId)
  const [memberId, setMemberId] = useState(ANY)
  const [source, setSource] = useState(ANY)
  // The run the lawyer paged to. Null follows the newest, so new work moves the pane onto it by
  // itself until they page back on purpose.
  const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null)
  // Which type of step is shown ("" = all). Kept across runs: someone reading only the reasoning
  // steps wants to keep reading only those as they page.
  const [stepType, setStepType] = useState(ANY)

  const allTurns = turnsQuery.data
  const members = useMemo(() => {
    const seen = new Map<string, string>()
    for (const turn of allTurns ?? []) {
      if (turn.userId && !seen.has(turn.userId)) seen.set(turn.userId, memberName(turn, t))
    }
    return [...seen]
  }, [allTurns, t])
  const sources = useMemo(() => countSources(allTurns ?? []), [allTurns])

  const turns = useMemo(() => filterTurns(allTurns ?? [], { memberId, source }), [allTurns, memberId, source])

  const pinnedIndex = pinnedTurnId ? turns.findIndex((turn) => turn.turnId === pinnedTurnId) : -1
  const position = pinnedIndex >= 0 ? pinnedIndex : turns.length - 1
  const turn: TraceTurn | undefined = turns[position]
  const isNewest = position === turns.length - 1
  const live = !!turn && isNewest && isTurnLive(turn)

  const eventsQuery = useTraceEventsQuery(caseId, turn?.turnId, live)

  if (turnsQuery.isLoading) {
    return (
      <PanelBody gap="3">
        <EmptyNote>{t("traceLoading")}</EmptyNote>
      </PanelBody>
    )
  }
  if (turnsQuery.isError) {
    return (
      <PanelBody gap="3">
        <EmptyNote>{t("traceError")}</EmptyNote>
      </PanelBody>
    )
  }
  if (!allTurns || allTurns.length === 0) {
    return (
      <PanelBody gap="3">
        <EmptyNote>{t("noTrace")}</EmptyNote>
      </PanelBody>
    )
  }

  const goTo = (index: number) => {
    const target = turns[index]
    if (!target) return
    // Landing back on the newest run resumes following it.
    setPinnedTurnId(index === turns.length - 1 ? null : target.turnId)
  }
  const narrow = (apply: () => void) => {
    apply()
    setPinnedTurnId(null)
  }

  return (
    <PanelBody gap="3">
      {(sources.length > 1 || members.length > 1) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {sources.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="shrink-0">{t("traceFilterSource")}</span>
              <select className={fieldClass} value={source} onChange={(event) => narrow(() => setSource(event.target.value))}>
                <option value={ANY}>{t("traceAllActivity")}</option>
                {sources.map(({ source: key, count }) => (
                  <option key={key} value={key}>
                    {t(`traceSource_${key}`, { defaultValue: key })} ({count})
                  </option>
                ))}
              </select>
            </label>
          )}
          {members.length > 1 && (
            <label className="flex items-center gap-2">
              <span className="shrink-0">{t("traceFilterMember")}</span>
              <select className={fieldClass} value={memberId} onChange={(event) => narrow(() => setMemberId(event.target.value))}>
                <option value={ANY}>{t("traceAllMembers")}</option>
                {members.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {!turn ? (
        <EmptyNote>{t("noTraceForFilter")}</EmptyNote>
      ) : (
        <>
          <nav className="flex items-center justify-between gap-2" aria-label={t("traceTurnNav")}>
            <button type="button" className={ghostBtnClass} disabled={position <= 0} onClick={() => goTo(position - 1)} aria-label={t("tracePrevTurn")}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <div className="flex flex-col items-center leading-tight" aria-live="polite">
              <span className="text-sm font-bold text-foreground">{runLabel(turn, t)}</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">{t("traceOfN", { current: position + 1, total: turns.length })}</span>
            </div>
            <button type="button" className={ghostBtnClass} disabled={isNewest} onClick={() => goTo(position + 1)} aria-label={t("traceNextTurn")}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </nav>

          <TurnHeader turn={turn} live={live} />

          <TraceSteps
            // A new run starts with every step closed, rather than inheriting the last one's.
            key={turn.turnId}
            events={eventsQuery.data}
            isLoading={eventsQuery.isLoading}
            isError={eventsQuery.isError}
            stepType={stepType}
            onStepType={setStepType}
          />
        </>
      )}
    </PanelBody>
  )
}

/** What was asked (a chat question), who started the run and when. The gold initial is the same
 * brand gold as the rest of the Terminal's active states; "Live" shows while the newest run is
 * still being written. */
function TurnHeader({ turn, live }: { turn: TraceTurn; live: boolean }) {
  const { t } = useTranslation("terminal")
  const name = memberName(turn, t)
  return (
    <header className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-gold text-[11px] font-bold text-brand-gold-foreground"
      >
        {memberInitial(turn.userId || turn.source !== "chat" ? name : null)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {turn.title && <p className="leading-5 font-medium text-foreground">{turn.title}</p>}
        <p className={cn("text-xs text-muted-foreground", !turn.title && "pt-1")}>
          {name} · {new Date(turn.startedAt).toLocaleString()}
        </p>
      </div>
      {live && (
        <TonePill tone="ok" title={t("traceLiveHint")}>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-ok motion-safe:animate-pulse" aria-hidden="true" />
            {t("traceLive")}
          </span>
        </TonePill>
      )}
    </header>
  )
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

function TraceSteps({
  events,
  isLoading,
  isError,
  stepType,
  onStepType,
}: {
  events: TraceEvent[] | undefined
  isLoading: boolean
  isError: boolean
  stepType: string
  onStepType: (type: string) => void
}) {
  const { t } = useTranslation("terminal")
  const [openSeq, setOpenSeq] = useState<number | null>(null)

  const kinds = useMemo(
    () =>
      countTraceTypes(events ?? []).map(({ type, count }) => ({
        type,
        count,
        label: t(`traceType_${type}`, { defaultValue: type }),
      })),
    [events, t],
  )
  const shown = useMemo(() => filterEvents(events ?? [], stepType), [events, stepType])

  if (isLoading) return <EmptyNote>{t("traceLoading")}</EmptyNote>
  if (isError) return <EmptyNote>{t("traceError")}</EmptyNote>
  if (!events || events.length === 0) return <EmptyNote>{t("traceNoSteps")}</EmptyNote>

  // Choosing the type that is already chosen switches the filter off.
  const toggle = (type: string) => onStepType(stepType === type ? ANY : type)
  const filtering = stepType !== ANY

  return (
    <>
      <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full">
        {kinds.map((kind) => (
          <button
            key={kind.type}
            type="button"
            aria-label={t("traceFilterTo", { kind: kind.label })}
            onClick={() => toggle(kind.type)}
            className={cn("min-w-1 cursor-pointer border-0 p-0 transition-opacity", traceStyle(kind.type).bar, focusRing, filtering && stepType !== kind.type && "opacity-20")}
            style={{ flexGrow: kind.count, flexBasis: 0 }}
          />
        ))}
      </div>

      <div role="group" aria-label={t("traceFilterByType")} className="-ml-1.5 flex flex-wrap gap-x-1.5 gap-y-1">
        {kinds.map((kind) => {
          const style = traceStyle(kind.type)
          const on = stepType === kind.type
          return (
            <button
              key={kind.type}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(kind.type)}
              className={cn(
                "inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-full border px-2 text-[11px] font-bold tracking-wide uppercase transition-opacity",
                focusRing,
                on ? cn(style.chipOn, "text-foreground") : "border-transparent text-muted-foreground hover:bg-muted",
                filtering && !on && "opacity-40",
              )}
            >
              <span className={cn("size-[7px] rounded-full", style.bar)} aria-hidden="true" />
              <span>{kind.label}</span>
              <span className="font-semibold text-muted-foreground">{kind.count}</span>
            </button>
          )
        })}
      </div>

      {filtering && (
        <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground">
          <span>
            {t("traceShowing", {
              shown: shown.length,
              total: events.length,
              kind: t(`traceType_${stepType}`, { defaultValue: stepType }),
            })}
          </span>
          <button
            type="button"
            onClick={() => onStepType(ANY)}
            className={cn("cursor-pointer rounded px-1.5 py-1 text-xs font-semibold text-brand-gold hover:underline", focusRing)}
          >
            {t("traceShowAll")}
          </button>
        </div>
      )}

      <ul className="flex flex-col gap-0.5">
        {shown.map((event) => {
          const style = traceStyle(event.type)
          const label = t(`traceType_${event.type}`, { defaultValue: "" })
          const open = openSeq === event.seq
          return (
            <li key={event.seq}>
              <TopicRow
                topic={{ index: event.seq, title: firstLine(event.summary) }}
                isActive={open}
                onJump={(seq) => setOpenSeq(open ? null : seq)}
                compact={false}
                dotClassName={style.bar}
                leading={label ? <TracePill type={event.type}>{label}</TracePill> : undefined}
                // A step's first line can run to a sentence or two: open it above the row, capped
                // to the window and wrapped, instead of one long line off the left edge.
                tooltipSide="top"
                tooltipClassName="max-w-[min(26rem,calc(100vw-2rem))] text-left break-words"
              />
              {open && (
                <p
                  className={cn(
                    "mt-1 mb-2 ml-4 rounded-r-md border-l-2 px-3 py-2 text-[13px] leading-5 whitespace-pre-line text-foreground/80",
                    style.edge,
                    style.tint,
                  )}
                >
                  {event.summary}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** A step's kind as a small colored label, in the same shape as the Terminal's other pills. */
function TracePill({ type, children }: { type: string; children: ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px]",
        traceStyle(type).badge,
      )}
    >
      {children}
    </span>
  )
}
