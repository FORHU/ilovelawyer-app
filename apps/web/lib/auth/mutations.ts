import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"
import { chatKeys } from "@/lib/query-keys"
import type { OrganizationWithRole } from "@/lib/organizations/queries"

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

/** Whether the just-authenticated user already belongs to an organization: "none" means
 * they still need the solo/create-org/join-org WorkspaceSetup step; "unknown" means the
 * lookup itself failed, so callers should fall through to the app and let
 * (protected)/layout.tsx re-check rather than guess. */
export type OrganizationStatus = "found" | "none" | "unknown"

/** Fetches the user's orgs right after a session is established and activates the first
 * one — signup only ever creates one, and multi-org selection isn't supported yet. Never
 * throws: a failed fetch here shouldn't block login/signup, just leaves org state empty
 * for whatever next screen/hook re-fetches it. */
async function hydrateActiveOrganization(
  setOrganization: (org: ReturnType<typeof toActiveOrg>) => void
): Promise<OrganizationStatus> {
  try {
    const orgs = await apiFetch<OrganizationWithRole[]>("/api/organizations")
    if (!orgs[0]) return "none"
    setOrganization(toActiveOrg(orgs[0]))
    return "found"
  } catch {
    // non-fatal — see doc comment above
    return "unknown"
  }
}

/** Trimmed + lowercased, matching the API's normalizeEmail — the API normalizes too, this
 * just keeps what the UI echoes back (e.g. the OTP screen) consistent with what's stored. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function toActiveOrg(org: OrganizationWithRole) {
  // Type says `tenant` is required, but that only holds if the API actually sent it — a
  // legacy org row or an out-of-order deploy (frontend ships before the backend backfills
  // Organization.tenantId) can still hand us `undefined` at runtime. Failing loudly here,
  // at the one place every org gets constructed, beats letting it reach hostForTenantCode()
  // and crash on `undefined.toLowerCase()` deep inside the domain-redirect effect.
  if (!org.tenant?.code) {
    throw new Error(`Organization ${org.id} ("${org.name}") is missing its tenant — cannot activate it.`)
  }
  return { id: org.id, name: org.name, slug: org.slug, role: org.role, packageSku: org.packageSku, tenantCode: org.tenant.code }
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

/** A `?next=` value is attacker-controllable (a crafted link), so only a same-app relative
 * path is honored — anything else (an absolute URL, a protocol-relative "//evil.example"
 * open redirect, or nothing at all) falls back to the default post-auth destination. */
export function sanitizeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/homepage"
  return raw
}

export function useLoginMutation() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, password, remember }: { email: string; password: string; remember: boolean }) =>
      apiFetch<AuthTokensResponse>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email), password, remember }),
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
      router.push(sanitizeNextPath(searchParams.get("next")))
    },
  })
}

/** Completes the one-time forced password update a 428 from useLoginMutation sends the
 * caller to (see AuthSvc.login / updateRequiredPassword on the backend) — mirrors
 * useLoginMutation's onSuccess since a successful call here *is* a completed login. */
export function useUpdateRequiredPasswordMutation() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      email,
      currentPassword,
      newPassword,
      remember,
    }: {
      email: string
      currentPassword: string
      newPassword: string
      remember: boolean
    }) =>
      apiFetch<AuthTokensResponse>("/api/auth/update-required-password", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email), currentPassword, newPassword, remember }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
      router.push(sanitizeNextPath(searchParams.get("next")))
    },
  })
}

export function useSignupMutation() {
  return useMutation({
    mutationFn: ({ name, email, password }: { name: string; email: string; password: string }) =>
      apiFetch<SignupResponse>("/api/auth/signup", {
        method: "POST",
        // acceptedTerms: callers only fire this after the Terms dialog/checkbox (see
        // unified-auth.tsx's handleSignUp) — recorded server-side as User.termsAcceptedAt.
        body: JSON.stringify({ username: generateUsername(name), name, email: normalizeEmail(email), password, acceptedTerms: true }),
        skipAuthRefresh: true,
      }),
  })
}

export function useSendOtpMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiFetch("/api/auth/send-otp", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email) }),
        skipAuthRefresh: true,
      }),
  })
}

/** "Use a different email" on the OTP screen — deletes the still-pending, unverified account
 * the abandoned signup attempt left behind, so the same email can be reused right away instead
 * of permanently colliding with a later signup. Fire-and-forget from the caller's side (see
 * unified-auth.tsx) — the UI navigates back to the sign-up form immediately either way. */
export function useCancelSignupMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiFetch("/api/auth/cancel-signup", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email) }),
        skipAuthRefresh: true,
      }),
  })
}

/** Unlike the other post-auth mutations, this deliberately does NOT redirect to
 * /homepage on success. A freshly-verified signup still needs to go through the
 * solo/create-org/join-org workspace step (see WorkspaceSetup) before landing in
 * the app, so navigation is left to the caller. */
export function useVerifyOtpMutation() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ email, code }: { email: string; code: string }) =>
      apiFetch<AuthTokensResponse>("/api/auth/verify-otp", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email), code }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
    },
  })
}

interface GoogleAuthResult extends AuthTokensResponse {
  organizationStatus: OrganizationStatus
}

/** Shared by the Google sign-in and Google link mutations: establishes the session and reports
 * whether the user still needs WorkspaceSetup. Runs inside mutationFn (not onSuccess) so the
 * caller's own onSuccess receives `organizationStatus` to route on. */
function useCompleteGoogleAuth() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return async (data: AuthTokensResponse): Promise<GoogleAuthResult> => {
    setAuth({ accessToken: data.accessToken, user: data.user })
    queryClient.invalidateQueries({ queryKey: chatKeys.session() })
    const organizationStatus = await hydrateActiveOrganization(setOrganization)
    return { ...data, organizationStatus }
  }
}

/** Like useVerifyOtpMutation, deliberately does NOT navigate on success: a Google user with no
 * organization yet (brand new, or one who abandoned onboarding) still needs the
 * solo/create-org/join-org WorkspaceSetup step, so the caller routes on `organizationStatus`.
 * `remember` is the sign-in tab's checkbox (the sign-up tab sends true, matching verify-otp).
 * `acceptedTerms` is only needed when this call would create the account — without it the API
 * answers 428 TERMS_ACCEPTANCE_REQUIRED and creates nothing. */
export function useGoogleAuthMutation() {
  const completeGoogleAuth = useCompleteGoogleAuth()

  return useMutation({
    mutationFn: async ({ idToken, remember, acceptedTerms }: { idToken: string; remember: boolean; acceptedTerms?: boolean }) =>
      completeGoogleAuth(
        await apiFetch<AuthTokensResponse>("/api/auth/google", {
          method: "POST",
          body: JSON.stringify({ idToken, remember, ...(acceptedTerms ? { acceptedTerms: true } : {}) }),
          skipAuthRefresh: true,
        })
      ),
  })
}

/** Completes the password-confirmed link a GOOGLE_LINK_REQUIRED 409 from useGoogleAuthMutation
 * sends the caller to — attaches the Google identity to the existing password account, then
 * behaves like a completed Google sign-in (same result shape, same no-navigate contract). */
export function useGoogleLinkMutation() {
  const completeGoogleAuth = useCompleteGoogleAuth()

  return useMutation({
    mutationFn: async ({ idToken, password, remember }: { idToken: string; password: string; remember: boolean }) =>
      completeGoogleAuth(
        await apiFetch<AuthTokensResponse>("/api/auth/google/link", {
          method: "POST",
          body: JSON.stringify({ idToken, password, remember }),
          skipAuthRefresh: true,
        })
      ),
  })
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: ({ email }: { email: string }) =>
      apiFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: normalizeEmail(email) }),
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

/** Consumes the one-time "Login" link from the admin-approval email — mirrors
 * useLoginMutation's onSuccess (sets auth state + hydrates the active org) since this is,
 * from the frontend's perspective, just another way of logging in. Navigation to /homepage
 * is left to the caller (the login-link page), same as useVerifyOtpMutation. */
export function useConsumeLoginLinkMutation() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ token }: { token: string }) =>
      apiFetch<AuthTokensResponse>("/api/auth/login-link/consume", {
        method: "POST",
        body: JSON.stringify({ token }),
        skipAuthRefresh: true,
      }),
    onSuccess: async (data) => {
      setAuth({ accessToken: data.accessToken, user: data.user })
      queryClient.invalidateQueries({ queryKey: chatKeys.session() })
      await hydrateActiveOrganization(setOrganization)
    },
  })
}

export function useLogoutMutation() {
  const router = useRouter()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () =>
      apiFetch("/api/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      }),
    onSettled: () => {
      clearAuth()
      // Without this, every query keyed independently of the user (e.g. userKeys.me())
      // keeps serving the just-logged-out account's cached data/error to whichever
      // account logs in next in the same tab, instead of refetching for the new session.
      queryClient.clear()
      router.push("/login")
    },
  })
}