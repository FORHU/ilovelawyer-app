"use client"

import { FileText, Loader2, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { RagStatusBadge } from "@/components/cases/rag-status-badge"
import type { UserDocument } from "@/lib/cases/mutations"

/** One file, as a grid card (folder-grid sibling of a `DocumentFolderCard`) — same content and
 * actions as the old flat-list row, laid out for a grid instead of a `<li>`. */
export function DocumentFileCard({
  doc,
  onPreview,
  onDelete,
  isDeleting,
}: {
  doc: UserDocument
  onPreview: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useTranslation("case-portfolio")

  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border hover:bg-muted/50">
      <div className="flex items-start justify-between gap-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={isDeleting}
              onClick={onDelete}
              aria-label={t("detail.removeDocument", { documentName: doc.name })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:text-red-400"
            >
              {isDeleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>{t("detail.removeDocument", { documentName: doc.name })}</TooltipContent>
        </Tooltip>
      </div>
      {doc.fileUrl ? (
        <button
          type="button"
          onClick={onPreview}
          className="truncate text-left text-sm text-foreground hover:text-brand-gold hover:underline"
        >
          {doc.name}
        </button>
      ) : (
        <span className="truncate text-sm text-foreground">{doc.name}</span>
      )}
      <RagStatusBadge status={doc.ragStatus} />
    </div>
  )
}
