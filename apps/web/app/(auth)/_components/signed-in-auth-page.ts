/** What (auth)/layout.tsx does when /login or /signup opens on a browser that already has a
 * signed-in session. Pulled out as a pure function so it can be unit-tested without the
 * component-rendering harness this repo doesn't have (see vitest.config.ts's top comment).
 *   - "show-form": a case-lawyer invite link (?caseInviteToken=) only gets redeemed by a
 *     login/verify-otp/Google call that carries the token, so bouncing a signed-in lawyer
 *     onward would drop the invite. Copy-link invites have no `email`, so the org-invite
 *     email check below can never let them through; they show the form instead, and signing in
 *     again replaces the session (the same way the org-invite mismatch case does).
 *   - "check-invited-email": an org-invite sign-up link (?email=) is meant for that address —
 *     only carry on if it's who's signed in.
 *   - "redirect": nothing on this page for a signed-in user; continue to `next`. */
export type SignedInAuthPageAction = "show-form" | "check-invited-email" | "redirect"

export function resolveSignedInAuthPageAction(params: Pick<URLSearchParams, "get">): SignedInAuthPageAction {
  if (params.get("caseInviteToken")) return "show-form"
  if (params.get("email")) return "check-invited-email"
  return "redirect"
}
