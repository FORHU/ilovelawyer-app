"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { FileSearch } from "lucide-react"
import { useTranslation } from "react-i18next"
import FilePreviewModal from "@/components/chat/file-preview-modal"
import { useCaseDocumentsQuery } from "@/lib/cases/mutations"

/** Which document to open: by id when the source carries one, else by exact file name (AI
 * findings only keep a `sourceLabel`). */
export interface DocumentRef {
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
  const { data: documents } = useCaseDocumentsQuery(caseId)
  const [openId, setOpenId] = useState<string | null>(null)

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
        if (doc) setOpenId(doc.id)
      },
    }),
    [find],
  )
  const openDoc = openId ? documents?.find((d) => d.id === openId) : undefined
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
              attachment={attachment}
              onClose={() => setOpenId(null)}
              layerClassName="z-(--z-canvas-overlay)"
            />,
            document.body,
          )
        : null}
    </DocumentViewerContext.Provider>
  )
}

export const useDocumentViewer = () => useContext(DocumentViewerContext)

/** A document reference that opens the viewer when clicked — the name (or whatever sentence
 * names it) is the trigger, so there's no extra control per row. Falls back to plain text outside a
 * provider or when the file isn't in the case's list (removed/archived), so callers never need a guard. */
export function DocumentLink({
  docId,
  name,
  children,
  className = "",
}: {
  docId?: string | null
  name?: string | null
  children: React.ReactNode
  className?: string
}) {
  const { t } = useTranslation("terminal")
  const viewer = useDocumentViewer()
  const ref = { id: docId, name }
  if (!viewer?.has(ref)) return <>{children}</>
  return (
    <button
      type="button"
      title={t("viewDocument")}
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
export function ViewDocumentButton({ docId, className = "" }: { docId: string; className?: string }) {
  const { t } = useTranslation("terminal")
  const viewer = useDocumentViewer()
  if (!viewer?.has({ id: docId })) return null
  return (
    <button
      type="button"
      title={t("viewDocument")}
      aria-label={t("viewDocument")}
      onClick={(e) => {
        e.stopPropagation()
        viewer.open({ id: docId })
      }}
      className={`flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-overlay-hover ${className}`}
    >
      <FileSearch className="size-3.5" aria-hidden="true" />
    </button>
  )
}
