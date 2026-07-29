import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiFetch, apiFetchRaw } from "@/lib/fetch"
import { userKeys } from "@/lib/query-keys"
import { useAuthStore } from "@/lib/store/auth.store"

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

  return useMutation({
    mutationFn: (data: { name?: string; username?: string }) =>
      apiFetch<CurrentUser>("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(userKeys.me(), updated)
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
