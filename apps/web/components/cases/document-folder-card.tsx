"use client"

import { Folder } from "lucide-react"
import { useTranslation } from "react-i18next"

/** A category folder in the document grid. Its own drag-and-drop is not handled here — the
 * enclosing `DocumentFolderBrowser` container owns a single set of drag listeners for the whole
 * grid and resolves the actual drop target itself; this card only marks itself as a resolvable
 * target via `data-drop-target` and renders whatever `isDragOver` the container computed for it. */
export function DocumentFolderCard({
  name,
  count,
  onOpen,
  isDragOver,
}: {
  name: string
  count: number
  onOpen: () => void
  isDragOver: boolean
}) {
  const { t } = useTranslation("case-portfolio")

  return (
    <button
      type="button"
      onClick={onOpen}
      data-drop-target={name}
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
