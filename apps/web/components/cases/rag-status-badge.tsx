"use client"

import { AlertCircle, Check, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import type { UserDocument } from "@/lib/cases/mutations"

export function RagStatusBadge({ status }: { status: UserDocument["ragStatus"] }) {
  const { t } = useTranslation("case-portfolio")

  if (status === "READY") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tracking-wide text-green-700 dark:text-green-400 uppercase">
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
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tracking-wide text-red-600 dark:text-red-400 uppercase">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {t("detail.ragFailed")}
          </span>
        </TooltipTrigger>
        <TooltipContent>{t("detail.ragFailedHint")}</TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t("detail.ragIndexing")}
        </span>
      </TooltipTrigger>
      <TooltipContent>{t("detail.ragIndexingHint")}</TooltipContent>
    </Tooltip>
  )
}
