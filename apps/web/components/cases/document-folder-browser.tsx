"use client"

import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, FolderPlus, Loader2, Plus } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import {
  useCaseDocumentsQuery,
  useDeleteCaseDocumentMutation,
  useUploadCaseDocumentsMutation,
  type UserDocument,
} from "@/lib/cases/mutations"
import { useFileDrop } from "@/hooks/use-file-drop"
import { DocumentFolderCard } from "@/components/cases/document-folder-card"
import { DocumentFileCard } from "@/components/cases/document-file-card"
import FilePreviewModal from "@/components/chat/file-preview-modal"
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
  const { data: documents, isLoading, isError } = useCaseDocumentsQuery(caseId)
  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation()
  const { mutate: uploadDocuments, isPending: isUploading, data: uploadResult } = useUploadCaseDocumentsMutation()
  const hasUploadFailures = (uploadResult?.failed.length ?? 0) > 0

  const [view, setView] = useState<View>({ kind: "root" })
  const [namingFolder, setNamingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [previewDoc, setPreviewDoc] = useState<MessageAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const upload = (files: File[], category?: string) => {
    uploadDocuments({ files, caseId, category })
  }

  const { isDragOver, dragHandlers } = useFileDrop((files) => upload(files, view.kind === "folder" ? view.name : undefined))

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

  const gridClass =
    variant === "full"
      ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
      : "grid grid-cols-2 gap-2 overflow-y-auto max-h-64"

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-sm text-muted-foreground">{t("detail.loading")}</p>
      </div>
    )
  }

  // Checked after isLoading, and only when there's no cached data at all — while a document is
  // indexing, this query polls every few seconds (refetchWhileIndexing), and a single transient
  // poll failure otherwise flips isError true even though `documents` still holds the last good
  // result. Blanking the whole folder view on every such blip made files intermittently "vanish"
  // during indexing despite nothing actually changing server-side.
  if (isError && !documents) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-sm text-red-600 dark:text-red-400">{t("detail.loadDocumentsError")}</p>
      </div>
    )
  }

  if (view.kind === "folder") {
    const folderDocs = (documents ?? []).filter((doc) => (doc.category?.trim() || null) === view.name)
    return (
      <div className="flex flex-col gap-3">
        {header}
        <div
          {...dragHandlers}
          className={`relative rounded-xl border transition-colors ${
            isDragOver ? "border-primary border-dashed bg-primary/5" : "border-transparent"
          }`}
        >
          {folderDocs.length === 0 ? (
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
                  onDelete={() => deleteDocument({ documentId: doc.id, caseId })}
                  isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                />
              ))}
            </div>
          )}
          {isDragOver && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-card/90">
              <span className="text-sm font-semibold text-primary">{t("detail.dropToUpload")}</span>
            </div>
          )}
        </div>
        {previewDoc && <FilePreviewModal attachment={previewDoc} onClose={() => setPreviewDoc(null)} />}
      </div>
    )
  }

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

  if (!documents || documents.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-sm text-muted-foreground">{t("detail.noDocuments")}</p>
        {newFolderCard}
      </div>
    )
  }

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

  return (
    <div className="flex flex-col gap-3">
      {header}
      <div className={gridClass}>
        {sortedFolders.map(([name, docs]) => (
          <DocumentFolderCard
            key={name}
            name={name}
            count={docs.length}
            onOpen={() => setView({ kind: "folder", name })}
            onDropFiles={(files) => upload(files, name)}
          />
        ))}
        {looseFiles.map((doc) => (
          <DocumentFileCard
            key={doc.id}
            doc={doc}
            onPreview={() => openPreview(doc)}
            onDelete={() => deleteDocument({ documentId: doc.id, caseId })}
            isDeleting={isDeleting && deletingVars?.documentId === doc.id}
          />
        ))}
        {newFolderCard}
      </div>
      {previewDoc && <FilePreviewModal attachment={previewDoc} onClose={() => setPreviewDoc(null)} />}
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
        <div className="flex items-center justify-end gap-2 text-xs">
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
      className="group flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border p-4 text-center transition-colors hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
