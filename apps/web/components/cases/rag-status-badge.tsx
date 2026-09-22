"use client"

import { AlertCircle, Check, Clock, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import type { UserDocument } from "@/lib/cases/mutations"
import { useIsDocumentIndexing } from "@/lib/cases/document-socket"

/** `documentId` lets a PENDING document read "Indexing" (the worker is on it right now, from
 * the document:started socket event) versus "Queued" (waiting its turn in the extraction queue).
 * Without it, or after a reload before the next event, PENDING reads "Queued". */
export function RagStatusBadge({ status, documentId }: { status: UserDocument["ragStatus"]; documentId?: string }) {
  const { t } = useTranslation("case-portfolio")
  const indexing = useIsDocumentIndexing(documentId)

  if (status === "READY") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-green-700 uppercase dark:bg-green-400/10 dark:text-green-400">
            <Check className="h-3 w-3" aria-hidden="true" />
            {t("detail.ragReady")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("detail.ragReadyHint")}</TooltipContent>
      </Tooltip>
    )
  }

  if (status === "FAILED") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-red-600 uppercase dark:bg-red-400/10 dark:text-red-400">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {t("detail.ragFailed")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("detail.ragFailedHint")}</TooltipContent>
      </Tooltip>
    )
  }

  if (!indexing) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            <Clock className="h-3 w-3" aria-hidden="true" />
            {t("detail.ragQueued")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("detail.ragQueuedHint")}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("detail.ragIndexing")}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("detail.ragIndexingHint")}</TooltipContent>
    </Tooltip>
  )
}
