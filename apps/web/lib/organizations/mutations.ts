import { useCallback } from "react"
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { authKeys, caseKeys, organizationKeys, sharedCaseKeys, tourKeys, userKeys } from "@/lib/query-keys"
import { useAuthStore, type SharedWorkspace, type Workspace } from "@/lib/store/auth.store"
import type { OrganizationRecord, OrganizationMemberRecord, OrganizationRole } from "./queries"

/** Query roots that belong to the signed-in account rather than its organization. */
// The shared-with-me list too: it spans other people's portfolios, whichever workspace is open.
const USER_SCOPED_ROOTS = new Set<unknown>([userKeys.all[0], authKeys.all[0], tourKeys.all[0], sharedCaseKeys.all[0]])

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
    (workspace: Exclude<Workspace, "shared">) => {
      if (useAuthStore.getState().workspace === workspace) return
      setWorkspace(workspace)
      removeOrganizationScopedQueries(queryClient)
    },
    [queryClient, setWorkspace],
  )
}

/** Opens someone else's portfolio to read a case they shared with this user. Same reset as
 * switching workspace: nothing fetched for the user's own workspace may show in theirs. */
export function useEnterSharedWorkspace() {
  const queryClient = useQueryClient()
  const enterSharedWorkspace = useAuthStore((s) => s.enterSharedWorkspace)
  return useCallback(
    (shared: SharedWorkspace) => {
      const state = useAuthStore.getState()
      if (state.workspace === "shared" && state.shared?.id === shared.id) return
      enterSharedWorkspace(shared)
      removeOrganizationScopedQueries(queryClient)
    },
    [queryClient, enterSharedWorkspace],
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

/** The API's answer to accepting an invite whose organization is being deleted (its last member
 * left): the invite is gone, so there's nothing left to accept or decline. */
export function isInviteNoLongerValidError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === 410
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
    // The API used the invite up, so the invite card would otherwise linger.
    onError: (err) => {
      if (isInviteNoLongerValidError(err)) queryClient.invalidateQueries({ queryKey: organizationKeys.myInvite() })
    },
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
