import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { caseKeys } from "@/lib/query-keys"
import { terminalKeys } from "@/lib/terminal/mutations"
import type { OrganizationRole } from "@/lib/organizations/queries"

export type CasePermission = "VIEW" | "EDIT" | "ADMIN"

/** One person who can reach a case — see ilovelawyer-api's OrganizationSvc.listAccess. */
export interface CaseAccessPerson {
  userId: string
  name: string | null
  email: string
  username: string
  avatarUrl: string | null
  /** Null for someone holding a grant who's no longer in the case's organization. */
  orgRole: OrganizationRole | null
  grant: CasePermission | null
}

export interface CaseAccessList {
  /** A confidential case (#346): only the org OWNER and people with a grant can reach it. */
  confidential: boolean
  /** What the caller may do on this case, from the API's own rule (includes per-case grants). */
  canEdit: boolean
  canManage: boolean
  people: CaseAccessPerson[]
}

/** What the sharing panel shows per person.
 * - `org-admin`: access through their org role, not a grant, so there's nothing here to change or
 *   revoke — the OWNER always, and an ADMIN unless the case is confidential.
 * - `grant`: their level comes from a grant on this case.
 * - `organization`: an ordinary case's view access, which every accepted member has.
 * - `walled`: a confidential case they have no grant on, so no access at all.
 * `granted` tells an explicit grant apart from the rest, so revoking one doesn't look like it did
 * nothing. */
export type AccessLevel = "none" | "view" | "edit" | "manage"
export type AccessSource = "org-admin" | "grant" | "organization" | "walled"

const GRANT_LEVEL: Record<CasePermission, AccessLevel> = { VIEW: "view", EDIT: "edit", ADMIN: "manage" }

export function accessOf(
  person: Pick<CaseAccessPerson, "orgRole" | "grant">,
  confidential = false,
): { source: AccessSource; level: AccessLevel; granted: boolean } {
  const byRole = person.orgRole === "OWNER" || (person.orgRole === "ADMIN" && !confidential)
  if (byRole) return { source: "org-admin", level: "manage", granted: false }
  if (person.grant) return { source: "grant", level: GRANT_LEVEL[person.grant], granted: true }
  return confidential ? { source: "walled", level: "none", granted: false } : { source: "organization", level: "view", granted: false }
}

/** The grant behind each level a manager can pick. "none" (and, on an ordinary case, "view" —
 * everyone in the organization already has it) means no grant at all. */
export function permissionFor(level: AccessLevel, confidential: boolean): CasePermission | null {
  if (level === "manage") return "ADMIN"
  if (level === "edit") return "EDIT"
  if (level === "view" && confidential) return "VIEW"
  return null
}

export function useCaseAccessQuery(caseId: string | undefined) {
  return useQuery({
    queryKey: caseKeys.access(caseId ?? ""),
    queryFn: () => apiFetch<CaseAccessList>(`/api/my-cases/${caseId}/access`),
    enabled: !!caseId,
  })
}

function useInvalidateAccess() {
  const queryClient = useQueryClient()
  return (caseId: string) => {
    queryClient.invalidateQueries({ queryKey: caseKeys.access(caseId) })
    // The Terminal's team/audit view reads grants off the snapshot.
    queryClient.invalidateQueries({ queryKey: terminalKeys.snapshot(caseId) })
  }
}

export function useGrantCaseAccessMutation() {
  const invalidate = useInvalidateAccess()
  return useMutation({
    mutationFn: ({ caseId, userId, permission }: { caseId: string; userId: string; permission: CasePermission }) =>
      apiFetch(`/api/my-cases/${caseId}/access`, { method: "POST", body: JSON.stringify({ userId, permission }) }),
    onSuccess: (_data, { caseId }) => invalidate(caseId),
  })
}

export function useRevokeCaseAccessMutation() {
  const invalidate = useInvalidateAccess()
  return useMutation({
    mutationFn: async ({ caseId, userId }: { caseId: string; userId: string }) => {
      // 204 No Content — apiFetch would try to parse it as JSON.
      await apiFetchRaw(`/api/my-cases/${caseId}/access/${userId}`, { method: "DELETE" })
    },
    onSuccess: (_data, { caseId }) => invalidate(caseId),
  })
}

export function useSetConfidentialMutation() {
  const queryClient = useQueryClient()
  const invalidate = useInvalidateAccess()
  return useMutation({
    mutationFn: ({ caseId, confidential }: { caseId: string; confidential: boolean }) =>
      apiFetch<{ confidential: boolean }>(`/api/my-cases/${caseId}/confidential`, {
        method: "PATCH",
        body: JSON.stringify({ confidential }),
      }),
    onSuccess: (_data, { caseId }) => {
      invalidate(caseId)
      // The badge on the case page and the lock in the case list.
      queryClient.invalidateQueries({ queryKey: caseKeys.detail(caseId) })
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}
