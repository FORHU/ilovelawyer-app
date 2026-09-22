"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import {
  terminalKeys,
  useAiJobStatus,
  useCreateTimelineMutation,
  useGenerateTimelineMutation,
  useUpdateTimelineMutation,
} from "@/lib/terminal/mutations"
import { useGraphViewQuery, graphViewKeys } from "@/lib/graph-view/mutations"

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
  if (index === 0 || index === total - 1) return "bg-brand-gold"
  return "bg-muted-foreground/50"
}

function toDateTimeLocalValue(date: string, time: string) {
  if (!date) return undefined
  // No time chosen means this is a date-only event — anchor it to UTC midnight (like the
  // edit-date path already does) so isDateOnly() recognizes it and renders the date instead
  // of a time. A real time picks the user's local clock, since it's an actual time-of-day.
  const parsed = time ? new Date(`${date}T${time}`) : new Date(`${date}T00:00:00Z`)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString()
}

export function CaseTimelineView({
  caseId,
  fill = true,
  // Studio panel (studio-panel.tsx) puts its own Generate control in the tile's header, next to
  // the "Timeline" breadcrumb, instead of this content-area button — Legal Terminal's Evidence
  // panel and the chat's embedded timeline tab have no equivalent header slot, so they keep it.
  hideGenerateButton = false,
}: {
  caseId: string
  fill?: boolean
  hideGenerateButton?: boolean
}) {
  const { t } = useTranslation("homepage")
  const timeline = useGraphViewQuery(caseId, "timeline")
  const calendar = useQuery({
    queryKey: ["events", "case", caseId],
    queryFn: () => apiFetch<{ events: CalendarEvent[] }>(`/api/events?caseId=${caseId}`),
    enabled: !!caseId,
  })
  const create = useCreateTimelineMutation(caseId)
  const update = useUpdateTimelineMutation(caseId)
  const queryClient = useQueryClient()
  const generate = useGenerateTimelineMutation(caseId)
  const generateStatus = useAiJobStatus(caseId, "timelineGenerate")
  // Automatic generation runs as one step inside a document upload's post-extraction
  // "caseRefresh" job (queues/case-post-extraction.ts), not under "timelineGenerate" — both kinds
  // feed this same "is it generating right now" flag, or an upload-triggered run never shows the
  // "Generating…" state here despite genuinely being in progress.
  const caseRefreshStatus = useAiJobStatus(caseId, "caseRefresh")
  const isGenerating = generateStatus.data?.status === "IN_PROGRESS" || caseRefreshStatus.data?.status === "IN_PROGRESS"

  // useAiJobStatus only auto-invalidates the case snapshot on an IN_PROGRESS -> DONE transition —
  // this panel reads the timeline via graph-view, not the snapshot, so it refetches those itself.
  const prevGenerateStatus = useRef(generateStatus.data?.status)
  useEffect(() => {
    if (prevGenerateStatus.current === "IN_PROGRESS" && generateStatus.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: terminalKeys.timeline(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevGenerateStatus.current = generateStatus.data?.status
  }, [generateStatus.data?.status, caseId, queryClient])

  const prevCaseRefreshStatus = useRef(caseRefreshStatus.data?.status)
  useEffect(() => {
    if (prevCaseRefreshStatus.current === "IN_PROGRESS" && caseRefreshStatus.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: terminalKeys.timeline(caseId) })
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevCaseRefreshStatus.current = caseRefreshStatus.data?.status
  }, [caseRefreshStatus.data?.status, caseId, queryClient])

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")

  const items = useMemo<TimelineRow[]>(() => {
    // Graph-view's timeline view also carries PROCEDURAL_DEADLINE nodes (for the
    // TRIGGERS_DEADLINE dependency edge) — this view only ever rendered case events, so those
    // are filtered out rather than shown as a differently-shaped row.
    const fromCase: TimelineRow[] = (timeline.data?.nodes ?? [])
      .filter((node) => node.type === "TIMELINE_EVENT")
      .map((node) => {
        const event = node.data as { occurredOn: string | null; title: string; description: string | null }
        return {
          id: `tl-${node.refId}`,
          rawId: node.refId,
          at: event.occurredOn ? new Date(event.occurredOn) : null,
          title: event.title,
          description: event.description,
        }
      })
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

  // `dated` is already sorted ascending, so the same year only ever appears in consecutive
  // runs — no need to bucket by a Map. Always grouped (not just when the case spans more than
  // one year) so every year gets its own header row, same as a day divider in an activity feed.
  const yearGroups: { year: number; items: TimelineRow[] }[] = []
  dated.forEach((item) => {
    const year = yearOf(item.at as Date)
    const last = yearGroups[yearGroups.length - 1]
    if (last && last.year === year) last.items.push(item)
    else yearGroups.push({ year, items: [item] })
  })

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col overflow-y-auto" : "flex flex-col"}>
      <div className={`mx-auto flex w-full max-w-xl flex-1 flex-col ${fill ? "px-5 py-6 sm:px-8" : "px-0 pt-1 pb-2"}`}>
        {!hideGenerateButton ? (
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={isGenerating || generate.isPending}
              onClick={() => generate.mutate()}
              className="h-8 shrink-0 rounded-full border border-border bg-muted px-3.5 text-[11px] font-semibold uppercase tracking-[0.5px] text-foreground transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              {isGenerating || generate.isPending
                ? t("timeline.generating", { defaultValue: "Generating…" })
                : t("timeline.generate", { defaultValue: "Generate timeline" })}
            </button>
            {generateStatus.data?.status === "FAILED" ? (
              <span className="text-[11px] text-red-500">
                {t("timeline.generateError", { defaultValue: "Last generation failed." })}
              </span>
            ) : null}
          </div>
        ) : null}
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
          <div className="mb-8 flex flex-col gap-10">
            {yearGroups.length > 0
              ? yearGroups.map((group) => (
                  <div key={group.year} className="flex flex-col">
                    {/* Year header — a centered divider label, same shape as a day divider in an
                     * activity feed ("Today"/"Yesterday"), always shown (one per year, not only
                     * when the case spans more than one). */}
                    <div className="mb-4 flex items-center gap-3">
                      <span aria-hidden="true" className="h-px flex-1 bg-border" />
                      <span className="shrink-0 rounded-full bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                        {group.year}
                      </span>
                      <span aria-hidden="true" className="h-px flex-1 bg-border" />
                    </div>
                    <ol className="relative flex flex-col gap-3">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute top-2 bottom-2 left-[7px] w-px bg-border"
                      />
                      {group.items.map((item) => {
                        const at = item.at as Date
                        const caption = formatCaptionDate(at)
                        const isEditing = editingId === item.id

                        return (
                          <li key={item.id} className="relative pl-6">
                            <span
                              className={`absolute left-0 top-4 z-10 size-[15px] rounded-full ring-4 ring-background ${dotClass(dated.indexOf(item), dated.length)}`}
                            />
                            <div className="rounded-xl border border-border bg-muted/40 p-3.5 transition-colors hover:border-brand-gold/30">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <p className="text-[14px] font-semibold leading-5 text-foreground">{item.title}</p>
                                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.5px] tabular-nums text-muted-foreground">
                                  {formatBadge(at)}
                                </span>
                              </div>
                              {caption ? (
                                <p className="mt-0.5 text-[11px] text-muted-foreground/70">{caption}</p>
                              ) : null}
                              {item.description ? (
                                <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">{item.description}</p>
                              ) : null}
                              {item.rawId && !isEditing ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingId(item.id)
                                    setEditDate(toDateInputValue(at))
                                  }}
                                  className="mt-2 text-[10px] font-medium text-muted-foreground hover:underline"
                                >
                                  {t("timeline.editDate", { defaultValue: "Edit date" })}
                                </button>
                              ) : null}
                              {item.rawId && isEditing ? (
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <input
                                    type="date"
                                    value={editDate}
                                    onChange={(e) => setEditDate(e.target.value)}
                                    className="h-7 w-[7.5rem] rounded-lg border border-border bg-muted px-1.5 text-[11px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
                                  />
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
                              ) : null}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                ))
              : null}

            {undated.length > 0 ? (
              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("timeline.nextSteps", { defaultValue: "Next steps" })}
                </h3>
                <ul className="divide-y divide-border rounded-2xl border border-border bg-muted/40">
                  {undated.map((item) => (
                    <li key={item.id} className="flex gap-3 px-4 py-3.5">
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-muted-foreground/50" />
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
