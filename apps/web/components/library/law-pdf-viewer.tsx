"use client"
import { useTranslation } from "react-i18next"

/**
 * Shows a law's PDF in the browser's native viewer via an <iframe>, so zoom, search, print and
 * page navigation come for free. `url` is what the frame loads (for UK this is our same-origin
 * `/api/law/:id/pdf` proxy, since legislation.gov.uk / TNA send X-Frame-Options: DENY — and for
 * UK legislation the proxy may answer with legislation.gov.uk's HTML rendition instead, when its
 * WAF refuses the PDF). If the proxy is unavailable the frame renders blank — the page header's
 * "View source" link is the escape hatch.
 */
export function LawPdfViewer({ url }: { url: string }) {
  const { t } = useTranslation("library")

  return (
    <iframe
      src={url}
      title={t("lawSearch.viewDocument")}
      className="h-full w-full rounded-md border border-border bg-muted"
    />
  )
}
