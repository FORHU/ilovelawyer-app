"use client"

import { Folder } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useFileDrop } from "@/hooks/use-file-drop"

/** A category folder in the document grid — dragging files onto it (or clicking it open) uploads
 * straight into this category, bypassing the AI auto-categorization step (see
 * useUploadCaseDocumentsMutation's `category` param). */
export function DocumentFolderCard({
  name,
  count,
  onOpen,
  onDropFiles,
}: {
  name: string
  count: number
  onOpen: () => void
  onDropFiles: (files: File[]) => void
}) {
  const { t } = useTranslation("case-portfolio")
  const { isDragOver, dragHandlers } = useFileDrop(onDropFiles)

  return (
    <button
      type="button"
      onClick={onOpen}
      {...dragHandlers}
      className={`group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        isDragOver ? "border-primary border-dashed bg-primary/5" : "border-border"
      }`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-gold/15 text-brand-gold">
        <Folder className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 w-full truncate text-sm font-semibold text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">{t("detail.docCount", { count })}</span>
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/90 pointer-events-none">
          <span className="text-xs font-semibold text-primary">{t("detail.dropToUpload")}</span>
        </div>
      )}
    </button>
  )
}
