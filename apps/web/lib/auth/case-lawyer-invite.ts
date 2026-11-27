import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

export type CaseLawyerInviteStatus = "valid" | "expired" | "revoked" | "accepted"

export interface CaseLawyerInviteLookup {
  status: CaseLawyerInviteStatus
  clientFirstName: string
  caseName: string
  email: string | null
}

/** GET /api/case-lawyer-invites/:token (Task 5 on ilovelawyer-api) — public, no session needed.
 * `skipAuthRefresh` mirrors useValidateResetTokenQuery's existing convention for an
 * unauthenticated lookup: a 401 here is unexpected and must not trigger a refresh attempt. */
export function fetchCaseLawyerInvite(token: string): Promise<CaseLawyerInviteLookup> {
  return apiFetch<CaseLawyerInviteLookup>(`/api/case-lawyer-invites/${encodeURIComponent(token)}`, {
    skipAuthRefresh: true,
  })
}

/** Backs Task 12's post-auth invite banner: looks up what a `?caseInviteToken=` link points to
 * before the user signs in. Never fires without a token — there's nothing to look up, and an
 * empty-string path segment would just 404. */
export function useCaseLawyerInviteLookupQuery(token: string | undefined) {
  return useQuery({
    queryKey: ["case-lawyer-invite", token],
    queryFn: () => fetchCaseLawyerInvite(token as string),
    enabled: !!token,
    retry: false,
  })
}
