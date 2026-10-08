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
  /** What the caller may do on this case, from the API's own rule (includes per-case grants). */
  canEdit: boolean
  canManage: boolean
  people: CaseAccessPerson[]
}

/** What the sharing panel shows per person.
 * - `org-admin`: OWNER/ADMIN of the organization — full access through their role, not a grant,
 *   so there's nothing to change or revoke here.
 * - Otherwise the level comes from their grant. No grant (or a VIEW grant) is "view": every
 *   accepted member can read the firm's cases today. `granted` tells an explicit grant apart from
 *   access the organization gives, so revoking one doesn't look like it did nothing. */
export type AccessLevel = "view" | "edit" | "manage"

export function accessOf(person: Pick<CaseAccessPerson, "orgRole" | "grant">): {
  source: "org-admin" | "grant" | "organization"
  level: AccessLevel
  granted: boolean
} {
  if (person.orgRole === "OWNER" || person.orgRole === "ADMIN") return { source: "org-admin", level: "manage", granted: false }
  const level: AccessLevel = person.grant === "ADMIN" ? "manage" : person.grant === "EDIT" ? "edit" : "view"
  return { source: person.grant ? "grant" : "organization", level, granted: !!person.grant }
}

export const LEVEL_TO_PERMISSION: Record<Exclude<AccessLevel, "view">, CasePermission> = { edit: "EDIT", manage: "ADMIN" }

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
