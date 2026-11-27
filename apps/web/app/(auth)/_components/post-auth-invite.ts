import type { CaseLawyerInviteOutcome } from "@/lib/auth/mutations"
import type { CaseLawyerInviteLookup } from "@/lib/auth/case-lawyer-invite"

/** What unified-auth.tsx does after a verify-otp/login/google success, given that mutation's
 * `caseLawyerInvite` field (Task 11's CaseLawyerInviteOutcome). Pulled out as a pure function so
 * it can be unit-tested without the component-rendering harness this repo doesn't have (see
 * vitest.config.ts's top comment) — the component itself just calls this and reacts.
 *   - `requestId`/`caseId` present: the redemption succeeded — go to that client request
 *     instead of wherever auth would otherwise have sent them.
 *   - `error` present: the redemption failed, but auth itself still completed — let the
 *     caller's normal flow continue; only the toast differs.
 *   - `null`: no `caseInviteToken` was ever sent — nothing to do here. */
export type PostAuthRouteDecision = { kind: "redeemed"; destination: string } | { kind: "failed" } | { kind: "none" }

export function resolvePostAuthDestination(caseLawyerInvite: CaseLawyerInviteOutcome): PostAuthRouteDecision {
  if (caseLawyerInvite && "requestId" in caseLawyerInvite) {
    return { kind: "redeemed", destination: `/homepage/client-requests/${caseLawyerInvite.requestId}` }
  }
  if (caseLawyerInvite && "error" in caseLawyerInvite) {
    return { kind: "failed" }
  }
  return { kind: "none" }
}

/** What the small banner above the sign-in/sign-up form should show, given the
 * `?caseInviteToken=` lookup's state. Also pulled out as a pure function for the same reason
 * as resolvePostAuthDestination — it's a pure decision over plain data, no need to render
 * anything to test it. */
export type InviteBannerState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "valid"; clientFirstName: string; caseName: string }
  | { kind: "unavailable" }

export function resolveInviteBannerState(params: {
  hasToken: boolean
  isLoading: boolean
  lookup: CaseLawyerInviteLookup | undefined
}): InviteBannerState {
  if (!params.hasToken) return { kind: "none" }
  if (params.isLoading || !params.lookup) return { kind: "loading" }
  if (params.lookup.status === "valid") {
    return { kind: "valid", clientFirstName: params.lookup.clientFirstName, caseName: params.lookup.caseName }
  }
  return { kind: "unavailable" }
}
