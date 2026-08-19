import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"
import { chatKeys } from "@/lib/query-keys"
import type { OrganizationRole, OrganizationWithRole } from "@/lib/organizations/queries"

interface AuthTokensResponse {
  user: AuthUser
  accessToken: string
}

interface SignupResponse {
  id: string
  username: string
  email: string
  name: string | null
  organization: { id: string; name: string; slug: string }
  organizationMemberId: string
  role: OrganizationRole
}

/** Fetches the user's orgs right after a session is established and activates the first
 * one — signup only ever creates one, and multi-org selection isn't supported yet. Never
 * throws: a failed fetch here shouldn't block login/signup, just leaves org state empty
 * for whatever next screen/hook re-fetches it. */
async function hydrateActiveOrganization(setOrganization: (org: ReturnType<typeof toActiveOrg>) => void) {
  try {
    const orgs = await apiFetch<OrganizationWithRole[]>("/api/organizations")
    if (orgs[0]) setOrganization(toActiveOrg(orgs[0]))
  } catch {
    // non-fatal — see doc comment above
  }
}

function toActiveOrg(org: OrganizationWithRole) {
  return { id: org.id, name: org.name, slug: org.slug, role: org.role }
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
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password, remember }: { email: string; password: string; remember: boolean }) =>
      apiFetch<AuthTokensResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, remember }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      // Chat Wonder session_id is cached with staleTime: Infinity (see useChatSessionQuery)
      // and survives client-side login/logout since it's just an SPA route change, not a
      // page reload — without this, a stale pre-login session_id keeps getting reused
      // until the tab is refreshed, even though the user just "freshly" logged in.
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
      router.push("/homepage")
    },
  })
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: ({ name, email, password, orgName }: { name: string; email: string; password: string; orgName: string }) =>
      apiFetch<SignupResponse>("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username: generateUsername(name), name, email, password, orgName }),
        skipAuthRefresh: true,
      }),
  })
}

export function useSendOtpMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
        skipAuthRefresh: true,
      }),
  })
}

export function useVerifyOtpMutation() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      apiFetch<AuthTokensResponse>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email, code }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
      router.push("/homepage")
    },
  })
}

export function useGoogleAuthMutation() {
  const router = useRouter()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ idToken }: { idToken: string }) =>
      apiFetch<AuthTokensResponse>("/api/auth/google", {
        method: "POST",
        body: JSON.stringify({ idToken }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
      router.push("/homepage")
    },
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      // resetLink is only ever populated in dev (see auth.service.ts) — a convenience so the
      // reset link can be surfaced locally without checking the Ethereal test inbox.
      apiFetch<{ message: string; resetLink?: string }>("/api/auth/forgot-password", {
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