"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import CustomSelect from "@/components/ui/custom-select"

export interface NewTimelineEvent {
  title: string
  date: string
  time: string
  description: string
  documentId: string
  pageNumber: number | null
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: { id: string; name: string; pageCount: number | null }[]
  isPending: boolean
  submitError: string | null
  onSubmit: (event: NewTimelineEvent) => void
}

const FIELD =
  "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 aria-[invalid=true]:border-red-600"
const LABEL = "text-xs font-medium text-foreground"
const ERROR = "text-xs text-red-700 dark:text-red-400"

export function AddTimelineEventDialog({ open, onOpenChange, documents, isPending, submitError, onSubmit }: Props) {
  const { t } = useTranslation("homepage")
  const [title, setTitle] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [description, setDescription] = useState("")
  const [documentId, setDocumentId] = useState("")
  const [page, setPage] = useState("")
  const [errors, setErrors] = useState<{ title?: string; date?: string; page?: string }>({})

  const doc = documents.find((d) => d.id === documentId)
  const reset = () => {
    setTitle("")
    setDate("")
    setTime("")
    setDescription("")
    setDocumentId("")
    setPage("")
    setErrors({})
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const next: typeof errors = {}
    if (!title.trim()) next.title = t("timeline.errTitle", { defaultValue: "Enter a title for the event." })
    if (!date) next.date = t("timeline.errDate", { defaultValue: "Choose the date it happened." })
    const pageNumber = page ? Number(page) : null
    if (pageNumber !== null && (!Number.isInteger(pageNumber) || pageNumber < 1 || (doc?.pageCount && pageNumber > doc.pageCount))) {
      next.page = t("timeline.errPage", { defaultValue: "Enter a page inside the document." })
    }
    setErrors(next)
    if (Object.keys(next).length) return
    onSubmit({ title: title.trim(), date, time, description: description.trim(), documentId, pageNumber: documentId ? pageNumber : null })
    reset()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <form onSubmit={submit} noValidate className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {t("timeline.addHeading", { defaultValue: "Add event" })}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("timeline.addHint", { defaultValue: "Record a dated fact for this case. Link it to the document that proves it." })}
            </DialogDescription>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="tl-title" className={LABEL}>{t("timeline.addTitleLabel", { defaultValue: "Event title" })}</label>
            <input
              id="tl-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? "tl-title-err" : undefined}
              placeholder={t("timeline.addTitlePh", { defaultValue: "e.g. Termination letter issued" })}
              className={FIELD}
            />
            {errors.title && <p id="tl-title-err" className={ERROR}>{errors.title}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="tl-date" className={LABEL}>{t("timeline.date", { defaultValue: "Date" })}</label>
              <input
                id="tl-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-invalid={!!errors.date}
                aria-describedby={errors.date ? "tl-date-err" : undefined}
                className={FIELD}
              />
              {errors.date && <p id="tl-date-err" className={ERROR}>{errors.date}</p>}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tl-time" className={LABEL}>
                {t("timeline.time", { defaultValue: "Time" })}{" "}
                <span className="font-normal text-muted-foreground">({t("timeline.optional", { defaultValue: "optional" })})</span>
              </label>
              <input id="tl-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={FIELD} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="tl-desc" className={LABEL}>
              {t("timeline.addDescription", { defaultValue: "What happened" })}{" "}
              <span className="font-normal text-muted-foreground">({t("timeline.optional", { defaultValue: "optional" })})</span>
            </label>
            <textarea
              id="tl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_7rem]">
            <div className="flex flex-col gap-2">
              <label htmlFor="tl-doc" className={LABEL}>
                {t("timeline.sourceDoc", { defaultValue: "Source document" })}{" "}
                <span className="font-normal text-muted-foreground">({t("timeline.optional", { defaultValue: "optional" })})</span>
              </label>
              <CustomSelect
                id="tl-doc"
                value={documentId}
                onChange={(v) => {
                  setDocumentId(v)
                  setPage("")
                }}
                placeholder={t("timeline.noDoc", { defaultValue: "No source document" })}
                options={[
                  { value: "", label: t("timeline.noDoc", { defaultValue: "No source document" }) },
                  ...documents.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="tl-page" className={LABEL}>{t("timeline.page", { defaultValue: "Page" })}</label>
              <input
                id="tl-page"
                type="number"
                min={1}
                max={doc?.pageCount ?? undefined}
                inputMode="numeric"
                value={page}
                disabled={!documentId}
                onChange={(e) => setPage(e.target.value)}
                aria-invalid={!!errors.page}
                aria-describedby={errors.page ? "tl-page-err" : undefined}
                className={`${FIELD} disabled:opacity-50`}
              />
            </div>
            {errors.page && <p id="tl-page-err" className={`${ERROR} sm:col-span-2`}>{errors.page}</p>}
          </div>

          {submitError && <p role="alert" className={ERROR}>{submitError}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-full border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              {t("timeline.cancel", { defaultValue: "Cancel" })}
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="h-10 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
            >
              {t("timeline.addCta", { defaultValue: "Add event" })}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
