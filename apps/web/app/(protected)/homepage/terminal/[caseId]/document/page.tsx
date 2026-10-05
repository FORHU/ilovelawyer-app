"use client"

import { Suspense, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { useTranslation } from "react-i18next"
import { AlertCircle, Download, ExternalLink, FileText, Loader2 } from "lucide-react"
import { AttachmentPreview } from "@/components/chat/attachment-preview"
import { useArchivedCaseDocumentsQuery, useCaseDocumentsQuery } from "@/lib/cases/mutations"
import { findViewerDocument } from "@/lib/terminal/document-viewer"

const iconLinkClass =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none dark:hover:bg-overlay-hover"

// The Document Viewer tab a Decision Record's evidence opens (see documentViewerHref) — a
// chrome-less page like the canvas pop-out windows: just the file's name, its open/download
// actions and the same AttachmentPreview the case Documents view embeds.
function DocumentViewer() {
  const { t } = useTranslation("terminal")
  const { t: tHome } = useTranslation("homepage")
  const { caseId } = useParams<{ caseId: string }>()
  const search = useSearchParams()
  const ref = { id: search.get("id"), name: search.get("name") }

  const active = useCaseDocumentsQuery(caseId)
  const activeMatch = active.data ? findViewerDocument(active.data, ref) : undefined
  // Evidence can cite a document that was archived after the decision was made — still part of
  // the case, so look there before calling it gone.
  const archived = useArchivedCaseDocumentsQuery(caseId, !!active.data && !activeMatch)
  const doc = activeMatch ?? (archived.data ? findViewerDocument(archived.data, ref) : undefined)

  const title = doc?.name ?? ref.name ?? t("decisionDocumentFallback")
  useEffect(() => {
    document.title = `${title} · ${t("documentViewerTitle")}`
  }, [title, t])

  const loading = active.isLoading || (!activeMatch && archived.isLoading)
  const failed = active.isError || (!activeMatch && archived.isError)

  return (
    <div className="flex h-screen min-h-0 flex-col bg-background font-['Inter'] text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
          {title}
        </h1>
        {doc?.fileUrl ? (
          <>
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" aria-label={tHome("attachment.openInNewTab")} title={tHome("attachment.openInNewTab")} className={iconLinkClass}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
            <a href={doc.fileUrl} download={doc.name} aria-label={tHome("attachment.download")} title={tHome("attachment.download")} className={iconLinkClass}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 p-3">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          </div>
        ) : failed || !doc ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-sm">
            <AlertCircle className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">{t(failed ? "documentViewerLoadError" : "documentViewerNotFound")}</p>
            {failed ? (
              <button type="button" onClick={() => (active.isError ? active.refetch() : archived.refetch())} className="text-xs font-semibold tracking-wider text-brand-gold uppercase hover:underline">
                {t("retry")}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-xl border border-border">
            <AttachmentPreview attachment={{ id: doc.id, name: doc.name, url: doc.fileUrl, mimeType: doc.mimeType ?? null }} />
          </div>
        )}
      </main>
    </div>
  )
}

export default function DocumentViewerPage() {
  return (
    // DocumentViewer reads ?id= and ?name= — see useSearchParams in the Next docs.
    <Suspense>
      <DocumentViewer />
    </Suspense>
  )
}
