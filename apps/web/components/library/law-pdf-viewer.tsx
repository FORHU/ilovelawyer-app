"use client"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Shows a law's PDF in the browser's native viewer via an <iframe>, so zoom, search, print and
 * page navigation come for free. `url` is what the frame loads (for UK this is our same-origin
 * `/api/law/:id/pdf` proxy, since legislation.gov.uk / TNA send X-Frame-Options: DENY);
 * `sourceUrl` is the canonical link for "open in a new tab". If the proxy is unavailable the
 * frame renders blank — the link above it is the escape hatch.
 */
export function LawPdfViewer({ url, sourceUrl }: { url: string; sourceUrl?: string }) {
  const { t } = useTranslation("library")

  return (
    <div className="flex h-full flex-col gap-2">
      <a
        href={sourceUrl ?? url}
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
