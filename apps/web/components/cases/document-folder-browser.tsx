"use client"

import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ExternalLink, FolderPlus, Loader2, Plus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  useCaseDocumentsQuery,
  useDeleteCaseDocumentMutation,
  useUpdateCaseDocumentMutation,
  useUploadCaseDocumentsMutation,
  type UserDocument,
} from "@/lib/cases/mutations"
import { useFileDrop } from "@/hooks/use-file-drop"
import { DocumentFolderCard } from "@/components/cases/document-folder-card"
import { DocumentFileCard } from "@/components/cases/document-file-card"
import DeleteDocumentModal from "@/components/cases/delete-document-modal"
import { AttachmentPreview } from "@/components/chat/attachment-preview"
import type { MessageAttachment } from "@/components/chat/message-attachments"

type View = { kind: "root" } | { kind: "folder"; name: string }

/** Drive-style folder grid for a case's documents: categories render as folder cards, documents
 * with no category render as loose file cards alongside them. Dragging files onto a folder card
 * (or into an open folder) uploads straight into that category — see
 * useUploadCaseDocumentsMutation's `category` param, which makes the backend skip its AI
 * auto-categorization step for these uploads. Folders are purely derived from documents' existing
 * `category` values (no separate "categories" entity) — a brand-new folder only starts existing
 * once a file has actually been uploaded into it, so "creating" one just opens its (empty) folder
 * view and waits for a drop/pick.
 *
 * Owns its own header + "+ Add" trigger (root: unscoped, old AI-categorize path; inside a folder:
 * scoped to that folder) instead of leaving a caller-rendered add button above it — a button that
 * doesn't know whether a folder is open would silently upload without a category while the user
 * thinks they're adding to the folder they're looking at. */
export function DocumentFolderBrowser({ caseId, variant }: { caseId: string; variant: "full" | "compact" }) {
  const { t } = useTranslation("case-portfolio")
  // AttachmentPreview's own strings (loading/fallback text) already live under this namespace —
  // reused here rather than duplicated into case-portfolio.json for just the one header action.
  const { t: tHome } = useTranslation("homepage")
  const { data: documents, isLoading, isError } = useCaseDocumentsQuery(caseId)
  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation()
  const { mutate: updateDocument, isPending: isUpdating, variables: updatingVars } = useUpdateCaseDocumentMutation()
  const { mutate: uploadDocuments, isPending: isUploading, data: uploadResult } = useUploadCaseDocumentsMutation()
  const hasUploadFailures = (uploadResult?.failed.length ?? 0) > 0

  const [view, setView] = useState<View>({ kind: "root" })
  const [namingFolder, setNamingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [previewDoc, setPreviewDoc] = useState<MessageAttachment | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<UserDocument | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = (files: File[], category?: string) => {
    uploadDocuments({ files, caseId, category })
  }

  // Root-level (and empty-state) drops have no open folder to target, so the payload goes to the
  // case's root directory (category undefined); an open folder targets itself unless the drop
  // resolves to a more specific folder card via `data-drop-target` (see useFileDrop).
  const defaultDropTarget = view.kind === "folder" ? view.name : undefined
  const { isDragOver, hoverTarget, dragHandlers } = useFileDrop(upload, defaultDropTarget)

  const openPreview = (doc: UserDocument) =>
    setPreviewDoc({ id: doc.id, name: doc.name, url: doc.fileUrl, mimeType: doc.mimeType ?? null })

  const header = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        {view.kind === "folder" ? (
          <button
            type="button"
            onClick={() => setView({ kind: "root" })}
            aria-label={t("detail.backToFolders")}
            className="flex min-w-0 items-center gap-1 rounded-md py-0.5 text-left text-sm font-semibold text-foreground hover:text-brand-gold"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{view.name}</span>
          </button>
        ) : (
          <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
            {t("detail.documents")}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/15 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
            >
              {isUploading ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3 w-3" aria-hidden="true" />
              )}
              {isUploading ? t("detail.uploading") : t("detail.addDocument")}
            </button>
          </TooltipTrigger>
          <TooltipContent>{view.kind === "folder" ? t("detail.dropToUpload") : "Upload one or more documents to this case"}</TooltipContent>
        </Tooltip>
      </div>
      {hasUploadFailures && (
        <span className="block text-right text-[11px] text-red-600 dark:text-red-400">{t("detail.uploadError")}</span>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (files.length > 0) upload(files, view.kind === "folder" ? view.name : undefined)
        }}
      />
    </div>
  )

  // "full" is only ever rendered inside Studio's resizable, narrow (260-760px) dock — not the
  // full page — so column count must track this grid's own container width, not the browser
  // viewport. sm:/lg: breakpoints fire off viewport width regardless of how narrow the actual
  // panel is, which forced 3-4 columns into ~300px and crushed each card's filename/status
  // badge/exhibit-checkbox row into overlapping text. auto-fill/minmax sizes columns off the
  // real available width instead, with no breakpoints needed.
  const gridClass =
    variant === "full"
      ? "grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4"
      : "grid grid-cols-2 gap-2 overflow-y-auto max-h-64"

  const newFolderCard = (
    <NewFolderCard
      naming={namingFolder}
      name={newFolderName}
      onNameChange={setNewFolderName}
      onStart={() => setNamingFolder(true)}
      onCancel={() => {
        setNamingFolder(false)
        setNewFolderName("")
      }}
      onConfirm={() => {
        const trimmed = newFolderName.trim()
        if (!trimmed) return
        setView({ kind: "folder", name: trimmed })
        setNamingFolder(false)
        setNewFolderName("")
      }}
    />
  )

  let body: React.ReactNode
  if (isLoading) {
    body = <p className="text-sm text-muted-foreground">{t("detail.loading")}</p>
  } else if (isError && !documents) {
    // Checked after isLoading, and only when there's no cached data at all — while a document is
    // indexing, this query polls every few seconds (refetchWhileIndexing), and a single transient
    // poll failure otherwise flips isError true even though `documents` still holds the last good
    // result. Blanking the whole folder view on every such blip made files intermittently "vanish"
    // during indexing despite nothing actually changing server-side.
    body = <p className="text-sm text-red-600 dark:text-red-400">{t("detail.loadDocumentsError")}</p>
  } else if (view.kind === "folder") {
    const folderDocs = (documents ?? []).filter((doc) => (doc.category?.trim() || null) === view.name)
    body =
      folderDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border p-8 text-center">
          <span className="text-sm text-muted-foreground">{t("detail.dropToUpload")}</span>
        </div>
      ) : (
        <div className={gridClass}>
          {folderDocs.map((doc) => (
            <DocumentFileCard
              key={doc.id}
              doc={doc}
              onPreview={() => openPreview(doc)}
              onDelete={() => setDeletingDoc(doc)}
              isDeleting={isDeleting && deletingVars?.documentId === doc.id}
              onToggleExhibit={(isExhibit) => updateDocument({ documentId: doc.id, caseId, isExhibit })}
              isTogglingExhibit={isUpdating && updatingVars?.documentId === doc.id}
            />
          ))}
        </div>
      )
  } else if (!documents || documents.length === 0) {
    body = (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-8 text-center">
        <span className="text-sm text-muted-foreground">{t("detail.noDocuments")}</span>
        {newFolderCard}
      </div>
    )
  } else {
    const folders = new Map<string, UserDocument[]>()
    const looseFiles: UserDocument[] = []
    for (const doc of documents) {
      const category = doc.category?.trim()
      if (category) {
        const bucket = folders.get(category)
        if (bucket) bucket.push(doc)
        else folders.set(category, [doc])
      } else {
        looseFiles.push(doc)
      }
    }
    const sortedFolders = [...folders.entries()].sort(([a], [b]) => a.localeCompare(b))

    body = (
      <div className={gridClass}>
        {sortedFolders.map(([name, docs]) => (
          <DocumentFolderCard
            key={name}
            name={name}
            count={docs.length}
            onOpen={() => setView({ kind: "folder", name })}
            isDragOver={hoverTarget === name}
          />
        ))}
        {looseFiles.map((doc) => (
          <DocumentFileCard
            key={doc.id}
            doc={doc}
            onPreview={() => openPreview(doc)}
            onDelete={() => setDeletingDoc(doc)}
            isDeleting={isDeleting && deletingVars?.documentId === doc.id}
            onToggleExhibit={(isExhibit) => updateDocument({ documentId: doc.id, caseId, isExhibit })}
            isTogglingExhibit={isUpdating && updatingVars?.documentId === doc.id}
          />
        ))}
        {newFolderCard}
      </div>
    )
  }

  // A selected document takes over this whole view (header + grid replaced by a back button and
  // the preview surface) rather than popping a modal — the modal's fixed-position full-viewport
  // overlay ignored the resizable Studio sidebar's own width/height entirely; this way the
  // preview lives inside the panel like Mind Map/Timeline/Data Table's own inline detail views
  // do. AttachmentPreview (the fetch/render logic for pdf/image/docx/xlsx) is shared with
  // FilePreviewModal, which still wraps it in that modal chrome for the chat attachment-chip
  // preview elsewhere.
  if (previewDoc) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex shrink-0 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                aria-label={t("detail.backToDocuments")}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="left">{t("detail.backToDocuments")}</TooltipContent>
          </Tooltip>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{previewDoc.name}</span>
          {previewDoc.url && (
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={tHome("attachment.openInNewTab")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </TooltipTrigger>
              <TooltipContent side="left">{tHome("attachment.openInNewTab")}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          <AttachmentPreview attachment={previewDoc} />
        </div>
      </div>
    )
  }

  // Drag listeners live on this single top-level wrapper so the whole Documents view — root grid,
  // empty state, and an open folder alike — is one drop target; useFileDrop resolves the actual
  // destination per-drop (a specific folder card vs. this view's `defaultDropTarget`). The
  // dashed-border wash covers the whole area, but the big centered "drop to upload" overlay only
  // shows when no specific folder card is being targeted, so it doesn't cover that card's own
  // highlighted state.
  return (
    <div className="flex flex-col gap-3" {...dragHandlers}>
      {header}
      <div
        className={`relative rounded-xl border transition-colors ${
          isDragOver ? "border-primary border-dashed bg-primary/5" : "border-transparent"
        }`}
      >
        {body}
        {isDragOver && !hoverTarget && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-card/90">
            <span className="text-sm font-semibold text-primary">{t("detail.dropToUpload")}</span>
          </div>
        )}
      </div>
      {deletingDoc && (
        <DeleteDocumentModal
          key={deletingDoc.id}
          doc={deletingDoc}
          isDeleting={isDeleting && deletingVars?.documentId === deletingDoc.id}
          onConfirm={() => {
            deleteDocument({ documentId: deletingDoc.id, caseId })
            setDeletingDoc(null)
          }}
          onClose={() => setDeletingDoc(null)}
        />
      )}
    </div>
  )
}

function NewFolderCard({
  naming,
  name,
  onNameChange,
  onStart,
  onCancel,
  onConfirm,
}: {
  naming: boolean
  name: string
  onNameChange: (v: string) => void
  onStart: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation("case-portfolio")

  if (naming) {
    return (
      <div className="flex flex-col items-stretch gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-transparent p-4">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm()
            if (e.key === "Escape") onCancel()
          }}
          placeholder={t("detail.folderNamePrompt")}
          className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        />
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-xs">
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
            {t("editModal.cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="font-semibold text-brand-gold hover:underline">
            {t("detail.addDocument")}
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onStart}
      className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary/30 hover:bg-card dark:hover:bg-overlay-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/5 group-hover:text-primary">
        <FolderPlus className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors group-hover:text-foreground">
        {t("detail.newFolder")}
      </span>
    </button>
  )
}
