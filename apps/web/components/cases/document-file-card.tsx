"use client"

import { Archive, ArchiveRestore, FileText, Loader2, Trash2 } from "lucide-react"
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
  onToggleExhibit,
  isTogglingExhibit,
  onToggleArchive,
  isTogglingArchive,
}: {
  doc: UserDocument
  onPreview: () => void
  onDelete: () => void
  isDeleting: boolean
  onToggleExhibit: (isExhibit: boolean) => void
  isTogglingExhibit: boolean
  /** Archives an ACTIVE document, or restores an ARCHIVED one — which action fires is derived
   * from `doc.status`. */
  onToggleArchive: () => void
  isTogglingArchive: boolean
}) {
  const { t } = useTranslation("case-portfolio")
  const isArchived = doc.status === "ARCHIVED"

  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-border hover:bg-muted/50 dark:hover:bg-overlay-hover">
      <div className="flex items-start justify-between gap-1">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          <FileText className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={isTogglingArchive}
                onClick={onToggleArchive}
                aria-label={
                  isArchived
                    ? t("detail.unarchiveDocument", { documentName: doc.name })
                    : t("detail.archiveDocument", { documentName: doc.name })
                }
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-amber-500/10 hover:text-amber-600 disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:text-amber-400"
              >
                {isTogglingArchive ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : isArchived ? (
                  <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {isArchived
                ? t("detail.unarchiveDocument", { documentName: doc.name })
                : t("detail.archiveDocument", { documentName: doc.name })}
            </TooltipContent>
          </Tooltip>
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
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <RagStatusBadge status={doc.ragStatus} />
        <Tooltip>
          <TooltipTrigger asChild>
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              {isTogglingExhibit ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <input
                  type="checkbox"
                  checked={doc.isExhibit}
                  disabled={isTogglingExhibit}
                  onChange={(e) => onToggleExhibit(e.target.checked)}
                  aria-label={t("detail.markAsExhibit", { documentName: doc.name })}
                  className="h-3.5 w-3.5 rounded border-border accent-brand-gold"
                />
              )}
              {t("detail.exhibit")}
            </label>
          </TooltipTrigger>
          <TooltipContent>{t("detail.markAsExhibit", { documentName: doc.name })}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
