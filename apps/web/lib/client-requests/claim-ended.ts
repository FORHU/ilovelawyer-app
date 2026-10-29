import type { ClaimSummary } from "@/lib/client-requests/types"

/**
 * Several lawyers (ilovelawyer-api phase 5): where the lawyer's own claim on a request ended, as the
 * "client-request" translation key holding its badge, title and body, or null while it's open or
 * engaged. The request can still be ROUTED for other lawyers, so its status doesn't say this.
 */
export function claimEndedKey(claim: Pick<ClaimSummary, "byMe" | "outcome"> | null | undefined): string | null {
  if (!claim?.byMe || !claim.outcome || claim.outcome === "ENGAGED") return null
  return claim.outcome === "NOT_CHOSEN" ? "detail.notChosen" : `detail.ended.${claim.outcome}`
}
