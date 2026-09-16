"use client"

import { useState } from "react"
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
 *   - Preview: shows whatever was most recently generated *this session* (no auto-regenerate on
 *     open), with a Word/PDF toggle and a real rendered preview per format via AttachmentPreview
 *     — the same docx-preview/PDF-iframe machinery the Studio Documents tile already uses, all
 *     client-side (file bytes never leave the browser, unlike a third-party embed viewer such as
 *     Office/Google, which this app deliberately avoids for confidential documents). A Download
 *     button sits under each preview, downloading exactly the format being previewed.
 *   - History: every past generation for this case (the backend records one entry per generate
 *     call), most recent first, each redownloadable.
 */
export function CaseBriefContent({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const [view, setView] = useState<"generate" | "preview" | "history">("generate")
  const [generated, setGenerated] = useState<{ docx: string | null; pdf: string | null }>({
    docx: null,
    pdf: null,
  })

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
        {view === "generate" ? (
          <CaseBriefGenerate
            caseId={caseId}
            onGenerated={(result) => {
              setGenerated(result)
              setView("preview")
            }}
          />
        ) : view === "preview" ? (
          <CaseBriefPreview generated={generated} />
        ) : (
          <CaseBriefHistory caseId={caseId} />
        )}
      </div>
    </div>
  )
}

function CaseBriefGenerate({
  caseId,
  onGenerated,
}: {
  caseId: string
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
      <p className="max-w-xs text-sm text-muted-foreground">{t("caseBriefGenerateHint")}</p>
      <Button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isGenerating ? t("caseBriefGenerating") : t("caseBriefGenerateCta")}
      </Button>
      {hasError && <p className="text-xs text-destructive">{t("caseBriefPreviewError")}</p>}
    </div>
  )
}

function CaseBriefPreview({ generated }: { generated: { docx: string | null; pdf: string | null } }) {
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

      <Button
        className="shrink-0 self-end"
        disabled={!url}
        onClick={() => url && triggerBriefDownload(url)}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {format === "docx" ? t("downloadWord") : t("downloadPdf")}
      </Button>
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
