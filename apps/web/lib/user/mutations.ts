import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { organizationKeys, userKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"
import type { OrganizationMemberRecord } from "@/lib/organizations/queries"

export interface CurrentUser {
  id: string
  username: string
  email: string
  name: string | null
  createdAt: string
  lastLoginAt: string | null
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

export function useDeleteAccountMutation() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: async () => {
      await apiFetchRaw("/api/users/me", { method: "DELETE" })
    },
    onSuccess: () => {
      clearAuth()
      router.push("/login")
    },
  })
}
