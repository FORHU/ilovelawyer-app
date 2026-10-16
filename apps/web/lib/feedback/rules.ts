export type FeedbackSource = "GENERAL" | "CHAT_ANSWER" | "TERMINAL_PANE"
export type FeedbackRating = "UP" | "DOWN"

/** What a general submission is about. Keep in step with FEEDBACK_CATEGORIES in ilovelawyer-api. */
export const FEEDBACK_CATEGORIES = ["BUG", "WRONG_ANSWER", "IDEA", "QUESTION"] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

/** Keep in step with FEEDBACK_COMMENT_MAX_CHARS in ilovelawyer-api. */
export const FEEDBACK_COMMENT_MAX_CHARS = 4000

interface Draft {
  source: FeedbackSource
  rating?: FeedbackRating
  category?: FeedbackCategory | null
  comment: string
}

/** Whether the API will take this draft (it mirrors submitFeedbackSchema): every comment is required
 * except on a thumbs-up, which may go without one. A category is never required. */
export function isFeedbackSendable({ source, rating, comment }: Draft): boolean {
  const text = comment.trim()
  if (text.length > FEEDBACK_COMMENT_MAX_CHARS) return false
  const commentRequired = !(source === "CHAT_ANSWER" && rating === "UP")
  return !commentRequired || text.length > 0
}

/** The case a page belongs to, read from its route (the Terminal and the case page both carry the case
 * id in the path), so a general submission from a case page can say which case it was on. The API checks
 * the sender can open it; an id that isn't a case is simply refused there. */
export function caseIdFromPath(pathname: string): string | undefined {
  return pathname.match(/\/(?:terminal|case-portfolio)\/([0-9a-fA-F-]{36})(?:\/|$)/)?.[1]
}

export function viewportOf(width: number, height: number): string {
  return `${Math.round(width)}x${Math.round(height)}`
}
