"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { FileSearch } from "lucide-react"
import { useTranslation } from "react-i18next"
import type { TFunction } from "i18next"
import FilePreviewModal from "@/components/chat/file-preview-modal"
import { useCaseDocumentsQuery } from "@/lib/cases/mutations"
import { normalizePage, normalizeQuote, type ViewerTarget } from "@/lib/terminal/document-viewer"

/** Which document to open: by id when the source carries one, else by exact file name (AI
 * findings only keep a `sourceLabel`). With `page`/`quote` (a PDF) it opens at that page with the
 * passage highlighted. */
export interface DocumentRef extends ViewerTarget {
  id?: string | null
  name?: string | null
}

interface DocumentViewer {
  open: (ref: DocumentRef) => void
  has: (ref: DocumentRef) => boolean
}

const DocumentViewerContext = createContext<DocumentViewer | null>(null)

/** One preview modal per case surface (Terminal, Workspace) — mounted once at the root so every
 * panel's source reference opens the same viewer instead of each owning its own modal. The modal
 * is FilePreviewModal (already has "open in new tab"), fed from the case documents list, whose
 * `fileUrl` is a same-origin /files/<token> proxy link. */
export function DocumentViewerProvider({ caseId, children }: { caseId: string; children: React.ReactNode }) {
  const { t } = useTranslation("terminal")
  const { data: documents } = useCaseDocumentsQuery(caseId)
  const [opened, setOpened] = useState<{ id: string; page: number | null; quote: string | null; label: string | null } | null>(null)

  const find = useCallback(
    (ref: DocumentRef) =>
      documents?.find((d) => d.fileUrl && (ref.id ? d.id === ref.id : !!ref.name && d.name === ref.name)),
    [documents],
  )
  const viewer = useMemo<DocumentViewer>(
    () => ({
      has: (ref) => !!find(ref),
      open: (ref) => {
        const doc = find(ref)
        if (doc) {
          setOpened({
            id: doc.id,
            page: normalizePage(ref.page),
            quote: normalizeQuote(ref.quote),
            label: ref.label?.trim() || null,
          })
        }
      },
    }),
    [find],
  )
  const openDoc = opened ? documents?.find((d) => d.id === opened.id) : undefined
  const attachment = useMemo(
    () => (openDoc ? { id: openDoc.id, name: openDoc.name, url: openDoc.fileUrl, mimeType: openDoc.mimeType ?? null } : null),
    [openDoc],
  )

  return (
    <DocumentViewerContext.Provider value={viewer}>
      {children}
      {/* Portaled to <body> on the canvas-overlay layer: opened from inside a maximized Terminal
          pane (z-[90]) or a brought-to-front Free-canvas pane, the default modal layer (50)
          rendered it behind the pane that opened it. */}
      {attachment
        ? createPortal(
            <FilePreviewModal
              // A new target (another side of a contradiction, another page) is a fresh preview.
              key={`${attachment.id}|${opened?.page ?? ""}|${opened?.quote ?? ""}`}
              attachment={attachment}
              onClose={() => setOpened(null)}
              layerClassName="z-(--z-canvas-overlay)"
              page={opened?.page}
              quote={opened?.quote}
              subtitle={viewerSubtitle(opened?.label, opened?.page ? t("pdfPageLabel", { page: opened.page }) : null)}
            />,
            document.body,
          )
        : null}
    </DocumentViewerContext.Provider>
  )
}

export const useDocumentViewer = () => useContext(DocumentViewerContext)

/** "D13 p.2 · PDF page 31" — where the source says the passage is, then the page it is on. */
function viewerSubtitle(label: string | null | undefined, pageText: string | null | undefined): string | null {
  return [label, pageText].filter(Boolean).join(" · ") || null
}

/** Tooltip for a link that opens at a spot ("Open at D13 p.2"), else the plain "View document". */
function openTitle(t: TFunction<"terminal">, page: number | null | undefined, label: string | null | undefined): string {
  if (label) return t("openAtLocation", { location: label })
  if (page) return t("openAtPage", { page })
  return t("viewDocument")
}

/** A document reference that opens the viewer when clicked — the name (or whatever sentence
 * names it) is the trigger, so there's no extra control per row. Falls back to plain text outside a
 * provider or when the file isn't in the case's list (removed/archived), so callers never need a guard. */
export function DocumentLink({
  docId,
  name,
  page,
  quote,
  label,
  children,
  className = "",
}: {
  docId?: string | null
  name?: string | null
  /** Open at this PDF page, highlighting `quote` on it. */
  page?: number | null
  quote?: string | null
  /** How the source names the spot ("D13 p.2"), for the tooltip and the viewer's title bar. */
  label?: string | null
  children: React.ReactNode
  className?: string
}) {
  const { t } = useTranslation("terminal")
  const viewer = useDocumentViewer()
  const ref = { id: docId, name, page, quote, label }
  if (!viewer?.has(ref)) return <>{children}</>
  return (
    <button
      type="button"
      title={openTitle(t, page, label)}
      onClick={(e) => {
        e.stopPropagation()
        viewer.open(ref)
      }}
      className={`inline cursor-pointer rounded-sm text-left underline decoration-dotted underline-offset-2 transition-colors hover:text-foreground hover:decoration-solid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${className}`}
    >
      {children}
    </button>
  )
}

/** Icon-only trigger for rows whose own click already does something else (a button can't nest in
 * a button), e.g. the Evidence document list. 24px hit area (WCAG 2.2 target size). */
export function ViewDocumentButton({
  docId,
  name,
  page,
  quote,
  label,
  className = "",
}: {
  docId: string
  name?: string | null
  page?: number | null
  quote?: string | null
  label?: string | null
  className?: string
}) {
  const { t } = useTranslation("terminal")
  const viewer = useDocumentViewer()
  const ref = { id: docId, name, page, quote, label }
  if (!viewer?.has(ref)) return null
  const title = openTitle(t, page, label)
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation()
        viewer.open(ref)
      }}
      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-overlay-hover ${className}`}
    >
      <FileSearch className="size-3.5" aria-hidden="true" />
    </button>
  )
}
