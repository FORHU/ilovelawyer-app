"use client"
import { ExternalLink } from "lucide-react"
import { useTranslation } from "react-i18next"

/**
 * Renders a law's PDF-extracted full text when no framable PDF is available (e.g. every
 * Republic Act, or a decision juris.ph didn't supply a `source_pdf_url` for) — see
 * `LawSvc.ensureFullText` / `fetchLawFullText`. Plain extracted text, not markdown, so it's
 * shown preformatted rather than run through a markdown renderer.
 */
export function LawFullTextViewer({ text, sourceUrl }: { text: string; sourceUrl?: string }) {
  const { t } = useTranslation("library")

  return (
    <div className="flex h-full flex-col gap-2">
      {sourceUrl && (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1 text-xs text-blue-900 hover:underline dark:text-blue-400"
        >
          {t("lawSearch.openInNewTab")}
          <ExternalLink className="size-3" aria-hidden="true" />
        </a>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-muted/40 p-4">
        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
          {text}
        </p>
      </div>
    </div>
  )
}
