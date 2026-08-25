"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { refreshAccessToken } from "@/lib/fetch"
import { useAuthStore, type AuthUser } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useOrganizationsQuery, useMyInviteQuery } from "@/lib/organizations/queries"
import { toActiveOrg } from "@/lib/auth/mutations"
import { PageTransition } from "@/components/page-transition"
import { useJurisdictionHint } from "@/components/jurisdiction-provider"
import { hostForJurisdiction } from "@/lib/jurisdiction/resolve-host"

const ORGANIZATION_PATH = "/homepage/organization"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [hydrating, setHydrating] = useState(() => !accessToken)

  useEffect(() => {
    if (accessToken) {
      return
    }

    // No in-memory access token (fresh tab or reload) — the refresh token only
    // lives in the httpOnly cookie, so ask the server to mint a new access token.
    // Goes through the shared single-flight refreshAccessToken (not a raw fetch)
    // so this can't race the auth layout's own refresh call and burn the
    // one-time refresh cookie, which would spuriously 401 whichever call loses.
    refreshAccessToken()
      .then(() => setHydrating(false))
      .catch(() => {
        clearAuth()
        router.replace("/login")
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <CurrentUserSync hydrating={hydrating} setAuth={setAuth} clearAuth={clearAuth}>{children}</CurrentUserSync>
}

function CurrentUserSync({
  hydrating,
  setAuth,
  clearAuth,
  children,
}: {
  hydrating: boolean
  setAuth: (params: { accessToken: string; user: AuthUser }) => void
  clearAuth: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.organization)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const hostJurisdiction = useJurisdictionHint()
  const { data: currentUser, isError, error } = useCurrentUserQuery()
  // Rehydrates the active org after a fresh tab/reload — the store has no persist
  // middleware, so `organization` resets to null even though accessToken/user come back
  // via the refresh-token flow. Without this, every resource-route call 400s with
  // "X-Organization-Id header is required" until the next login. See
  // docs/organization-feature-frontend-handoff.md §3.
  const { data: orgs } = useOrganizationsQuery({ enabled: !!accessToken && !!user && !organization })
  // A user with no active org but a pending invite has nothing else to do in the app —
  // the accept/decline UI lives on the Organization page, so route them there directly
  // instead of leaving them stranded wherever they landed post-login.
  const { data: pendingInvite } = useMyInviteQuery({ enabled: !!accessToken && !!user && !organization })
  // A missing/expired token is a real 401/403 from the API. Anything else (a
  // dropped connection, a CORS misconfiguration, a 500) is transient and
  // shouldn't sign the user out — apiFetch already throws with `.status` unset
  // for those, since the underlying fetch() rejects before an HTTP response
  // ever comes back to inspect.
  const isAuthError = isError && ((error as { status?: number })?.status === 401 || (error as { status?: number })?.status === 403)

  useEffect(() => {
    if (!accessToken || user || !currentUser) return
    setAuth({
      accessToken,
      user: { id: currentUser.id, username: currentUser.username, email: currentUser.email, name: currentUser.name },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user, currentUser])

  useEffect(() => {
    if (isAuthError) {
      clearAuth()
      router.replace("/login")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthError])

  useEffect(() => {
    if (organization || !orgs?.[0]) return
    setOrganization(toActiveOrg(orgs[0]))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, orgs])

  useEffect(() => {
    if (organization || !pendingInvite || pathname === ORGANIZATION_PATH) return
    router.replace(ORGANIZATION_PATH)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, pendingInvite, pathname])

  // Domain/tenant mismatch: the organization's persisted jurisdiction is authoritative and
  // never changes because of which subdomain the browser happens to be on — if they disagree
  // (including an unresolved/apex host), redirect to the organization's correct subdomain
  // rather than silently rendering under the wrong one. This is a UX redirect only; it does
  // not and cannot change which jurisdiction's legal engine/prompts the backend uses for this
  // organization — that's resolved server-side from Organization.jurisdiction regardless of
  // hostname.
  useEffect(() => {
    if (!organization || typeof window === "undefined") return
    if (hostJurisdiction === organization.jurisdiction) return
    const targetHost = hostForJurisdiction(organization.jurisdiction, window.location.host)
    if (targetHost === window.location.host) return
    window.location.href = `${window.location.protocol}//${targetHost}${window.location.pathname}${window.location.search}`
  }, [organization, hostJurisdiction])

  if (hydrating || (accessToken && !user && !isError)) return null

  return <PageTransition>{children}</PageTransition>
}
