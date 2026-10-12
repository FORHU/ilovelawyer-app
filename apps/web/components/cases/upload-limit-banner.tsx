"use client"

import { AlertTriangle, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { formatBytes, MAX_BATCH_SIZE_BYTES } from "@/lib/cases/upload-batch"

/** Inline warning shown above an upload area when a selection was rejected for totalling over
 * MAX_BATCH_SIZE_BYTES (see checkUploadSelection). Nothing from that selection was uploaded; the
 * banner says how big it was so the person knows how much to remove. Renders nothing when
 * `totalBytes` is null. */
export function UploadLimitBanner({
  totalBytes,
  onDismiss,
  className = "",
}: {
  totalBytes: number | null
  onDismiss: () => void
  className?: string
}) {
  const { t } = useTranslation("common")
  if (totalBytes === null) return null

  const total = formatBytes(totalBytes)
  const limit = formatBytes(MAX_BATCH_SIZE_BYTES)
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 ${className}`}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-[13px] leading-relaxed">
        {t("uploadLimit.batchTooLarge", {
          defaultValue: `These files total ${total} — you can upload up to ${limit} at once. Remove some files or upload them in smaller groups.`,
          total,
          limit,
        })}
      </p>
      <button
        type="button"
        onClick={onDismiss}
        className="-m-1 shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100 dark:text-amber-300 dark:hover:bg-amber-500/15"
        aria-label={t("uploadLimit.dismiss", { defaultValue: "Dismiss" })}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}
