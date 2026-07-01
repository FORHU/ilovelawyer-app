import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"

interface AuthTokensResponse {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

interface SignupResponse {
  id: string
  username: string
  email: string
}

interface ResetPasswordResponse {
  accessToken: string
  refreshToken: string
}

function generateUsername(fullName: string): string {
  const base = fullName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9.]/g, "")
  const suffix = Math.random().toString(36).slice(2, 5)
  return `${base}.${suffix}`
}

export function useLoginMutation() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string; remember: boolean }) =>
      apiFetch<AuthTokensResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        skipAuthRefresh: true,
      }),
    onSuccess: (data, { remember }) => {
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, remember })
      router.push("/homepage")
    },
  })
}

export function useSignupMutation() {
  const router = useRouter()

  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      apiFetch<SignupResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username: generateUsername(name), name, email, password }),
        skipAuthRefresh: true,
      }),
    onSuccess: () => {
      router.push("/login?signup=success")
    },
  })
}

export function useGoogleAuthMutation() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: ({ idToken }: { idToken: string }) =>
      apiFetch<AuthTokensResponse>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user, remember: true })
      router.push("/homepage")
    },
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiFetch("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuthRefresh: true,
      }),
  })
}

export function useValidateResetTokenQuery(token: string) {
  return useQuery({
    queryKey: ["reset-password-validate", token],
    queryFn: () =>
      apiFetch<{ valid: boolean }>(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`, {
        skipAuthRefresh: true,
      }),
    enabled: !!token,
    retry: false,
    staleTime: 0,
  })
}

export function useResetPasswordMutation() {
  const updateTokens = useAuthStore((s) => s.updateTokens)

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      apiFetch<ResetPasswordResponse>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      updateTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const getRefreshToken = useAuthStore((s) => s.getRefreshToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) return Promise.resolve(null)
      return apiFetch("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
        skipAuthRefresh: true,
      })
    },
    onSettled: () => {
      clearAuth()
      router.push("/login")
    },
  })
}
