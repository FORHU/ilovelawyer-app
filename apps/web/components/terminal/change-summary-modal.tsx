"use client"

import { useState, useSyncExternalStore } from "react"
import { useTranslation } from "react-i18next"
import { History, X } from "lucide-react"
import {
  canViewChangeSummary,
  changeSummaryHistory,
  describeChangeHeadline,
  describeChangeLines,
  describeChangeRun,
  shouldShowChangeSummary,
  type CaseChangeSummary,
  type ChangePart,
} from "@/lib/terminal/change-summary"
import { useChangeSummaryHistoryQuery } from "@/lib/terminal/mutations"
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

/** What a run changed: the latest run by default, any earlier one picked from the History list.
 * Each pane line has a link that closes the modal and opens that pane. */
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
  const historyQuery = useChangeSummaryHistoryQuery(caseId, summary.id, true)
  const history = changeSummaryHistory(summary, historyQuery.data)
  const [selectedId, setSelectedId] = useState(summary.id)
  const selected = history.find((s) => s.id === selectedId) ?? summary
  const isLatest = selected.id === summary.id

  // Translates one ChangePart, naming outlook bands, pane ids and change counts the way the user reads them.
  const text = ({ key, values }: ChangePart) => {
    if (!values) return t(key)
    if (key === "changeOutlookBand") return t(key, { from: t(`band_${values.from}`), to: t(`band_${values.to}`) })
    return t(key, {
      ...values,
      ...("changes" in values ? { changes: t("changeCount", { count: Number(values.changes) }) } : {}),
      ...("pane" in values ? { pane: PANEL_TITLES[values.pane as PanelId] } : {}),
    })
  }
  const when = (iso: string) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
  }

  const lines = selected.firstAnalysis ? [] : describeChangeLines(selected.perPaneDeltas)
  const named = selected.documentsAdded.flatMap((d) => (d.name ? [d.name] : []))
  const moreDocuments = selected.documentsAdded.length - Math.min(named.length, MAX_NAMED_DOCUMENTS)
  const showHistory = historyQuery.isPending || historyQuery.isError || history.length > 1

  return (
    <ModalOverlay
      onClose={onClose}
      labelledBy="change-summary-title"
      aria-describedby="change-summary-headline"
      backdropClassName="absolute inset-0 z-[95] flex items-center justify-center bg-black/50"
      className="flex max-h-[min(40rem,calc(100%-2rem))] w-[min(52rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-card shadow-2xl focus:outline-none"
    >
      {(close) => (
        <>
          <div className="flex items-start gap-3 border-b border-border p-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/10 text-brand-gold">
              <History className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p id="change-summary-title" className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
                {t("changeModalTitle")}
                <span className="font-normal normal-case tracking-normal"> · {when(selected.createdAt)}</span>
              </p>
              <p id="change-summary-headline" className="mt-1 text-sm font-semibold text-foreground">
                {selected.firstAnalysis ? t("changeRunFirst") : text(describeChangeHeadline(selected))}
              </p>
              {named.length > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {t("changeNewDocuments", { names: named.slice(0, MAX_NAMED_DOCUMENTS).join(", ") })}
                  {moreDocuments > 0 ? ` ${t("changeMoreDocuments", { count: moreDocuments })}` : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("changeClose")}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className={`flex min-h-0 flex-1 flex-col ${showHistory ? "md:grid md:grid-cols-[15rem_minmax(0,1fr)]" : ""}`}>
            {showHistory && (
              <nav
                aria-label={t("changeHistory")}
                className="max-h-40 shrink-0 overflow-y-auto border-b border-border md:max-h-none md:border-b-0 md:border-r"
              >
                <p className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{t("changeHistory")}</p>
                <ul className="grid gap-0.5 px-2 pb-3">
                  {history.map((run) => {
                    const active = run.id === selected.id
                    return (
                      <li key={run.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedId(run.id)}
                          aria-current={active ? "true" : undefined}
                          className={`grid w-full gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                            active ? "bg-brand-gold/10" : "hover:bg-muted dark:hover:bg-overlay-hover"
                          }`}
                        >
                          <span className={`truncate text-xs ${active ? "font-semibold text-foreground" : "text-foreground"}`}>{text(describeChangeRun(run))}</span>
                          <span className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
                            <span className="truncate">{when(run.createdAt)}</span>
                            {!run.firstAnalysis && <span className="shrink-0 tabular-nums">{t("changeCount", { count: run.totalChanges })}</span>}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  {historyQuery.isPending && <li className="px-2 py-1.5 text-[11px] text-muted-foreground">{t("changeHistoryLoading")}</li>}
                  {historyQuery.isError && <li className="px-2 py-1.5 text-[11px] text-danger">{t("changeHistoryError")}</li>}
                </ul>
              </nav>
            )}

            <div className="min-h-0 overflow-y-auto p-4 text-xs">
              {!isLatest && <p className="mb-3 rounded-md bg-muted px-3 py-2 text-[11px] text-muted-foreground dark:bg-overlay-hover">{t("changePastRun")}</p>}
              {selected.firstAnalysis ? (
                <p className="text-muted-foreground">{t("changeFirstAnalysis")}</p>
              ) : lines.length > 0 ? (
                <ul className="grid gap-2">
                  {lines.map((line, i) => (
                    <li key={`${line.pane}-${i}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="w-40 shrink-0 text-[11px] text-muted-foreground">{PANEL_TITLES[line.pane]}</span>
                      <span className={`min-w-0 flex-1 ${line.notUpdated ? "text-progress" : "text-foreground"}`}>
                        {line.parts.map(text).join(", ")}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          close()
                          onOpenPane(line.pane)
                        }}
                        aria-label={t("changeOpenPaneLabel", { pane: PANEL_TITLES[line.pane] })}
                        className="shrink-0 text-[10px] font-semibold uppercase tracking-[1px] text-brand-gold hover:underline"
                      >
                        {t("changeOpenPane")}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{t("changeNoLines")}</p>
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
