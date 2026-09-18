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
  selectable = false,
  selected = false,
  onToggleSelect,
}: {
  name: string
  count: number
  onOpen: () => void
  isDragOver: boolean
  /** When true, the card renders as a selection tile (checkbox + click-to-toggle) instead of a
   * button that opens the folder — mutually exclusive with drag-and-drop targeting, which only
   * matters while actually browsing. */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: () => void
}) {
  const { t } = useTranslation("case-portfolio")

  const body = (
    <>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-gold/15 text-brand-gold">
        <Folder className="h-4.5 w-4.5" aria-hidden="true" />
      </span>
      <span className="min-w-0 w-full truncate text-sm font-semibold text-foreground">{name}</span>
      <span className="text-xs text-muted-foreground">{t("detail.docCount", { count })}</span>
    </>
  )

  if (selectable) {
    // A real <input type="checkbox"> can't nest inside the <button> used below (interactive
    // content isn't valid inside interactive content), so selection mode swaps to a <div> with
    // role="checkbox" instead of layering a checkbox into the browsing button.
    return (
      <div
        role="checkbox"
        aria-checked={selected}
        aria-label={t("detail.selectFolder", { folderName: name })}
        tabIndex={0}
        onClick={onToggleSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onToggleSelect?.()
          }
        }}
        className={`group relative flex cursor-pointer flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
          selected ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          className="absolute top-3 right-3 h-4 w-4 rounded border-border accent-brand-gold"
        />
        {body}
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      data-drop-target={name}
      className={`group relative flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
        isDragOver ? "border-primary border-dashed bg-primary/5" : "border-border"
      }`}
    >
      {body}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-card/90 pointer-events-none">
          <span className="text-xs font-semibold text-primary">{t("detail.dropToUpload")}</span>
        </div>
      )}
    </button>
  )
}
