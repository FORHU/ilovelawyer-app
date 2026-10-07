import { useCallback } from "react"
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { authKeys, caseKeys, organizationKeys, tourKeys, userKeys } from "@/lib/query-keys"
import { useAuthStore, type Workspace } from "@/lib/store/auth.store"
import type { OrganizationRecord, OrganizationMemberRecord, OrganizationRole } from "./queries"

/** Query roots that belong to the signed-in account rather than its organization. */
const USER_SCOPED_ROOTS = new Set<unknown>([userKeys.all[0], authKeys.all[0], tourKeys.all[0]])

/** For when the user changes organization (leaving one, or accepting an invite that moves them).
 * Removed, not invalidated: everything cached apart from the account itself was fetched as a
 * member of the old org (cases, consultations, members...) and would otherwise keep showing for
 * up to the 5-minute staleTime. That includes the org list, which the protected layout would
 * read straight back and re-activate the old org from. */
function removeOrganizationScopedQueries(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (query) => !USER_SCOPED_ROOTS.has(query.queryKey[0]) })
}

/** Switches between the organization and the portfolio. Query keys aren't per workspace, so
 * everything fetched for the other one is dropped first and refetched for this one. */
export function useSwitchWorkspace() {
  const queryClient = useQueryClient()
  const setWorkspace = useAuthStore((s) => s.setWorkspace)
  return useCallback(
    (workspace: Workspace) => {
      if (useAuthStore.getState().workspace === workspace) return
      setWorkspace(workspace)
      removeOrganizationScopedQueries(queryClient)
    },
    [queryClient, setWorkspace],
  )
}

export interface CreateOrganizationPayload {
  name: string
  packageSku?: string
  /** Onboarding's "Skip for now" — a private workspace, not an organization. */
  personal?: boolean
}

export function useCreateOrganizationMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOrganizationPayload) =>
      apiFetch<OrganizationRecord>("/api/organizations", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export interface UpdateOrganizationPayload {
  name?: string
  slug?: string
}

export function useUpdateOrganizationMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateOrganizationPayload) =>
      apiFetch<OrganizationRecord>(`/api/organizations/${organizationId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.detail(organizationId) })
      queryClient.invalidateQueries({ queryKey: organizationKeys.lists() })
    },
  })
}

export interface InviteMemberPayload {
  email: string
  role?: OrganizationRole
}

export function useInviteMemberMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: InviteMemberPayload) =>
      apiFetch<OrganizationMemberRecord>(`/api/organizations/${organizationId}/members`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) })
    },
  })
}

export function useChangeMemberRoleMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrganizationRole }) =>
      apiFetch<OrganizationMemberRecord>(`/api/organizations/${organizationId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) })
    },
  })
}

export function useRemoveMemberMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<void>(`/api/organizations/${organizationId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members(organizationId) })
      // Their cases now show as created by a former member.
      queryClient.invalidateQueries({ queryKey: caseKeys.lists() })
    },
  })
}

export function useAcceptInviteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: string) =>
      apiFetch<OrganizationMemberRecord>(`/api/organizations/invites/${organizationId}/accept`, {
        method: "POST",
      }),
    // Accepting can move the user out of the org they were in.
    onSuccess: () => removeOrganizationScopedQueries(queryClient),
  })
}

export function useDeclineInviteMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: string) =>
      apiFetch<void>(`/api/organizations/invites/${organizationId}/decline`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.myInvite() })
    },
  })
}

export function useLeaveOrganizationMutation(organizationId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<void>(`/api/organizations/${organizationId}/members/me`, { method: "DELETE" }),
    onSuccess: () => removeOrganizationScopedQueries(queryClient),
  })
}
