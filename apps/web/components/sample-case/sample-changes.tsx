"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { History, Pencil, X } from "lucide-react"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import type { PanelId } from "@/lib/terminal/types"
import type { SampleChanges } from "@/lib/sample-case/data"
import { useTourT } from "@/lib/tour/use-tour-t"

type Entry = "run" | "edits"

/** The sample case's "What changed": the real modal's layout — a History of the latest analysis
 * run and a lawyer's editing session, and what each changed by pane — with fixed sample content.
 * Shown inline above the pane grid rather than as a modal, so the Terminal tour can spotlight it.
 * Open closes it and jumps to the pane. */
export function SampleChangesPanel({
  changes,
  onClose,
  onOpenPane,
}: {
  changes: SampleChanges
  onClose: () => void
  onOpenPane: (pane: PanelId) => void
}) {
  const { t } = useTranslation("terminal")
  const { t: tTour } = useTourT()
  const [selected, setSelected] = useState<Entry>("run")
  const rootRef = useRef<HTMLElement>(null)
  const { run, edits } = changes

  // Opened by the button: take focus, so the keyboard lands in it.
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  const runHeadline = t("changeHeadlineFromDocs", {
    count: run.documents.length,
    changes: t("changeCount", { count: run.lines.length }),
  })
  const editsHeadline = t("editSessionHeadline", { name: edits.author, count: edits.lines.length })
  const lines = selected === "run" ? run.lines : edits.lines

  const entries = [
    {
      id: "run" as const,
      title: t("changeRunDocs", { count: run.documents.length }),
      when: `${t("changeDayToday")}, ${run.time}`,
      count: t("changeCount", { count: run.lines.length }),
    },
    {
      id: "edits" as const,
      title: t("editSessionBy", { name: edits.author }),
      when: `${t("changeDayYesterday")}, ${edits.time}`,
      count: t("editCount", { count: edits.lines.length }),
    },
  ]
  const current = entries.find((e) => e.id === selected)!

  return (
    <section
      ref={rootRef}
      tabIndex={-1}
      data-sample-tour="changes"
      aria-labelledby="sample-changes-title"
      aria-describedby="sample-changes-headline"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation()
          onClose()
        }
      }}
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-background focus:outline-none"
    >
      <div className="flex items-start gap-3 border-b border-border p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
          {selected === "edits" ? <Pencil className="size-4" aria-hidden="true" /> : <History className="size-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <p id="sample-changes-title" className="m-0 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
            {selected === "edits" ? t("editSessionBy", { name: edits.author }) : t("changeModalTitle")}
            <span className="font-normal normal-case tracking-normal"> · {current.when}</span>
          </p>
          <p id="sample-changes-headline" className="m-0 mt-1 text-sm font-semibold text-foreground">
            {selected === "run" ? runHeadline : editsHeadline}
          </p>
          <p className="m-0 mt-1 min-h-4 text-[11px] text-muted-foreground">
            {selected === "run" && t("changeNewDocuments", { names: run.documents.join(", ") })}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("changeClose")}
          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-overlay-hover"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={t("changeHistory")} className="flex flex-col border-b border-border md:border-b-0 md:border-r">
          <p className="m-0 px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{t("changeHistory")}</p>
          <ul className="m-0 grid list-none gap-0.5 px-2 pb-3">
            {entries.map((entry) => {
              const active = entry.id === selected
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(entry.id)}
                    aria-current={active ? "true" : undefined}
                    className={`grid w-full cursor-pointer gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      active ? "bg-brand-gold/10" : "hover:bg-muted dark:hover:bg-overlay-hover"
                    }`}
                  >
                    <span className={`flex min-w-0 items-center gap-1.5 text-xs text-foreground ${active ? "font-semibold" : ""}`}>
                      {entry.id === "edits" && <Pencil className="size-3 shrink-0 text-brand-gold" aria-hidden="true" />}
                      <span className="truncate">{entry.title}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                      <span className="truncate tabular-nums">{entry.when}</span>
                      <span className="shrink-0 tabular-nums">{entry.count}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex flex-col gap-3 p-4 text-xs">
          <ul className="m-0 grid list-none gap-2 p-0">
            {lines.map((line) => (
              <li key={`${line.pane}-${line.text}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <span className="w-40 shrink-0 text-[11px] text-muted-foreground">{PANEL_TITLES[line.pane]}</span>
                <span className="min-w-0 flex-1 text-foreground">{line.text}</span>
                <button
                  type="button"
                  onClick={() => onOpenPane(line.pane)}
                  aria-label={t("changeOpenPaneLabel", { pane: PANEL_TITLES[line.pane] })}
                  className="shrink-0 cursor-pointer text-[10px] font-semibold uppercase tracking-[1px] text-brand-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {t("changeOpenPane")}
                </button>
              </li>
            ))}
          </ul>
          <p className="m-0 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground dark:bg-overlay-hover">{tTour("sampleCase.changesSample")}</p>
        </div>
      </div>
    </section>
  )
}
