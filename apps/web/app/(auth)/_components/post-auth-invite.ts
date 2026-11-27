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
  isError: boolean
  lookup: CaseLawyerInviteLookup | undefined
}): InviteBannerState {
  if (!params.hasToken) return { kind: "none" }
  // A settled lookup error (a 404 for a mangled/truncated token, or a 5xx) never produces data —
  // without this it would sit in "loading" forever and the user would see no banner at all.
  if (params.isError) return { kind: "unavailable" }
  if (params.isLoading || !params.lookup) return { kind: "loading" }
  if (params.lookup.status === "valid") {
    return { kind: "valid", clientFirstName: params.lookup.clientFirstName, caseName: params.lookup.caseName }
  }
  return { kind: "unavailable" }
}

/** The `caseInviteToken` the auth mutations may actually send: only one the public lookup has
 * already resolved (any status — the server stays the authority on whether it can still be
 * redeemed). A token the lookup rejected, or hasn't answered for yet, is dropped so the user
 * gets a plain sign-in/sign-up: a malformed value the API's request validation would reject
 * must never block authentication itself. `lookup` comes from a query keyed on this exact
 * token, so a resolved lookup always belongs to the token being sent. */
export function resolveRedeemableInviteToken(params: {
  token: string | undefined
  isError: boolean
  lookup: CaseLawyerInviteLookup | undefined
}): string | undefined {
  if (!params.token || params.isError || !params.lookup) return undefined
  return params.token
}
