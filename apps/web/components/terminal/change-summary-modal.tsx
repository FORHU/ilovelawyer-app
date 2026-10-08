"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react"
import { useTranslation } from "react-i18next"
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, History, Pencil, X } from "lucide-react"
import {
  canViewChangeSummary,
  changeSummaryDays,
  changeSummaryHistory,
  dayKeyOf,
  describeChangeHeadline,
  describeChangeLines,
  describeChangeRun,
  describeDay,
  shouldShowChangeSummary,
  type CaseChangeSummary,
  type ChangePart,
  type ChangeSummaryDay,
} from "@/lib/terminal/change-summary"
import {
  useChangeSummaryDaysQuery,
  useChangeSummaryHistoryQuery,
  useEditsBeforeRunQuery,
  useManualEditSessionsQuery,
} from "@/lib/terminal/mutations"
import {
  describeEditLines,
  mergeHistory,
  pickHistoryItem,
  sessionAuthor,
  sessionKey,
  type EditSession,
  type HistoryFilter,
  type ManualEdit,
  type ManualEditValue,
} from "@/lib/terminal/manual-edits"
import { useAuthStore } from "@/lib/store/auth.store"
import {
  readDismissedChangeSummary,
  subscribeDismissedChangeSummaries,
  writeDismissedChangeSummary,
} from "@/lib/terminal/change-summary-dismissal"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import type { PanelId } from "@/lib/terminal/types"
import { ModalOverlay } from "@/components/terminal/terminal-canvas"

// Most new documents named under the headline before the rest are counted.
const MAX_NAMED_DOCUMENTS = 3

/**
 * When the "What changed" modal is open. It opens by itself for a summary this viewer hasn't seen
 * yet — once the analysis (or a pane's Regenerate) that wrote it has finished — and again whenever
 * the header button asks. Closing it marks that summary seen, in this browser only.
 */
export function useChangeSummaryModal(caseId: string, summary: CaseChangeSummary | null | undefined, analysisRunning: boolean) {
  // undefined on the server (no localStorage there): nothing opens until the client has read
  // which summary was last seen, rather than flashing one already seen.
  const seenId = useSyncExternalStore(
    subscribeDismissedChangeSummaries,
    () => readDismissedChangeSummary(caseId),
    () => undefined,
  )
  // The summary the button reopened, so the modal stays open even though it's been seen.
  const [reopenedId, setReopenedId] = useState<string | null>(null)

  const canView = canViewChangeSummary(summary)
  const unseen = seenId !== undefined && shouldShowChangeSummary(summary, seenId)
  const open = !!summary && canView && (reopenedId === summary.id || (unseen && !analysisRunning))

  return {
    canView,
    unseen,
    open,
    show: () => summary && setReopenedId(summary.id),
    close: () => {
      if (summary) writeDismissedChangeSummary(caseId, summary.id)
      setReopenedId(null)
    },
  }
}

/** The case row's "What changed" button — reopens the latest change summary. A dot marks one not
 * seen yet (it opens by itself once the running analysis finishes). */
export function ChangeSummaryButton({ unseen, onClick }: { unseen: boolean; onClick: () => void }) {
  const { t } = useTranslation("terminal")
  const label = unseen ? t("changeViewButtonUnseen") : t("changeViewButton")
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover"
    >
      <History className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
      <span className="hidden sm:inline">{t("changeViewButton")}</span>
      {unseen && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand-gold ring-2 ring-card" aria-hidden="true" />}
    </button>
  )
}

/** A calendar day key (YYYY-MM-DD) formatted for reading. The key is already the viewer's day, so
 * it's formatted as UTC to keep the browser from shifting it. */
function formatDay(day: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" })
}

/**
 * The modal header's day picker: ‹ and › step to the earlier or later day with runs, and the middle
 * button opens a list of every such day — "Today", "Yesterday" or the date, the weekday and date
 * under it, and the day's runs and changes. Rendered inside the modal rather than portalled, so it
 * keeps the Terminal's dark palette and stays inside the modal's focus trap.
 */
function DayPicker({
  days,
  selectedDay,
  today,
  yesterday,
  onPick,
}: {
  days: ChangeSummaryDay[]
  selectedDay: string
  today: string
  yesterday: string
  onPick: (day: string) => void
}) {
  const { t } = useTranslation("terminal")
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const index = days.findIndex((d) => d.day === selectedDay)

  const name = (day: string) => {
    const part = describeDay(day, today, yesterday)
    return part.key === "changeDayDate" ? formatDay(day, { month: "short", day: "numeric", year: "numeric" }) : t(part.key)
  }
  // Under "Today"/"Yesterday" the date; under a date, its weekday.
  const detail = (day: string) =>
    day === today || day === yesterday ? formatDay(day, { weekday: "short", month: "short", day: "numeric" }) : formatDay(day, { weekday: "long" })

  // Closes on a press anywhere outside it.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  // Opening moves focus to the selected day, so arrow keys start from there.
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
  }, [open])

  const choose = (day: string) => {
    onPick(day)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const options = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    const at = options.indexOf(document.activeElement as HTMLElement)
    const move = (to: number) => {
      event.preventDefault()
      options[Math.max(0, Math.min(options.length - 1, to))]?.focus()
    }
    if (event.key === "ArrowDown") move(at + 1)
    else if (event.key === "ArrowUp") move(at - 1)
    else if (event.key === "Home") move(0)
    else if (event.key === "End") move(options.length - 1)
    else if (event.key === "Escape" || event.key === "Tab") {
      // Escape closes the list, not the whole modal.
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
      }
      setOpen(false)
      triggerRef.current?.focus()
    }
  }

  const stepClass =
    "flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/50 disabled:pointer-events-none disabled:opacity-35 dark:hover:bg-overlay-hover"

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex h-8 items-stretch overflow-hidden rounded-md border border-border bg-background/40">
        {/* Days run newest first: "earlier" is the next one down the list. */}
        <button
          type="button"
          onClick={() => days[index + 1] && onPick(days[index + 1]!.day)}
          disabled={index < 0 || index >= days.length - 1}
          aria-label={t("changeDayOlder")}
          title={t("changeDayOlder")}
          className={stepClass}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${t("changeDayPicker")}: ${name(selectedDay)}`}
          className="flex min-w-0 items-center gap-2 border-x border-border px-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/50 dark:hover:bg-overlay-hover"
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
          <span className="truncate text-xs font-semibold text-foreground">{name(selectedDay)}</span>
          <span className="hidden truncate text-[11px] text-muted-foreground sm:inline">{detail(selectedDay)}</span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => index > 0 && onPick(days[index - 1]!.day)}
          disabled={index <= 0}
          aria-label={t("changeDayNewer")}
          title={t("changeDayNewer")}
          className={stepClass}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t("changeDayPicker")}
          onKeyDown={onListKeyDown}
          className="absolute right-0 top-full z-20 mt-1.5 grid max-h-80 w-72 gap-0.5 overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-2xl"
        >
          {days.map((d) => {
            const active = d.day === selectedDay
            return (
              <li key={d.day}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => choose(d.day)}
                  className={`grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold/50 ${
                    active ? "bg-brand-gold/10" : "hover:bg-muted dark:hover:bg-overlay-hover"
                  }`}
                >
                  <span className="row-span-2 flex items-center justify-center">
                    {active && <Check className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />}
                  </span>
                  <span className={`truncate text-xs ${active ? "font-semibold text-foreground" : "text-foreground"}`}>{name(d.day)}</span>
                  <span className="text-right text-[11px] tabular-nums text-muted-foreground">
                    {[
                      d.runs > 0 ? t("changeDayRuns", { count: d.runs }) : null,
                      d.editSessions ? t("changeDayEditSessions", { count: d.editSessions }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  <span className="truncate text-[10px] text-muted-foreground">{detail(d.day)}</span>
                  <span className="text-right text-[10px] tabular-nums text-muted-foreground">
                    {d.runs > 0 ? t("changeDayChanges", { count: d.totalChanges }) : ""}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const FILTER_KEY = "terminalChangeHistoryFilter"

/** The History filter this browser last chose. Storage that is blocked just means "All". */
function readHistoryFilter(): HistoryFilter {
  try {
    const value = localStorage.getItem(FILTER_KEY)
    return value === "analysis" || value === "edits" ? value : "all"
  } catch {
    return "all"
  }
}

function writeHistoryFilter(value: HistoryFilter) {
  try {
    localStorage.setItem(FILTER_KEY, value)
  } catch {
    // Storage unavailable — the filter lasts until the modal closes.
  }
}

/** "credibilityOverride" → "Credibility override", "MATERIAL" → "Material". */
function humanize(text: string): string {
  const spaced = text.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * What changed on a day: its AI runs (a refresh or a pane's Regenerate) and lawyers' editing
 * sessions, in one History list newest first, narrowed by an All / Analysis / Edits filter. The
 * header's date picker chooses the day; the latest run is selected when the modal opens. A run
 * shows its pane lines and how many edits lawyers made since the run before it; a session shows its
 * edits by pane. Every line has a link that closes the modal and opens that pane. Days are the
 * viewer's own calendar days (their browser's time zone).
 */
export function ChangeSummaryModal({
  caseId,
  summary,
  onClose,
  onOpenPane,
}: {
  caseId: string
  /** The latest summary (the snapshot's), selected when the modal opens. */
  summary: CaseChangeSummary
  onClose: () => void
  onOpenPane: (pane: PanelId) => void
}) {
  const { t } = useTranslation("terminal")
  const viewerId = useAuthStore((state) => state.user?.id)
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", [])
  const [selectedDay, setSelectedDay] = useState(() => dayKeyOf(summary.createdAt, timeZone))
  // null = the newest entry of the selected day.
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [filter, setFilterState] = useState<HistoryFilter>(readHistoryFilter)

  const daysQuery = useChangeSummaryDaysQuery(caseId, summary.id, timeZone)
  const days = changeSummaryDays(summary, daysQuery.data, timeZone)
  const runsQuery = useChangeSummaryHistoryQuery(caseId, summary.id, selectedDay, timeZone)
  const sessionsQuery = useManualEditSessionsQuery(caseId, summary.id, selectedDay, timeZone)
  const runs = changeSummaryHistory(summary, runsQuery.data, selectedDay, timeZone)
  const items = mergeHistory(runs, sessionsQuery.data ?? [], filter)
  const selected = pickHistoryItem(items, selectedKey)
  const selectedRun = selected?.type === "run" ? selected.run : undefined
  const selectedSession = selected?.type === "edits" ? selected.session : undefined
  const editsBefore = useEditsBeforeRunQuery(caseId, selectedRun?.id ?? null)
  const loading = runsQuery.isPending || sessionsQuery.isPending
  const failed = runsQuery.isError || sessionsQuery.isError

  // Read once when the modal opens, for naming days "Today" and "Yesterday".
  const [{ today, yesterday }] = useState(() => {
    const now = Date.now()
    return { today: dayKeyOf(new Date(now), timeZone), yesterday: dayKeyOf(new Date(now - 24 * 60 * 60 * 1000), timeZone) }
  })
  const pickDay = (day: string) => {
    setSelectedDay(day)
    setSelectedKey(null)
  }
  const setFilter = (value: HistoryFilter) => {
    setFilterState(value)
    writeHistoryFilter(value)
    setSelectedKey(null)
  }
  // "N edits since the previous run" → that day, that session, with edits showing.
  const openSession = (session: { id: string; startedAt: string }) => {
    if (filter === "analysis") {
      setFilterState("all")
      writeHistoryFilter("all")
    }
    setSelectedDay(dayKeyOf(session.startedAt, timeZone))
    setSelectedKey(sessionKey(session.id))
  }

  // Translates one ChangePart, naming outlook bands, pane ids and change counts the way the user reads them.
  const text = ({ key, values }: ChangePart) => {
    if (!values) return t(key)
    if (key === "changeOutlookBand") return t(key, { from: t(`band_${values.from}`), to: t(`band_${values.to}`) })
    if (key === "changeOutlookFirst") return t(key, { band: t(`band_${values.band}`) })
    return t(key, {
      ...values,
      ...("changes" in values ? { changes: t("changeCount", { count: Number(values.changes) }) } : {}),
      ...("pane" in values ? { pane: PANEL_TITLES[values.pane as PanelId] } : {}),
    })
  }
  const when = (iso: string, style: "full" | "time") => {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ""
    return style === "time"
      ? date.toLocaleTimeString(undefined, { timeStyle: "short" })
      : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }
  const span = (session: EditSession) => {
    const from = when(session.startedAt, "time")
    const to = when(session.endedAt, "time")
    return from === to ? from : `${from}–${to}`
  }
  // "Today", "Yesterday", or the date.
  const dayLabel = (day: string) => {
    const part = describeDay(day, today, yesterday)
    return part.key === "changeDayDate" ? formatDay(day, { dateStyle: "medium" }) : t(part.key)
  }

  // ── Editing sessions ─────────────────────────────────────────────────────────
  const author = (session: { actorId: string | null; actorName: string | null }) => {
    const who = sessionAuthor(session, viewerId)
    return who === "you" ? t("editYou") : (who ?? t("editSomeone"))
  }
  const sessionTitle = (session: EditSession) =>
    sessionAuthor(session, viewerId) === "you" ? t("editSessionYours") : t("editSessionBy", { name: author(session) })
  const sessionHeadline = (session: EditSession) =>
    sessionAuthor(session, viewerId) === "you"
      ? t("editSessionHeadlineYou", { count: session.editCount })
      : t("editSessionHeadline", { name: author(session), count: session.editCount })
  const fieldLabel = (field: string) => t(`editField_${field}`, { defaultValue: humanize(field) })
  const valueText = (value: ManualEditValue | undefined) => {
    if (value === null || value === undefined || value === "") return "—"
    if (typeof value === "boolean") return t(value ? "editYes" : "editNo")
    if (typeof value === "string" && /^[A-Z][A-Z_]+$/.test(value)) return humanize(value)
    return String(value)
  }
  const editText = (edit: ManualEdit) => {
    const base = t(`editAction_${edit.action}`, { label: edit.label })
    const changes = (edit.changes ?? []).map((c) =>
      "from" in c || "to" in c ? `${fieldLabel(c.field)} ${valueText(c.from)} → ${valueText(c.to)}` : fieldLabel(c.field),
    )
    return changes.length ? `${base} (${changes.join(", ")})` : base
  }

  // ── The selected run ─────────────────────────────────────────────────────────
  const runLines = selectedRun ? describeChangeLines(selectedRun.perPaneDeltas) : []
  const named = selectedRun?.documentsAdded.flatMap((d) => (d.name ? [d.name] : [])) ?? []
  const moreDocuments = (selectedRun?.documentsAdded.length ?? 0) - Math.min(named.length, MAX_NAMED_DOCUMENTS)
  const editsBeforeRun = editsBefore.data && editsBefore.data.count > 0 ? editsBefore.data : null

  const openPaneButton = (pane: PanelId, close: () => void) => (
    <button
      type="button"
      onClick={() => {
        close()
        onOpenPane(pane)
      }}
      aria-label={t("changeOpenPaneLabel", { pane: PANEL_TITLES[pane] })}
      className="shrink-0 text-[10px] font-semibold uppercase tracking-[1px] text-brand-gold hover:underline"
    >
      {t("changeOpenPane")}
    </button>
  )

  const filters: { value: HistoryFilter; label: string }[] = [
    { value: "all", label: t("historyFilterAll") },
    { value: "analysis", label: t("historyFilterAnalysis") },
    { value: "edits", label: t("historyFilterEdits") },
  ]

  return (
    <ModalOverlay
      onClose={onClose}
      labelledBy="change-summary-title"
      aria-describedby="change-summary-headline"
      backdropClassName="absolute inset-0 z-[95] flex items-center justify-center bg-black/50"
      className="flex h-[min(40rem,calc(100%-2rem))] w-[min(56rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl focus:outline-none"
    >
      {(close) => (
        <>
          <div className="flex shrink-0 items-start gap-3 border-b border-border p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
              {selectedSession ? <Pencil className="h-4 w-4" aria-hidden="true" /> : <History className="h-4 w-4" aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p id="change-summary-title" className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                {selectedSession ? sessionTitle(selectedSession) : t("changeModalTitle")}
                {selected && (
                  <span className="font-normal normal-case tracking-normal">
                    {" · "}
                    {selectedSession
                      ? `${formatDay(dayKeyOf(selectedSession.startedAt, timeZone), { dateStyle: "medium" })}, ${span(selectedSession)}`
                      : when(selected.at, "full")}
                  </span>
                )}
              </p>
              <p id="change-summary-headline" className="mt-1 truncate text-sm font-semibold text-foreground">
                {!selected
                  ? loading
                    ? t("changeDayLoading")
                    : t("changeNoLines")
                  : selectedSession
                    ? sessionHeadline(selectedSession)
                    : selectedRun!.firstAnalysis
                      ? t("changeHeadlineFirst")
                      : text(describeChangeHeadline(selectedRun!))}
              </p>
              {/* Always one line, empty or not, so the header keeps its height from entry to entry. */}
              <p className="mt-1 h-4 truncate text-[11px] text-muted-foreground">
                {named.length > 0 && (
                  <>
                    {t("changeNewDocuments", { names: named.slice(0, MAX_NAMED_DOCUMENTS).join(", ") })}
                    {moreDocuments > 0 ? ` ${t("changeMoreDocuments", { count: moreDocuments })}` : ""}
                  </>
                )}
              </p>
            </div>
            <DayPicker days={days} selectedDay={selectedDay} today={today} yesterday={yesterday} onPick={pickDay} />
            <button
              type="button"
              onClick={close}
              aria-label={t("changeClose")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
            <nav aria-label={t("changeHistory")} className="flex max-h-48 shrink-0 flex-col border-b border-border md:max-h-none md:border-b-0 md:border-r">
              <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-1 pt-3">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                  {t("changeHistory")} · {dayLabel(selectedDay)}
                </p>
              </div>
              <div role="group" aria-label={t("historyFilterLabel")} className="mx-3 mb-2 grid shrink-0 grid-cols-3 rounded-md border border-border p-0.5">
                {filters.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    aria-pressed={filter === f.value}
                    className={`h-6 rounded text-[10px] font-semibold uppercase tracking-[0.8px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 ${
                      filter === f.value ? "bg-brand-gold/15 text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <ul className="grid min-h-0 gap-0.5 overflow-y-auto px-2 pb-3">
                {items.map((item) => {
                  const active = item.key === selected?.key
                  const rowClass = `grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    active ? "bg-brand-gold/10" : "hover:bg-muted dark:hover:bg-overlay-hover"
                  }`
                  return (
                    <li key={item.key}>
                      <button type="button" onClick={() => setSelectedKey(item.key)} aria-current={active ? "true" : undefined} className={rowClass}>
                        {item.type === "run" ? (
                          <>
                            <span className={`truncate text-xs text-foreground ${active ? "font-semibold" : ""}`}>{text(describeChangeRun(item.run))}</span>
                            <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate tabular-nums">{when(item.run.createdAt, "time")}</span>
                              {!item.run.firstAnalysis && <span className="shrink-0 tabular-nums">{t("changeCount", { count: item.run.totalChanges })}</span>}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className={`flex min-w-0 items-center gap-1.5 text-xs text-foreground ${active ? "font-semibold" : ""}`}>
                              <Pencil className="h-3 w-3 shrink-0 text-brand-gold" aria-hidden="true" />
                              <span className="truncate">{sessionTitle(item.session)}</span>
                            </span>
                            <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate tabular-nums">{span(item.session)}</span>
                              <span className="shrink-0 tabular-nums">{t("editCount", { count: item.session.editCount })}</span>
                            </span>
                          </>
                        )}
                      </button>
                    </li>
                  )
                })}
                {loading && items.length === 0 && <li className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("changeHistoryLoading")}</li>}
                {!loading && !failed && items.length === 0 && (
                  <li className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("historyEmpty")}</li>
                )}
                {failed && <li className="px-2 py-1.5 text-[11px] text-danger">{t("changeHistoryError")}</li>}
              </ul>
            </nav>

            <div className="min-h-0 overflow-y-auto p-4 text-xs">
              {selectedSession ? (
                <ul className="grid gap-2">
                  {describeEditLines(selectedSession).map((line) => (
                    <li key={line.pane} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="w-40 shrink-0 text-[11px] text-muted-foreground">{PANEL_TITLES[line.pane] ?? line.pane}</span>
                      <span className="min-w-0 flex-1 text-foreground">
                        {line.edits.map(editText).join("; ")}
                        {line.more > 0 ? `; ${t("editMore", { count: line.more })}` : ""}
                      </span>
                      {PANEL_TITLES[line.pane] && openPaneButton(line.pane, close)}
                    </li>
                  ))}
                </ul>
              ) : selectedRun ? (
                <>
                  {selectedRun.id !== summary.id && (
                    <p className="mb-3 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground dark:bg-overlay-hover">{t("changePastRun")}</p>
                  )}
                  {editsBeforeRun && (
                    <button
                      type="button"
                      onClick={() => editsBeforeRun.firstSession && openSession(editsBeforeRun.firstSession)}
                      disabled={!editsBeforeRun.firstSession}
                      className="mb-3 flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-[11px] text-foreground transition-colors hover:bg-muted disabled:cursor-default dark:hover:bg-overlay-hover"
                    >
                      <Pencil className="h-3.5 w-3.5 shrink-0 text-brand-gold" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        {t("editsBeforeRun", { count: editsBeforeRun.count, people: editsBeforeRun.actors.map((a) => author({ actorId: a.id, actorName: a.name })).join(", ") })}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    </button>
                  )}
                  {selectedRun.firstAnalysis && (
                    <p className="mb-3 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground dark:bg-overlay-hover">{t("changeFirstAnalysis")}</p>
                  )}
                  {runLines.length > 0 ? (
                    <ul className="grid gap-2">
                      {runLines.map((line, i) => (
                        <li key={`${line.pane}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="w-40 shrink-0 text-[11px] text-muted-foreground">{PANEL_TITLES[line.pane]}</span>
                          <span className={`min-w-0 flex-1 ${line.notUpdated ? "text-progress" : "text-foreground"}`}>{line.parts.map(text).join(", ")}</span>
                          {openPaneButton(line.pane, close)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground">{t("changeNoLines")}</p>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">{failed ? t("changeHistoryError") : loading ? t("changeDayLoading") : t("historyEmpty")}</p>
              )}
            </div>
          </div>

          <div className="flex justify-end border-t border-border p-3">
            <button
              type="button"
              onClick={close}
              className="h-8 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-gold-foreground transition-colors hover:bg-brand-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
            >
              {t("changeClose")}
            </button>
          </div>
        </>
      )}
    </ModalOverlay>
  )
}
