"use client"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Shows a law result's `pdf_url` in the browser's native PDF viewer via an <iframe>, so zoom,
 * search, print and page navigation come for free. If the host forbids embedding
 * (X-Frame-Options / CSP frame-ancestors) the frame renders blank — the "open in a new tab"
 * link above it is the escape hatch.
 */
export function LawPdfViewer({ url }: { url: string }) {
  const { t } = useTranslation("library")

  return (
    <div className="flex h-full flex-col gap-2">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs text-blue-900 hover:underline dark:text-blue-400"
      >
        {t("lawSearch.openInNewTab")}
        <ExternalLink className="size-3" aria-hidden="true" />
      </a>
      <iframe
        src={url}
        title={t("lawSearch.viewDocument")}
        className="min-h-0 w-full flex-1 rounded-md border border-border bg-muted"
      />
    </div>
  )
}
