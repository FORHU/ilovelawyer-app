"use client"

import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Download, History } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import {
  useExportCaseBriefMutation,
  useCaseBriefHistoryQuery,
  type CaseBriefFormat,
} from "@/lib/terminal/mutations"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"

/** Shared by both the Legal Terminal (inside a slide-out Sheet) and Case Workspace's Studio
 * Panel (as an inline tile view, same pattern as Documents/Mind Map/Timeline) — one content
 * component, two different chrome wrappers around it, so there's exactly one place that knows
 * how to generate/preview/download/list a Case Brief.
 *
 * Two sub-views, matching the Studio Panel's own "tile now, detail later" split:
 *   - New: generates a fresh PDF preview on entry, plus Download Word/PDF actions.
 *   - History: every past generation for this case (preview and download calls alike — the
 *     backend records both, no distinction), most recent first, each redownloadable.
 *
 * Preview always renders the PDF, even when the lawyer's actual download is Word — settled via
 * grilling: converting/embedding the real .docx for preview would need a third-party viewer
 * (Office Online), which would expose a confidential case document's URL to Microsoft's servers
 * just to preview it. "Download PDF" reuses the already-fetched preview file (no second network
 * call); "Download Word" is a genuinely separate render from the same BriefDocument model, not a
 * conversion of the preview — see CaseBriefExportSvc on the backend. */
export function CaseBriefContent({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const [view, setView] = useState<"new" | "history">("new")

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => setView("new")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            view === "new" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("caseBriefNewTab")}
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            view === "history" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <History className="mr-1 inline h-3 w-3" aria-hidden="true" />
          {t("caseBriefHistoryTab")}
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {view === "new" ? <CaseBriefNew caseId={caseId} /> : <CaseBriefHistory caseId={caseId} />}
      </div>
    </div>
  )
}

function CaseBriefNew({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  // Two separate mutation instances: the Word download must not clobber the PDF preview's own
  // `data`/`isPending` state, since they're independent server-side renders and both call the
  // same underlying hook/endpoint with a different format.
  const preview = useExportCaseBriefMutation(caseId)
  const wordDownload = useExportCaseBriefMutation(caseId)

  useEffect(() => {
    preview.mutate("pdf")
    // Generate fresh once on entry — the brief should reflect the live snapshot, same as the
    // export endpoint itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const previewUrl = preview.data?.file.fileUrl

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/20">
        {preview.isPending && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("caseBriefGenerating")}
          </div>
        )}
        {preview.isError && (
          <div className="flex h-full items-center justify-center text-sm text-destructive">
            {t("caseBriefPreviewError")}
          </div>
        )}
        {previewUrl && <iframe src={previewUrl} title={t("caseBriefPreviewTitle")} className="h-full w-full" />}
      </div>

      <div className="flex shrink-0 justify-end gap-2">
        <Button
          variant="outline"
          disabled={wordDownload.isPending}
          onClick={() =>
            wordDownload.mutate("docx", {
              onSuccess: (result) => triggerBriefDownload(result.file.fileUrl),
            })
          }
        >
          {wordDownload.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {t("downloadWord")}
        </Button>
        <Button disabled={!previewUrl} onClick={() => previewUrl && triggerBriefDownload(previewUrl)}>
          {t("downloadPdf")}
        </Button>
      </div>
    </div>
  )
}

function formatEntryDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

function formatLabel(format: CaseBriefFormat): string {
  return format === "docx" ? "Word" : "PDF"
}

function CaseBriefHistory({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const history = useCaseBriefHistoryQuery(caseId)

  if (history.isPending) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseBriefHistoryLoading")}
      </div>
    )
  }

  if (history.isError) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-destructive">
        {t("caseBriefHistoryError")}
      </div>
    )
  }

  if (history.data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        {t("caseBriefHistoryEmpty")}
      </div>
    )
  }

  return (
    <ul className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      {history.data.map((entry) => (
        <li
          key={entry.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
        >
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{formatLabel(entry.format)}</p>
            <p className="truncate text-xs text-muted-foreground">{formatEntryDate(entry.createdAt)}</p>
          </div>
          <Button
            size="icon-sm"
            variant="outline"
            disabled={!entry.file.fileUrl}
            aria-label={t("downloadPdf")}
            onClick={() => entry.file.fileUrl && triggerBriefDownload(entry.file.fileUrl)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
