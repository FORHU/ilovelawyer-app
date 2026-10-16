"use client"

import { useState } from "react"
import { ThumbsDown, ThumbsUp } from "lucide-react"
import { useTranslation } from "react-i18next"
import { FeedbackForm } from "@/components/feedback/feedback-form"
import type { FeedbackRating } from "@/lib/feedback/rules"

/** Thumbs on a finished chat answer. Either thumb opens a comment form under the answer; sending it
 * files the feedback against this answer (by reference, never its text). Renders into the same
 * flex-wrap row as the Copy button, so the form drops onto its own line below it. */
export function MessageFeedback({
  messageId,
  consultationId,
  caseId,
  compact = false,
}: {
  messageId: string
  consultationId: string
  caseId?: string
  /** Icon-only, tighter padding — same as the Copy button, for the narrower embedded chat panels. */
  compact?: boolean
}) {
  const { t } = useTranslation("common")
  const [open, setOpen] = useState<FeedbackRating | null>(null)
  const [sent, setSent] = useState<FeedbackRating | null>(null)

  const iconSize = compact ? "h-4 w-4" : "h-6 w-6"
  const button = (rating: FeedbackRating, label: string, Icon: typeof ThumbsUp) => {
    const active = sent === rating || open === rating
    return (
      <button
        type="button"
        disabled={sent !== null}
        aria-pressed={active}
        onClick={() => setOpen(open === rating ? null : rating)}
        title={label}
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground disabled:cursor-default disabled:hover:bg-transparent ${
          compact ? "p-1.5" : "p-2"
        } ${active ? "bg-muted text-foreground" : "text-muted-foreground"} ${sent !== null && !active ? "opacity-40" : ""}`}
      >
        <Icon className={iconSize} aria-hidden="true" />
      </button>
    )
  }

  return (
    <>
      {button("UP", t("feedback.message.helpful", { defaultValue: "Helpful" }), ThumbsUp)}
      {button("DOWN", t("feedback.message.notHelpful", { defaultValue: "Not helpful" }), ThumbsDown)}
      {open && (
        <>
          {/* A row break: the form's max-w-xl would otherwise let it sit beside the icons instead of under them. */}
          <div aria-hidden="true" className="h-0 basis-full" />
          <div data-slot="message-feedback-form" className="mt-2 w-full max-w-xl rounded-[14px] border border-border bg-card p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">
            {open === "UP"
              ? t("feedback.message.titleUp", { defaultValue: "What worked?" })
              : t("feedback.message.titleDown", { defaultValue: "What went wrong?" })}
          </p>
          <FeedbackForm
            layout="inline"
            source="CHAT_ANSWER"
            rating={open}
            refs={{ messageId, consultationId, caseId }}
            onSent={() => {
              setSent(open)
              setOpen(null)
            }}
            onCancel={() => setOpen(null)}
          />
          </div>
        </>
      )}
    </>
  )
}
