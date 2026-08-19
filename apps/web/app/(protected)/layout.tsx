"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { refreshAccessToken } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useOrganizationsQuery } from "@/lib/organizations/queries"
import { PageTransition } from "@/components/page-transition"

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
  setAuth: (params: { accessToken: string; user: { id: string; username: string; email: string } }) => void
  clearAuth: () => void
  children: React.ReactNode
}) {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const organization = useAuthStore((s) => s.organization)
  const setOrganization = useAuthStore((s) => s.setOrganization)
  const { data: currentUser, isError, error } = useCurrentUserQuery()
  // Rehydrates the active org after a fresh tab/reload — the store has no persist
  // middleware, so `organization` resets to null even though accessToken/user come back
  // via the refresh-token flow. Without this, every resource-route call 400s with
  // "X-Organization-Id header is required" until the next login. See
  // docs/organization-feature-frontend-handoff.md §3.
  const { data: orgs } = useOrganizationsQuery({ enabled: !!accessToken && !!user && !organization })
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
      user: { id: currentUser.id, username: currentUser.username, email: currentUser.email },
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
    const org = orgs[0]
    setOrganization({ id: org.id, name: org.name, slug: org.slug, role: org.role })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, orgs])

  if (hydrating || (accessToken && !user && !isError)) return null

  return <PageTransition>{children}</PageTransition>
}
