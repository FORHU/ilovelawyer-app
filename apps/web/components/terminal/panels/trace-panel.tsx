import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { TopicRow } from "@/components/chat/topic-navigator"
import { EmptyNote, PanelBody, fieldClass, ghostBtnClass } from "@/components/terminal/panel-kit"
import { isTurnLive, useTraceEventsQuery, useTraceTurnsQuery } from "@/lib/terminal/trace-queries"
import type { TraceEvent, TraceTurn } from "@/lib/terminal/types"

const ALL_MEMBERS = ""

function memberName(turn: TraceTurn, formerMember: string, member: string): string {
  if (!turn.userId) return formerMember
  return turn.userName ?? member
}

/** The text on a trace row: the first line of the plain-language summary, so a long explanation
 * stays one row until it is opened. */
function firstLine(summary: string): string {
  return summary.split("\n").find((line) => line.trim())?.trim() ?? summary
}

// How the AI reached each answer, one turn at a time. A turn is one question and its reply; the
// steps under it are laid out like the chat's topic navigator (the same row), and each opens to
// the full explanation. Everything shown was written for the customer by chat-wonder and stored
// by ilovelawyer-api as the answer was produced — nothing here is reconstructed after the fact.
// On a shared case every member's turns are listed, each attributed, and can be filtered by who
// asked.
export function TracePanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const turnsQuery = useTraceTurnsQuery(caseId)
  const [memberId, setMemberId] = useState(ALL_MEMBERS)
  // The turn the lawyer paged to. Null follows the newest, so a new question moves the pane onto
  // it by itself until they page back on purpose.
  const [pinnedTurnId, setPinnedTurnId] = useState<string | null>(null)

  const allTurns = turnsQuery.data
  const members = useMemo(() => {
    const seen = new Map<string, string>()
    for (const turn of allTurns ?? []) {
      if (turn.userId && !seen.has(turn.userId)) seen.set(turn.userId, memberName(turn, t("traceFormerMember"), t("traceMember")))
    }
    return [...seen]
  }, [allTurns, t])

  const turns = useMemo(
    () => (memberId === ALL_MEMBERS ? (allTurns ?? []) : (allTurns ?? []).filter((turn) => turn.userId === memberId)),
    [allTurns, memberId],
  )

  const pinnedIndex = pinnedTurnId ? turns.findIndex((turn) => turn.turnId === pinnedTurnId) : -1
  const position = pinnedIndex >= 0 ? pinnedIndex : turns.length - 1
  const turn: TraceTurn | undefined = turns[position]
  const isNewest = position === turns.length - 1

  const eventsQuery = useTraceEventsQuery(caseId, turn?.turnId, !!turn && isNewest && isTurnLive(turn))

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
    // Landing back on the newest turn resumes following it.
    setPinnedTurnId(index === turns.length - 1 ? null : target.turnId)
  }

  return (
    <PanelBody gap="3">
      {members.length > 1 && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="shrink-0">{t("traceFilterMember")}</span>
          <select
            className={fieldClass}
            value={memberId}
            onChange={(event) => {
              setMemberId(event.target.value)
              setPinnedTurnId(null)
            }}
          >
            <option value={ALL_MEMBERS}>{t("traceAllMembers")}</option>
            {members.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
      )}

      {!turn ? (
        <EmptyNote>{t("noTraceForMember")}</EmptyNote>
      ) : (
        <>
          <nav className="flex items-center justify-between gap-2" aria-label={t("traceTurnNav")}>
            <button type="button" className={ghostBtnClass} disabled={position <= 0} onClick={() => goTo(position - 1)} aria-label={t("tracePrevTurn")}>
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>
            <span className="text-xs font-medium text-muted-foreground" aria-live="polite">
              {t("traceTurnOf", { current: position + 1, total: turns.length })}
            </span>
            <button type="button" className={ghostBtnClass} disabled={isNewest} onClick={() => goTo(position + 1)} aria-label={t("traceNextTurn")}>
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </nav>

          <header className="flex flex-col gap-0.5">
            <p className="leading-5 font-medium text-foreground">{turn.title}</p>
            <p className="text-xs text-muted-foreground">
              {memberName(turn, t("traceFormerMember"), t("traceMember"))} · {new Date(turn.startedAt).toLocaleString()}
            </p>
          </header>

          <TraceSteps
            // A new turn starts with every step closed, rather than inheriting the last one's.
            key={turn.turnId}
            events={eventsQuery.data}
            isLoading={eventsQuery.isLoading}
            isError={eventsQuery.isError}
          />
        </>
      )}
    </PanelBody>
  )
}

function TraceSteps({ events, isLoading, isError }: { events: TraceEvent[] | undefined; isLoading: boolean; isError: boolean }) {
  const { t } = useTranslation("terminal")
  const [openSeq, setOpenSeq] = useState<number | null>(null)

  if (isLoading) return <EmptyNote>{t("traceLoading")}</EmptyNote>
  if (isError) return <EmptyNote>{t("traceError")}</EmptyNote>
  if (!events || events.length === 0) return <EmptyNote>{t("traceNoSteps")}</EmptyNote>

  return (
    <ul className="flex flex-col gap-0.5">
      {events.map((event) => {
        const label = t(`traceType_${event.type}`, { defaultValue: "" })
        const open = openSeq === event.seq
        return (
          <li key={event.seq}>
            <TopicRow
              topic={{ index: event.seq, title: label ? `${label} — ${firstLine(event.summary)}` : firstLine(event.summary) }}
              isActive={open}
              onJump={(seq) => setOpenSeq(open ? null : seq)}
              compact={false}
            />
            {open && <p className="mt-1 mb-2 ml-6 text-[13px] leading-5 whitespace-pre-line text-muted-foreground">{event.summary}</p>}
          </li>
        )
      })}
    </ul>
  )
}
