"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Download, History, FileText } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { AttachmentPreview } from "@/components/chat/attachment-preview"
import {
  useExportCaseBriefMutation,
  useCaseBriefHistoryQuery,
  type CaseBriefFormat,
} from "@/lib/terminal/mutations"
import { triggerBriefDownload } from "@/lib/terminal/download-brief"

/** Shared by both the Legal Terminal (inside a slide-out Sheet) and Case Workspace's Studio
 * Panel (as an inline tile view, same pattern as Documents/Mind Map/Timeline) — one content
 * component, two different chrome wrappers around it.
 *
 * Three sub-views:
 *   - Generate: an explicit "Generate new Case Brief" action — deliberately not automatic, so
 *     just opening this panel to look at something already made doesn't silently create a new
 *     S3 upload + history entry every time.
 *   - Preview: shows the most recently generated brief (no auto-regenerate on open) — taken from
 *     the just-finished generate call if there is one, otherwise from the newest Word/PDF entries in
 *     the server-side history, so leaving this view (or reloading) doesn't lose it and force a
 *     re-generate. With a Word/PDF toggle and a real rendered preview per format via AttachmentPreview
 *     — the same docx-preview/PDF-iframe machinery the Studio Documents tile already uses, all
 *     client-side (file bytes never leave the browser, unlike a third-party embed viewer such as
 *     Office/Google, which this app deliberately avoids for confidential documents). A Download
 *     button sits under each preview, downloading exactly the format being previewed.
 *   - History: every past generation for this case (the backend records one entry per generate
 *     call), most recent first, each redownloadable.
 */
export function CaseBriefContent({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  // null = the user hasn't picked a tab yet, so the default is derived once history is known:
  // Preview when a brief already exists, Generate when none does.
  const [pickedView, setView] = useState<"generate" | "preview" | "history" | null>(null)
  // Set only by a generate call finished in this mount, so the fresh files show immediately
  // without waiting on the history refetch; it takes precedence over what history says.
  const [justGenerated, setJustGenerated] = useState<{ docx: string | null; pdf: string | null } | null>(null)

  const history = useCaseBriefHistoryQuery(caseId)
  // History is newest first, so the first entry of each format is the latest of that format.
  // Only the loaded pages are scanned — the newest generation is always on page one.
  const entries = history.data?.pages.flatMap((page) => page.items) ?? []
  const latestDocx = entries.find((entry) => entry.format === "docx" && entry.file.fileUrl)
  const latestPdf = entries.find((entry) => entry.format === "pdf" && entry.file.fileUrl)
  const fromHistory = { docx: latestDocx?.file.fileUrl ?? null, pdf: latestPdf?.file.fileUrl ?? null }
  const generated = justGenerated ?? fromHistory
  const generatedAt = justGenerated ? null : (latestPdf ?? latestDocx)?.createdAt ?? null
  const hasGenerated = Boolean(generated.docx || generated.pdf)
  const view = pickedView ?? (hasGenerated ? "preview" : "generate")

  const tabs: { key: typeof view; label: string; icon?: typeof History }[] = [
    { key: "generate", label: t("caseBriefGenerateTab") },
    { key: "preview", label: t("caseBriefPreviewTab") },
    { key: "history", label: t("caseBriefHistoryTab"), icon: History },
  ]

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="mr-1 inline h-3 w-3" aria-hidden="true" />}
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1">
        {pickedView === null && history.isPending ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("caseBriefHistoryLoading")}
          </div>
        ) : view === "generate" ? (
          <CaseBriefGenerate
            caseId={caseId}
            hasGenerated={hasGenerated}
            onGenerated={(result) => {
              setJustGenerated(result)
              setView("preview")
            }}
          />
        ) : view === "preview" ? (
          <CaseBriefPreview generated={generated} generatedAt={generatedAt} onRegenerate={() => setView("generate")} />
        ) : (
          <CaseBriefHistory caseId={caseId} />
        )}
      </div>
    </div>
  )
}

function CaseBriefGenerate({
  caseId,
  hasGenerated,
  onGenerated,
}: {
  caseId: string
  hasGenerated: boolean
  onGenerated: (result: { docx: string | null; pdf: string | null }) => void
}) {
  const { t } = useTranslation("terminal")
  const docxExport = useExportCaseBriefMutation(caseId)
  const pdfExport = useExportCaseBriefMutation(caseId)
  const isGenerating = docxExport.isPending || pdfExport.isPending
  const hasError = docxExport.isError || pdfExport.isError

  // Both formats are rendered independently from the same BriefDocument model (not one converted
  // from the other — see CaseBriefExportSvc on the backend), so generating "a brief" here really
  // means two separate export calls, run in parallel. Each is its own history entry, same as any
  // other export call — no special-casing needed there.
  const handleGenerate = () => {
    Promise.all([docxExport.mutateAsync("docx"), pdfExport.mutateAsync("pdf")])
      .then(([docxResult, pdfResult]) =>
        onGenerated({ docx: docxResult.file.fileUrl, pdf: pdfResult.file.fileUrl }),
      )
      .catch(() => {
        // Errors surface via docxExport.isError / pdfExport.isError below — nothing further to do.
      })
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 rounded-lg border border-border bg-muted/20 p-6 text-center">
      <FileText className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
      <p className="max-w-xs text-sm text-muted-foreground">
        {hasGenerated ? t("caseBriefRegenerateHint") : t("caseBriefGenerateHint")}
      </p>
      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isGenerating
          ? t("caseBriefGenerating")
          : hasGenerated
            ? t("caseBriefRegenerateCta")
            : t("caseBriefGenerateCta")}
      </Button>
      {hasError && <p className="text-xs text-destructive">{t("caseBriefPreviewError")}</p>}
    </div>
  )
}

function CaseBriefPreview({
  generated,
  generatedAt,
  onRegenerate,
}: {
  generated: { docx: string | null; pdf: string | null }
  /** ISO time of the brief being shown when it came from history; null right after generating. */
  generatedAt: string | null
  onRegenerate: () => void
}) {
  const { t } = useTranslation("terminal")
  const [format, setFormat] = useState<CaseBriefFormat>("pdf")
  const url = generated[format]

  if (!generated.docx && !generated.pdf) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        {t("caseBriefNothingGenerated")}
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 gap-1 rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => setFormat("docx")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            format === "docx" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("downloadWord")}
        </button>
        <button
          type="button"
          onClick={() => setFormat("pdf")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            format === "pdf" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("downloadPdf")}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border">
        {url ? (
          <AttachmentPreview
            attachment={{
              id: format,
              name: format === "docx" ? "case-brief.docx" : "case-brief.pdf",
              url,
              mimeType:
                format === "docx"
                  ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  : "application/pdf",
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            {t("caseBriefFormatNotGenerated")}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col items-start gap-0.5">
          {generatedAt && (
            <span className="text-xs text-muted-foreground">
              {t("caseBriefLastGenerated", { date: formatEntryDate(generatedAt) })}
            </span>
          )}
          <button
            type="button"
            onClick={onRegenerate}
            className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {t("caseBriefRegenerateCta")}
          </button>
        </div>
        <Button disabled={!url} onClick={() => url && triggerBriefDownload(url)}>
          <Download className="h-4 w-4" aria-hidden="true" />
          {format === "docx" ? t("downloadWord") : t("downloadPdf")}
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
  const sentinelRef = useRef<HTMLLIElement>(null)

  // Scroll-triggered loading, not a "Load more" button and not numbered pages — the sentinel
  // is a 1px element at the bottom of the list; once it's scrolled into view (i.e. the lawyer
  // has scrolled near the end of what's loaded), fetch the next page automatically. root: null
  // + the scrollable <ul> itself both work here since the <ul> is the nearest scrolling
  // ancestor, but IntersectionObserver defaults root to the viewport, which is wrong once this
  // list scrolls inside a fixed-height panel — root must be the scroll container itself.
  const scrollContainerRef = useRef<HTMLUListElement>(null)
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = scrollContainerRef.current
    if (!sentinel || !root || !history.hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !history.isFetchingNextPage) {
          history.fetchNextPage()
        }
      },
      { root, rootMargin: "100px" },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.hasNextPage, history.isFetchingNextPage, history.data])

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

  const entries = history.data.pages.flatMap((page) => page.items)

  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
        {t("caseBriefHistoryEmpty")}
      </div>
    )
  }

  return (
    <ul ref={scrollContainerRef} className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto">
      {entries.map((entry) => (
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
      {history.hasNextPage && (
        <li ref={sentinelRef} className="flex shrink-0 items-center justify-center py-2" aria-hidden="true">
          {history.isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </li>
      )}
    </ul>
  )
}
