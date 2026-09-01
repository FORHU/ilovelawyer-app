"use client"

import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import {
  useCreateTimelineMutation,
  useUpdateTimelineMutation,
  useCaseTimelineQuery,
  type CaseTimelineEvent,
} from "@/lib/terminal/mutations"

interface CalendarEvent {
  id: string
  title: string
  dateTime: string
  notes: string | null
}

interface TimelineRow {
  id: string
  rawId: string | null
  at: Date | null
  title: string
  description: string | null
}

function toDateInputValue(at: Date) {
  return at.toISOString().slice(0, 10)
}

function isDateOnly(at: Date) {
  return (
    at.getUTCHours() === 0 &&
    at.getUTCMinutes() === 0 &&
    at.getUTCSeconds() === 0 &&
    at.getUTCMilliseconds() === 0
  )
}

function formatBadge(at: Date) {
  if (isDateOnly(at)) {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
    }).format(at)
  }
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatCaptionDate(at: Date) {
  if (isDateOnly(at)) return null
  return at.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
}

function yearOf(at: Date) {
  return isDateOnly(at) ? at.getUTCFullYear() : at.getFullYear()
}

function dotClass(index: number, total: number) {
  if (index === 0 || index === total - 1) return "bg-teal-400"
  return "bg-sky-500"
}

function toDateTimeLocalValue(date: string, time: string) {
  if (!date) return undefined
  const clock = time || "00:00"
  const parsed = new Date(`${date}T${clock}`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export function CaseTimelineView({ caseId, fill = true }: { caseId: string; fill?: boolean }) {
  const { t } = useTranslation("homepage")
  const timeline = useCaseTimelineQuery(caseId)
  const calendar = useQuery({
    queryKey: ["events", "case", caseId],
    queryFn: () => apiFetch<{ events: CalendarEvent[] }>(`/api/events?caseId=${caseId}`),
    enabled: !!caseId,
  })
  const create = useCreateTimelineMutation(caseId)
  const update = useUpdateTimelineMutation(caseId)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")

  const items = useMemo<TimelineRow[]>(() => {
    const fromCase: TimelineRow[] = (timeline.data ?? []).map((event: CaseTimelineEvent) => ({
      id: `tl-${event.id}`,
      rawId: event.id,
      at: event.occurredOn ? new Date(event.occurredOn) : null,
      title: event.title,
      description: event.description,
    }))
    const fromCalendar: TimelineRow[] = (calendar.data?.events ?? []).map((event) => ({
      id: `cal-${event.id}`,
      rawId: null,
      at: new Date(event.dateTime),
      title: event.title,
      description: event.notes,
    }))
    const seen = new Set<string>()
    return [...fromCase, ...fromCalendar]
      .filter((row) => {
        const key = `${row.title}|${row.at?.toISOString() ?? ""}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => {
        if (!a.at && !b.at) return 0
        if (!a.at) return 1
        if (!b.at) return -1
        return a.at.getTime() - b.at.getTime()
      })
  }, [timeline.data, calendar.data])

  const dated = items.filter((item) => item.at && !Number.isNaN(item.at.getTime()))
  const undated = items.filter((item) => !item.at || Number.isNaN(item.at.getTime()))

  const isLoading = timeline.isLoading || calendar.isLoading
  const isError = timeline.isError || calendar.isError
  const years = new Set(dated.map((item) => yearOf(item.at as Date)))
  const showYearHeaders = years.size > 1

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col overflow-y-auto" : "flex flex-col"}>
      <div className={`mx-auto flex w-full max-w-xl flex-1 flex-col ${fill ? "px-5 py-6 sm:px-8" : "px-0 pt-1 pb-2"}`}>
        {isLoading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {t("timeline.loading", { defaultValue: "Loading timeline…" })}
          </p>
        ) : isError ? (
          <p className="py-16 text-center text-sm text-red-500">
            {t("timeline.loadError", { defaultValue: "Couldn't load this timeline." })}
          </p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t("timeline.emptyState", {
              defaultValue: "No events on this case yet. Add one below, or refresh analysis to extract dates from documents.",
            })}
          </p>
        ) : (
          <div className="flex flex-col gap-10">
            {dated.length > 0 ? (
              <ol className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute top-3.5 bottom-8 w-0.5 bg-gradient-to-b from-teal-400 via-sky-500 to-teal-400"
                  style={{ left: "calc(5.25rem + 0.875rem)", transform: "translateX(-50%)" }}
                />
                {dated.map((item, index) => {
                  const at = item.at as Date
                  const year = yearOf(at)
                  const previous = dated[index - 1]
                  const prevYear = previous?.at ? yearOf(previous.at) : null
                  const showYear = showYearHeaders && year !== prevYear
                  const caption = formatCaptionDate(at)

                  return (
                    <li key={item.id}>
                      {showYear ? (
                        <p className="grid grid-cols-[5.25rem_1.75rem_minmax(0,1fr)] items-center pb-3 pt-2 first:pt-0">
                          <span />
                          <span />
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                            {year}
                          </span>
                        </p>
                      ) : null}
                      <div className="grid grid-cols-[5.25rem_1.75rem_minmax(0,1fr)] items-start">
                        <div className="flex flex-col items-end gap-1 pr-3">
                          <span className="inline-flex h-7 min-w-[3.75rem] shrink-0 items-center justify-center rounded-full bg-rose-300 px-2.5 text-[11px] font-semibold tabular-nums tracking-wide text-white dark:bg-rose-400/90">
                            {formatBadge(at)}
                          </span>
                          {item.rawId && editingId !== item.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id)
                                setEditDate(toDateInputValue(at))
                              }}
                              className="text-[10px] font-medium text-muted-foreground hover:underline"
                            >
                              {t("timeline.editDate", { defaultValue: "Edit date" })}
                            </button>
                          ) : null}
                          {item.rawId && editingId === item.id ? (
                            <div className="flex flex-col items-end gap-1">
                              <input
                                type="date"
                                value={editDate}
                                onChange={(e) => setEditDate(e.target.value)}
                                className="h-7 w-[7.5rem] rounded-lg border border-border bg-muted px-1.5 text-[11px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={update.isPending || !editDate}
                                  onClick={() => {
                                    update.mutate(
                                      { id: item.rawId as string, occurredOn: new Date(`${editDate}T00:00:00Z`).toISOString() },
                                      { onSuccess: () => setEditingId(null) },
                                    )
                                  }}
                                  className="text-[10px] font-semibold text-brand-gold hover:underline disabled:opacity-50"
                                >
                                  {t("timeline.save", { defaultValue: "Save" })}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="text-[10px] font-medium text-muted-foreground hover:underline"
                                >
                                  {t("timeline.cancel", { defaultValue: "Cancel" })}
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                        <div className="relative flex justify-center pt-2">
                          <span
                            className={`relative z-10 size-3 rounded-full ring-[5px] ring-background ${dotClass(index, dated.length)}`}
                          />
                        </div>
                        <div className="min-w-0 pb-7 pl-3">
                          <p className="text-[15px] font-semibold leading-7 text-foreground">{item.title}</p>
                          {caption ? (
                            <p className="text-[12px] leading-4 text-muted-foreground/80">{caption}</p>
                          ) : null}
                          {item.description ? (
                            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{item.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            ) : null}

            {undated.length > 0 ? (
              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("timeline.nextSteps", { defaultValue: "Next steps" })}
                </h3>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-muted/40">
                  {undated.map((item) => (
                    <li key={item.id} className="flex gap-3 px-4 py-3.5">
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-rose-300 dark:bg-rose-400/90" />
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold leading-snug text-foreground">{item.title}</p>
                        {item.description ? (
                          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{item.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <form
          className="mt-auto flex flex-col gap-2.5 border-t border-border pt-5"
          onSubmit={(e) => {
            e.preventDefault()
            const value = title.trim()
            if (!value) return
            create.mutate({
              title: value,
              description: description.trim() || undefined,
              occurredOn: toDateTimeLocalValue(date, time),
            })
            setTitle("")
            setDescription("")
            setDate("")
            setTime("")
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {t("timeline.addHeading", { defaultValue: "Add event" })}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[8rem_6.5rem_1fr]">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label={t("timeline.date", { defaultValue: "Date" })}
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label={t("timeline.time", { defaultValue: "Time" })}
              className="h-9 rounded-lg border border-border bg-muted px-2.5 text-xs text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("timeline.addTitle", { defaultValue: "Event title" })}
              className="col-span-2 h-9 rounded-lg border border-border bg-muted px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 sm:col-span-1"
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("timeline.addDescription", { defaultValue: "What happened" })}
            rows={2}
            className="rounded-lg border border-border bg-muted px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
          <button
            type="submit"
            disabled={create.isPending || !title.trim()}
            className="h-9 self-start rounded-full bg-rose-300 px-4 text-[11px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-rose-400 disabled:opacity-50 dark:bg-rose-400/90"
          >
            {t("timeline.addCta", { defaultValue: "Add event" })}
          </button>
        </form>
      </div>
    </div>
  )
}
