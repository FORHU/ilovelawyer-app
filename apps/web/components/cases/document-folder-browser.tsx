"use client"

import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckSquare, ChevronLeft, ExternalLink, FolderPlus, ListX, Loader2, Plus, Trash2, X } from "lucide-react"
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
import BulkDeleteDocumentsModal from "@/components/cases/bulk-delete-documents-modal"
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
  const {
    mutate: deleteDocument,
    mutateAsync: deleteDocumentAsync,
    isPending: isDeleting,
    variables: deletingVars,
  } = useDeleteCaseDocumentMutation()
  const { mutate: updateDocument, isPending: isUpdating, variables: updatingVars } = useUpdateCaseDocumentMutation()
  const { mutate: uploadDocuments, isPending: isUploading, data: uploadResult } = useUploadCaseDocumentsMutation()
  const hasUploadFailures = (uploadResult?.failed.length ?? 0) > 0

  const [view, setView] = useState<View>({ kind: "root" })
  const [namingFolder, setNamingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [previewDoc, setPreviewDoc] = useState<MessageAttachment | null>(null)
  const [deletingDoc, setDeletingDoc] = useState<UserDocument | null>(null)
  // Bulk selection: document ids selected directly (loose files at root, or any file inside an
  // open folder) plus folder names selected at root — a folder has no id of its own (see the
  // module doc comment on why folders are purely derived), so "deleting" a selected folder means
  // resolving it to every document currently filed under that category at delete time.
  const [selectMode, setSelectMode] = useState(false)
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set())
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = (files: File[], category?: string) => {
    uploadDocuments({ files, caseId, category })
  }

  const exitSelectMode = () => {
    setSelectMode(false)
    setSelectedDocIds(new Set())
    setSelectedFolders(new Set())
  }

  // Navigating between root and a folder changes which items are on screen, so any in-flight
  // selection no longer means what it did — clear it rather than carry stale ids/folder names
  // across views.
  const changeView = (next: View) => {
    exitSelectMode()
    setView(next)
  }

  const toggleDocSelected = (id: string) => {
    setSelectedDocIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleFolderSelected = (name: string) => {
    setSelectedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Root-level (and empty-state) drops have no open folder to target, so the payload goes to the
  // case's root directory (category undefined); an open folder targets itself unless the drop
  // resolves to a more specific folder card via `data-drop-target` (see useFileDrop).
  const defaultDropTarget = view.kind === "folder" ? view.name : undefined
  const { isDragOver, hoverTarget, dragHandlers } = useFileDrop(upload, defaultDropTarget)

  const openPreview = (doc: UserDocument) =>
    setPreviewDoc({ id: doc.id, name: doc.name, url: doc.fileUrl, mimeType: doc.mimeType ?? null })

  // Grouped unconditionally (not just inside the root-view render branch) so both the header's
  // select-all row and the body below can share one derivation of what's currently on screen.
  const folderMap = new Map<string, UserDocument[]>()
  const looseFiles: UserDocument[] = []
  for (const doc of documents ?? []) {
    const category = doc.category?.trim()
    if (category) {
      const bucket = folderMap.get(category)
      if (bucket) bucket.push(doc)
      else folderMap.set(category, [doc])
    } else {
      looseFiles.push(doc)
    }
  }
  const sortedFolders = [...folderMap.entries()].sort(([a], [b]) => a.localeCompare(b))
  const folderDocs =
    view.kind === "folder" ? (documents ?? []).filter((doc) => (doc.category?.trim() || null) === view.name) : []

  const selectableCount = view.kind === "folder" ? folderDocs.length : sortedFolders.length + looseFiles.length
  const selectedCount = view.kind === "folder" ? selectedDocIds.size : selectedDocIds.size + selectedFolders.size
  const allSelected = selectableCount > 0 && selectedCount === selectableCount

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedDocIds(new Set())
      setSelectedFolders(new Set())
    } else if (view.kind === "folder") {
      setSelectedDocIds(new Set(folderDocs.map((d) => d.id)))
    } else {
      setSelectedDocIds(new Set(looseFiles.map((d) => d.id)))
      setSelectedFolders(new Set(sortedFolders.map(([name]) => name)))
    }
  }

  // Clears the current pick without leaving select mode — distinct from exitSelectMode (the
  // toolbar's Cancel button), which drops out of selection entirely.
  const deselectAll = () => {
    setSelectedDocIds(new Set())
    setSelectedFolders(new Set())
  }

  // A selected folder has no id to delete — it resolves to every document currently filed under
  // that category, unioned with any individually-selected document ids.
  const resolveSelectedDocumentIds = (): string[] => {
    const ids = new Set(selectedDocIds)
    if (documents) {
      for (const doc of documents) {
        const category = doc.category?.trim() || null
        if (category && selectedFolders.has(category)) ids.add(doc.id)
      }
    }
    return [...ids]
  }

  const handleBulkDelete = async () => {
    const ids = resolveSelectedDocumentIds()
    setIsBulkDeleting(true)
    await Promise.allSettled(ids.map((documentId) => deleteDocumentAsync({ documentId, caseId })))
    setIsBulkDeleting(false)
    setConfirmingBulkDelete(false)
    exitSelectMode()
  }

  const header = (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        {view.kind === "folder" ? (
          <button
            type="button"
            onClick={() => changeView({ kind: "root" })}
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
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="block cursor-help text-right text-[11px] text-red-600 underline decoration-dotted underline-offset-2 dark:text-red-400">
              {t("detail.uploadError")}
            </span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <ul className="list-disc space-y-0.5 pl-3">
              {uploadResult!.failed.map(({ file, reason }, i) => (
                <li key={`${file.name}-${i}`}>
                  <span className="font-semibold">{file.name}:</span> {reason}
                </li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
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
        changeView({ kind: "folder", name: trimmed })
        setNamingFolder(false)
        setNewFolderName("")
      }}
    />
  )

  // A "Select"/"Select all"/"Delete" row above the grid — folders and documents share it since
  // deleting a folder just means bulk-deleting the documents in it (see resolveSelectedDocumentIds
  // above). Hidden once there's nothing on screen to select, and while a document preview has
  // taken over the view (that branch returns early below, before this is ever reached). Active
  // mode gets its own toolbar surface (border + tinted background) so it reads as a distinct
  // interaction state rather than a second line of plain body text.
  const selectionBar = selectableCount > 0 && (
    <div
      className={
        selectMode
          ? // flex-wrap keeps every control inside this bordered box on narrow widths (Studio's
            // dock can be as narrow as 260px) — the row grows taller instead of letting the
            // cancel button overflow past the box's right edge.
            "flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 dark:bg-overlay-hover/40"
          : "flex items-center justify-end"
      }
    >
      {selectMode ? (
        <>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-brand-gold"
              />
              {t("detail.selectAll")}
              <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                {t("detail.selectedCount", { count: selectedCount })}
              </span>
            </label>
            {selectedCount > 0 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={deselectAll}
                    disabled={isBulkDeleting}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ListX className="h-3 w-3 shrink-0" aria-hidden="true" />
                    {t("detail.deselectAll")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("detail.deselectAll")}</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={selectedCount === 0 || isBulkDeleting}
                  onClick={() => setConfirmingBulkDelete(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 py-1.5 pr-3.5 pl-3 text-xs font-semibold whitespace-nowrap text-red-600 transition-colors hover:border-red-500/50 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400"
                >
                  {isBulkDeleting ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  )}
                  {t("detail.deleteSelected")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("detail.deleteSelected")}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={exitSelectMode}
                  disabled={isBulkDeleting}
                  aria-label={t("editModal.cancel")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-overlay-hover"
                >
                  <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("editModal.cancel")}</TooltipContent>
            </Tooltip>
          </div>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setSelectMode(true)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
        >
          <CheckSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("detail.selectItems")}
        </button>
      )}
    </div>
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
              selectable={selectMode}
              selected={selectedDocIds.has(doc.id)}
              onToggleSelect={() => toggleDocSelected(doc.id)}
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
    body = (
      <div className={gridClass}>
        {sortedFolders.map(([name, docs]) => (
          <DocumentFolderCard
            key={name}
            name={name}
            count={docs.length}
            onOpen={() => changeView({ kind: "folder", name })}
            isDragOver={hoverTarget === name}
            selectable={selectMode}
            selected={selectedFolders.has(name)}
            onToggleSelect={() => toggleFolderSelected(name)}
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
            selectable={selectMode}
            selected={selectedDocIds.has(doc.id)}
            onToggleSelect={() => toggleDocSelected(doc.id)}
          />
        ))}
        {!selectMode && newFolderCard}
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
      {selectionBar}
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
      {confirmingBulkDelete && (
        <BulkDeleteDocumentsModal
          count={resolveSelectedDocumentIds().length}
          isDeleting={isBulkDeleting}
          onConfirm={handleBulkDelete}
          onClose={() => setConfirmingBulkDelete(false)}
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
