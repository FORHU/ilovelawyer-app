"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, RefreshCw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import {
  terminalKeys,
  useAiJobStatus,
  useCreateTimelineMutation,
  useGenerateTimelineMutation,
  useUpdateTimelineMutation,
} from "@/lib/terminal/mutations"
import { AddTimelineEventDialog } from "./add-timeline-event-dialog"
import { useGraphViewQuery, graphViewKeys } from "@/lib/graph-view/mutations"
import { useCaseSnapshotQuery } from "@/lib/terminal/mutations"
import { TONE_TEXT_CLASS, timelineDotClass, timelineDotTone, type IngestTone } from "@/lib/terminal/evidence-status"
import type { SnapshotDocument } from "@/lib/terminal/types"

const RAG_LABEL_KEY = { ready: "ragReady", pending: "ragPending", failed: "ragFailed" } as const

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
  documentId: string | null
  isCalendar: boolean
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

// Day + month ("28 JUL"), UTC for date-only events so a midnight-UTC date doesn't slip a day in
// negative-offset timezones. The year is appended only when the case spans more than one.
function formatDay(at: Date, withYear: boolean) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZone: isDateOnly(at) ? "UTC" : undefined,
    day: "numeric",
    month: "short",
    ...(withYear ? { year: "2-digit" as const } : {}),
  }).format(at)
  return parts
}

function formatTime(at: Date) {
  if (isDateOnly(at)) return null
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}

function yearOf(at: Date) {
  return isDateOnly(at) ? at.getUTCFullYear() : at.getFullYear()
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
  // Optional heading rendered on the left of the generate row, so the button sits at the right
  // end of the section header instead of on a row of its own (Evidence panel passes "Timeline").
  title,
}: {
  caseId: string
  fill?: boolean
  hideGenerateButton?: boolean
  title?: React.ReactNode
}) {
  const { t } = useTranslation("homepage")
  const { t: tt } = useTranslation("terminal")
  const snapshot = useCaseSnapshotQuery(caseId)
  const documentsById = useMemo(
    () => new Map((snapshot.data?.documents ?? []).map((doc) => [doc.id, doc])),
    [snapshot.data?.documents],
  )
  // "Category · name · status" — the category is the same one the Evidence list and Workspace's
  // folders group by, so a dot can be traced back to where its document sits.
  const sourceLabel = (tone: IngestTone, sourceDoc: SnapshotDocument | undefined) => {
    if (tone === "none" || !sourceDoc) return tt("noSourceDocument")
    return [sourceDoc.category?.trim(), sourceDoc.name, tt(RAG_LABEL_KEY[tone])].filter(Boolean).join(" · ")
  }
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

  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState("")

  const items = useMemo<TimelineRow[]>(() => {
    // Graph-view's timeline view also carries PROCEDURAL_DEADLINE nodes (for the
    // TRIGGERS_DEADLINE dependency edge) — this view only ever rendered case events, so those
    // are filtered out rather than shown as a differently-shaped row.
    const fromCase: TimelineRow[] = (timeline.data?.nodes ?? [])
      .filter((node) => node.type === "TIMELINE_EVENT")
      .map((node) => {
        const event = node.data as {
          occurredOn: string | null
          title: string
          description: string | null
          documentId?: string | null
        }
        return {
          id: `tl-${node.refId}`,
          rawId: node.refId,
          at: event.occurredOn ? new Date(event.occurredOn) : null,
          title: event.title,
          description: event.description,
          documentId: event.documentId ?? null,
          isCalendar: false,
        }
      })
    const fromCalendar: TimelineRow[] = (calendar.data?.events ?? []).map((event) => ({
      id: `cal-${event.id}`,
      rawId: null,
      at: new Date(event.dateTime),
      title: event.title,
      description: event.notes,
      documentId: null,
      isCalendar: true,
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

  const multiYear = new Set(dated.map((item) => yearOf(item.at as Date))).size > 1

  return (
    <div className={fill ? "flex h-full min-h-0 flex-col overflow-y-auto" : "flex flex-col"}>
      <div className={`mx-auto flex w-full flex-1 flex-col ${fill ? "max-w-xl px-5 py-6 sm:px-8" : "px-0 pt-1 pb-2"}`}>
        {!hideGenerateButton ? (
          <div className={`${title ? "mb-2" : "mb-4"} flex items-center justify-between gap-3`}>
            {title}
            <div className="ml-auto flex items-center gap-2">
            {generateStatus.data?.status === "FAILED" ? (
              <span className="text-[11px] text-red-500">
                {t("timeline.generateError", { defaultValue: "Last generation failed." })}
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={isGenerating || generate.isPending}
                  onClick={() => generate.mutate()}
                  aria-label={
                    isGenerating || generate.isPending
                      ? t("timeline.generating", { defaultValue: "Generating…" })
                      : t("timeline.generate", { defaultValue: "Generate timeline" })
                  }
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50 dark:hover:bg-overlay-hover"
                >
                  {isGenerating || generate.isPending ? (
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-4" aria-hidden="true" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {isGenerating || generate.isPending
                  ? t("timeline.generating", { defaultValue: "Generating…" })
                  : t("timeline.generate", { defaultValue: "Generate timeline" })}
              </TooltipContent>
            </Tooltip>
            </div>
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
          <div className="mb-8 flex flex-col gap-6">
            {dated.length > 0 ? (
              <ol className="flex flex-col">
                {dated.map((item, index) => {
                  const at = item.at as Date
                  const isEditing = editingId === item.id
                  const isLast = index === dated.length - 1
                  const tone = item.isCalendar ? "none" : timelineDotTone(item.documentId, documentsById)
                  const sourceDoc = item.documentId ? documentsById.get(item.documentId) : undefined

                  return (
                    <li key={item.id} className={`grid ${multiYear ? "grid-cols-[4.75rem_0.75rem_minmax(0,1fr)]" : "grid-cols-[3.25rem_0.75rem_minmax(0,1fr)]"} gap-x-3`}>
                      <div className="pt-px text-right">
                        <p className="whitespace-nowrap font-mono text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase tabular-nums">
                          {formatDay(at, multiYear)}
                        </p>
                        {formatTime(at) ? (
                          <p className="font-mono text-[10px] text-muted-foreground/70 tabular-nums">{formatTime(at)}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-center">
                        <span
                          aria-hidden="true"
                          className={`mt-1 size-2.5 shrink-0 rounded-full ring-4 ring-background ${timelineDotClass(at)}`}
                        />
                        {!isLast ? <span aria-hidden="true" className="mt-1 w-px flex-1 bg-border" /> : null}
                      </div>
                      <div className={`min-w-0 ${isLast ? "" : "pb-4"}`}>
                        <p className="text-[13px] leading-5 text-foreground">{item.title}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-[12px] leading-4 text-muted-foreground">{item.description}</p>
                        ) : null}
                        <p
                          className={`mt-0.5 truncate font-mono text-[10px] font-semibold tracking-[0.5px] ${TONE_TEXT_CLASS[tone]}`}
                        >
                          {sourceLabel(tone, sourceDoc)}
                        </p>
                        {item.rawId && !isEditing ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(item.id)
                              setEditDate(toDateInputValue(at))
                            }}
                            className="mt-1 text-[10px] font-medium text-muted-foreground hover:underline"
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
            ) : null}

            {undated.length > 0 ? (
              <section>
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  {t("timeline.nextSteps", { defaultValue: "Next steps" })}
                </h3>
                <ul className="divide-y divide-border rounded-sm border border-border bg-muted/40">
                  {undated.map((item) => {
                    const tone = item.isCalendar ? "none" : timelineDotTone(item.documentId, documentsById)
                    const sourceDoc = item.documentId ? documentsById.get(item.documentId) : undefined
                    return (
                      <li key={item.id} className="flex gap-3 px-4 py-3.5">
                        <span aria-hidden="true" className={`mt-2 size-2 shrink-0 rounded-full ${timelineDotClass(null)}`} />
                        <div className="min-w-0">
                          <p className="text-[15px] font-semibold leading-snug text-foreground">{item.title}</p>
                          {item.description ? (
                            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{item.description}</p>
                          ) : null}
                          <p className={`mt-1 truncate font-mono text-[10px] font-semibold tracking-[0.5px] ${TONE_TEXT_CLASS[tone]}`}>
                            {sourceLabel(tone, sourceDoc)}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ) : null}
          </div>
        )}

        <div className="mt-auto border-t border-border pt-5">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="h-9 rounded-full bg-primary px-4 text-[11px] font-semibold uppercase tracking-[1px] text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98]"
          >
            {t("timeline.addHeading", { defaultValue: "Add event" })}
          </button>
        </div>
        <AddTimelineEventDialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open)
            if (!open) create.reset()
          }}
          documents={snapshot.data?.documents ?? []}
          isPending={create.isPending}
          submitError={create.isError ? t("timeline.addFailed", { defaultValue: "Could not add the event. Try again." }) : null}
          onSubmit={(v) =>
            create.mutate(
              {
                title: v.title,
                description: v.description || undefined,
                occurredOn: toDateTimeLocalValue(v.date, v.time),
                documentId: v.documentId || undefined,
                pageNumber: v.pageNumber ?? undefined,
              },
              { onSuccess: () => setAddOpen(false) },
            )
          }
        />
      </div>
    </div>
  )
}
