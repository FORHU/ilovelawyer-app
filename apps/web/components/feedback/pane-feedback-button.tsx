"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Flag } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Popover, PopoverContent, PopoverTrigger } from "@workspace/ui/components/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { FeedbackForm } from "@/components/feedback/feedback-form"

/** The flag in a Terminal pane's header: opens a comment form filed against this pane and case (by id,
 * never the pane's text). The case comes from the route, which every Terminal page, popped-out
 * canvas windows included, carries as [caseId]. */
export function PaneFeedbackButton({ panelId }: { panelId: string }) {
  const { t } = useTranslation("common")
  const params = useParams<{ caseId?: string }>()
  const caseId = typeof params?.caseId === "string" ? params.caseId : undefined
  const [open, setOpen] = useState(false)
  if (!caseId) return null

  const label = t("feedback.pane.flag", { defaultValue: "Flag this pane" })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              aria-label={label}
              className={`rounded p-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover ${
                open ? "text-brand-gold" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
      {/* Stops pointer and key events here: this popover renders inside the pane header's React tree,
          where a press would otherwise start dragging the pane and a key could reach terminal shortcuts. */}
      <PopoverContent
        align="end"
        className="w-80 p-4"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">{label}</p>
        <FeedbackForm layout="inline" source="TERMINAL_PANE" refs={{ panelId, caseId }} onSent={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </PopoverContent>
    </Popover>
  )
}
