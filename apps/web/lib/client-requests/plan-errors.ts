import { toast } from "sonner"

/** The lawyer app's Plans page, where a refusal below sends the lawyer. */
export const PLANS_PATH = "/homepage/plans"

/** The API's answers when the lawyer's plan stands in the way (ilovelawyer-api's AccountLimitsSvc):
 * a free trial that's over, this month's client requests already taken on, or the case limit (a
 * workspace copy is a case of their own). */
const PLAN_ERROR_CODES = ["PLAN_TRIAL_ENDED", "CLIENT_REQUEST_LIMIT_REACHED", "CASE_LIMIT_REACHED"]

/** Shows why a client-request action failed, in the API's own words. One their plan refused also
 * offers the Plans page, right in the toast. */
export function toastRequestError(
  err: unknown,
  { fallback, choosePlan, onChoosePlan }: { fallback: string; choosePlan: string; onChoosePlan: () => void }
) {
  const message = err instanceof Error ? err.message : fallback
  const code = (err as { code?: unknown } | null)?.code
  if (typeof code === "string" && PLAN_ERROR_CODES.includes(code)) {
    toast.error(message, { action: { label: choosePlan, onClick: onChoosePlan }, duration: 10_000 })
  } else {
    toast.error(message)
  }
}
