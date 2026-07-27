import { useMutation, useQuery } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"

interface AuthTokensResponse {
  user: AuthUser
  accessToken: string
}

interface SignupResponse {
  id: string
  username: string
  email: string
  name: string | null
}

interface ResetPasswordResponse {
  accessToken: string
}

// Mirrors the numeric-suffix convention the backend already uses for Google
// signups (auth.repository.ts's createGoogleUser), instead of a random base36
// string, so a generated username reads as "name.1234" rather than "name.zuo".
function generateUsername(fullName: string): string {
  const base =
    fullName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s.]/g, "")
      .replace(/\s+/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "") || "user"
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${base}.${suffix}`
}

export function useLoginMutation() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)

  return useMutation({
    mutationFn: ({ email, password, remember }: { email: string; password: string; remember: boolean }) =>
      apiFetch<AuthTokensResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember }),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      router.push("/homepage")
    },
  })
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      apiFetch<SignupResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username: generateUsername(name), name, email, password }),
        skipAuthRefresh: true,
      }),
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
      setAuth({ accessToken: data.accessToken, user: data.user })
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
  const setAccessToken = useAuthStore((s) => s.setAccessToken)

  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      apiFetch<ResetPasswordResponse>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
        skipAuthRefresh: true,
      }),
    onSuccess: (data) => {
      setAccessToken(data.accessToken)
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)

  return useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      }),
    onSettled: () => {
      clearAuth()
      router.push("/login")
    },
  })
}
