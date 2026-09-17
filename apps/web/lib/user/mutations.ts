import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { organizationKeys, userKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"
import type { OrganizationMemberRecord } from "@/lib/organizations/queries"

// Mirrors ACCOUNT_DELETION_GRACE_PERIOD_DAYS on the API — the account is only ever actually
// hard-deleted server-side, this is just for showing the scheduled date before a refetch.
export const ACCOUNT_DELETION_GRACE_PERIOD_DAYS = 30

export interface CurrentUser {
  id: string
  username: string
  email: string
  name: string | null
  approvalStatus: "PENDING" | "ACTIVE" | "DENIED" | "BLOCKED"
  denialReason: string | null
  createdAt: string
  lastLoginAt: string | null
  deletionRequestedAt: string | null
  hasPassword: boolean
}

/** Fetches the signed-in user's full profile — login/refresh only return tokens, not user data. */
export function useCurrentUserQuery() {
  const accessToken = useAuthStore((s) => s.accessToken)

  return useQuery({
    queryKey: userKeys.me(),
    queryFn: () => apiFetch<CurrentUser>("/api/users/me"),
    enabled: !!accessToken,
  })
}

export function useUpdateCurrentUserMutation() {
  const queryClient = useQueryClient()
  const updateStoreUser = useAuthStore((s) => s.updateUser)

  return useMutation({
    mutationFn: (data: { name?: string; username?: string }) =>
      apiFetch<CurrentUser>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(userKeys.me(), updated)
      // The profile page reads from the query cache above and updates on its own, but
      // the header's account menu reads the auth store's own copy of the user — without
      // this it keeps showing the pre-edit name/username until the next full login.
      updateStoreUser({ username: updated.username, name: updated.name })
      // Org member lists embed a snapshot of `user` from whenever they were last fetched
      // (e.g. the Organization page's Members list), so they'd otherwise keep showing the
      // pre-edit name/username until that list happens to refetch. Patch every cached
      // members list in place — cheap, and instant instead of waiting on a refetch.
      queryClient.setQueriesData<OrganizationMemberRecord[]>(
        { queryKey: organizationKeys.all, predicate: (query) => query.queryKey.at(-1) === "members" },
        (members) =>
          members?.map((m) =>
            m.userId === updated.id ? { ...m, user: { ...m.user, name: updated.name, username: updated.username } } : m,
          ),
      )
    },
  })
}

export function useChangePasswordMutation() {
  return useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      apiFetch<{ message: string }>("/api/users/me/change-password", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  })
}

/** Requests account deletion — this starts the grace period rather than deleting immediately,
 * so the session stays valid and the request can still be cancelled (useCancelDeletionMutation)
 * up until the API's AccountDeletionQueue performs the actual hard delete. */
export function useDeleteAccountMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiFetch<CurrentUser>("/api/users/me", { method: "DELETE" }),
    onSuccess: (updated) => queryClient.setQueryData(userKeys.me(), updated),
  })
}

export function useCancelDeletionMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => apiFetch<CurrentUser>("/api/users/me/cancel-deletion", { method: "POST" }),
    onSuccess: (updated) => queryClient.setQueryData(userKeys.me(), updated),
  })
}
