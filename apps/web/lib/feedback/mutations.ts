import { useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import type { FeedbackCategory, FeedbackRating, FeedbackSource } from "@/lib/feedback/rules"

export interface SubmitFeedbackInput {
  source: FeedbackSource
  rating?: FeedbackRating
  category?: FeedbackCategory
  comment?: string
  organizationId?: string
  caseId?: string
  consultationId?: string
  messageId?: string
  panelId?: string
  /** The route only, no query string. */
  pagePath?: string
  viewport?: string
}

/** Sends one piece of feedback. Ids and the person's own words only: never answer or pane text. */
export function useSubmitFeedbackMutation() {
  return useMutation({
    mutationFn: (input: SubmitFeedbackInput) =>
      apiFetch<{ id: string }>("/api/feedback", { method: "POST", body: JSON.stringify(input) }),
  })
}
