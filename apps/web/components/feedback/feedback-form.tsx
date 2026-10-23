"use client"

import { useEffect, useId, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { useAuthStore } from "@/lib/store/auth.store"
import { useSubmitFeedbackMutation } from "@/lib/feedback/mutations"
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_COMMENT_MAX_CHARS,
  caseIdFromPath,
  isFeedbackSendable,
  viewportOf,
  type FeedbackCategory,
  type FeedbackRating,
  type FeedbackSource,
} from "@/lib/feedback/rules"

const labelClass = "text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground"

interface FeedbackFormProps {
  source: FeedbackSource
  /** For a chat answer: which thumb opened the form. */
  rating?: FeedbackRating
  /** What the feedback is about. The API checks the sender can open each one. */
  refs?: { caseId?: string; consultationId?: string; messageId?: string; panelId?: string }
  /** "drawer" is the full header form (category chips, what's sent); "inline" is a comment box under an answer or pane. */
  layout: "drawer" | "inline"
  onSent: () => void
  onCancel: () => void
  /** Extra classes for the button row, e.g. room for the Guide launcher that floats over a drawer's corner. */
  footerClassName?: string
}

/** The one feedback form: the header drawer, a thumb on a chat answer and the flag on a Terminal pane
 * all use it. Sends ids and the person's own words only, never answer or pane text. */
export function FeedbackForm({ source, rating, refs, layout, onSent, onCancel, footerClassName }: FeedbackFormProps) {
  const { t } = useTranslation("common")
  const pathname = usePathname()
  // The firm only: a solo lawyer's own workspace has no organization.
  const organizationId = useAuthStore((s) => (s.organization && !s.organization.isPersonal ? s.organization.id : undefined))
  const submit = useSubmitFeedbackMutation()
  const [category, setCategory] = useState<FeedbackCategory | null>(null)
  const [comment, setComment] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const counterId = useId()

  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  const commentOptional = source === "CHAT_ANSWER" && rating === "UP"
  const sendable = isFeedbackSendable({ source, rating, category, comment })

  const placeholder =
    source === "GENERAL"
      ? t("feedback.detailsPlaceholder", { defaultValue: "What were you doing, and what did you expect?" })
      : source === "TERMINAL_PANE"
        ? t("feedback.pane.placeholder", { defaultValue: "What is wrong or missing in this pane?" })
        : rating === "UP"
          ? t("feedback.message.placeholderUp", { defaultValue: "What worked well? (optional)" })
          : t("feedback.message.placeholderDown", { defaultValue: "What was wrong with this answer?" })

  const note =
    source === "GENERAL"
      ? t("feedback.generalNote", { defaultValue: "Sent with it: the page you're on, your account and organization, and your browser. No case text or documents." })
      : source === "TERMINAL_PANE"
        ? t("feedback.pane.note", { defaultValue: "Sends which pane and case this is. Not the pane's text." })
        : t("feedback.message.note", { defaultValue: "Sends a reference to this answer, not its text, so case content stays in the case." })

  const send = () => {
    if (!sendable || submit.isPending) return
    submit.mutate(
      {
        source,
        rating,
        category: category ?? undefined,
        comment: comment.trim() || undefined,
        organizationId,
        caseId: refs?.caseId ?? caseIdFromPath(pathname),
        consultationId: refs?.consultationId,
        messageId: refs?.messageId,
        panelId: refs?.panelId,
        pagePath: pathname,
        viewport: viewportOf(window.innerWidth, window.innerHeight),
      },
      {
        onSuccess: () => {
          toast.success(t("feedback.sent", { defaultValue: "Thanks, your feedback was sent." }))
          onSent()
        },
      },
    )
  }

  const atLimit = comment.length >= FEEDBACK_COMMENT_MAX_CHARS

  const textarea = (
    <div className="flex flex-col gap-1.5">
      <textarea
        ref={textareaRef}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={FEEDBACK_COMMENT_MAX_CHARS}
        rows={layout === "drawer" ? 6 : 3}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-required={!commentOptional}
        aria-describedby={counterId}
        className="w-full resize-y rounded-[10px] border border-border bg-background px-3 py-2.5 text-[13px] leading-normal text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div id={counterId} className="flex items-start justify-between gap-3 text-[11px] leading-normal">
        <span role="status" className="text-danger">
          {atLimit && t("feedback.limitReached", { max: FEEDBACK_COMMENT_MAX_CHARS.toLocaleString(), defaultValue: "You've reached the {{max}}-character limit." })}
        </span>
        <span className={`shrink-0 tabular-nums ${atLimit ? "text-danger" : "text-muted-foreground"}`}>
          {comment.length}/{FEEDBACK_COMMENT_MAX_CHARS}
        </span>
      </div>
    </div>
  )

  const footer = (
    <div className={`flex items-center justify-end gap-1.5 ${footerClassName ?? ""}`}>
      <Button type="button" variant="ghost" onClick={onCancel} className="h-8 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
        {t("feedback.cancel", { defaultValue: "Cancel" })}
      </Button>
      <Button type="button" onClick={send} disabled={!sendable || submit.isPending} className="h-8 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[1.2px]">
        {submit.isPending ? t("feedback.sending", { defaultValue: "Sending…" }) : t("feedback.send", { defaultValue: "Send" })}
      </Button>
    </div>
  )

  const error = submit.isError && (
    <p role="alert" className="text-[12px] text-danger">
      {t("feedback.failed", { defaultValue: "Couldn't send your feedback. Please try again." })}
    </p>
  )

  // Says why Send is greyed out, so a disabled button is never a mystery.
  const hint = sendable ? null : (
    <p className="text-[11px] leading-normal text-muted-foreground">
      {t("feedback.hintComment", { defaultValue: "Add a few words to send." })}
    </p>
  )

  const privacy = (
    <p className="flex items-start gap-2 text-[11px] leading-normal text-muted-foreground">
      <Lock className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
      <span>{note}</span>
    </p>
  )

  if (layout === "inline") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        className="flex flex-col gap-3"
      >
        {textarea}
        {privacy}
        {hint}
        {error}
        {footer}
      </form>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4.5">
        <div className="flex flex-col gap-2.5">
          <span className={labelClass}>{t("feedback.kindLabel", { defaultValue: "What kind of feedback? (optional)" })}</span>
          <div className="flex flex-wrap gap-2">
            {FEEDBACK_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={category === c}
                onClick={() => setCategory(category === c ? null : c)}
                className={`inline-flex h-[30px] cursor-pointer items-center rounded-full border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  category === c ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:border-foreground"
                }`}
              >
                {t(`feedback.categories.${c}`, { defaultValue: DEFAULT_CATEGORY_LABEL[c] })}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          <span className={labelClass}>{t("feedback.detailsLabel", { defaultValue: "Details" })}</span>
          {textarea}
        </div>
        {privacy}
        {hint}
        {error}
      </div>
      <div className="border-t border-border px-5 py-3.5">{footer}</div>
    </form>
  )
}

const DEFAULT_CATEGORY_LABEL: Record<FeedbackCategory, string> = {
  BUG: "Something is broken",
  WRONG_ANSWER: "Answer was wrong or incomplete",
  IDEA: "Idea or request",
  QUESTION: "Question",
}
