import { useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

export interface SendEmailPayload {
  consultationId: string
  to: string
  subject: string
  text: string
  /** Case Documents and/or message-scoped Documents to attach — see
   * docs/case-consultation-email-backend-handoff.md. */
  documentIds?: string[]
}

/** Sends an in-app-composed email for a consultation (docs/adr/0013-case-consultation-email-action.md).
 * Calls a not-yet-deployed endpoint — see docs/case-consultation-email-backend-handoff.md — so this
 * will fail until that backend work ships; the UI is otherwise fully wired and needs no changes once
 * it does. */
export function useSendEmailMutation() {
  return useMutation({
    mutationFn: ({ consultationId, ...body }: SendEmailPayload) =>
      apiFetch<void>(`/api/chat/consultations/${consultationId}/send-email`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
  })
}
