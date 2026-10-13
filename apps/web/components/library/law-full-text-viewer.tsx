"use client"

/**
 * Renders a law's PDF-extracted full text when no framable PDF is available (e.g. every
 * Republic Act, or a decision juris.ph didn't supply a `source_pdf_url` for) — see
 * `LawSvc.ensureFullText` / `fetchLawFullText`. Plain extracted text, not markdown, so it's
 * shown preformatted rather than run through a markdown renderer.
 */
export function LawFullTextViewer({ text }: { text: string }) {
  return (
    <div className="h-full overflow-y-auto rounded-md border border-border bg-muted/40 p-4">
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{text}</p>
    </div>
  )
}
