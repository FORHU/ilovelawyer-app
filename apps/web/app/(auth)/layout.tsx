"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { apiFetch, refreshAccessToken } from "@/lib/fetch"
import { normalizeEmail, sanitizeNextPath } from "@/lib/auth/mutations"
import { useAuthStore } from "@/lib/store/auth.store"
import { PageTransition } from "@/components/page-transition"

// Pages a user shouldn't see once already signed in elsewhere (this tab, or
// logged in from another tab sharing the same refreshToken cookie).
const REDIRECT_IF_AUTHED = ["/login", "/signup"]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const shouldCheck = REDIRECT_IF_AUTHED.includes(pathname)
  const [checking, setChecking] = useState(shouldCheck)

  useEffect(() => {
    if (!shouldCheck) return

    setChecking(true)

    // A valid refreshToken cookie (set by a login in this tab or any other tab
    // on this browser) means there's already a signed-in session — silently
    // redeem it instead of asking for credentials again. Goes through the
    // shared single-flight refreshAccessToken (not a raw fetch) so this can't
    // race the protected layout's own refresh call and burn the one-time cookie.
    const params = new URLSearchParams(window.location.search)
    refreshAccessToken()
      .then(async () => {
        // An org-invite sign-up link (?email=) is meant for that address. Opened in a browser
        // where someone else is signed in (often the inviter), show the form instead of
        // carrying on as them — signing up then replaces that session.
        const invitedEmail = params.get("email")
        if (invitedEmail) {
          const me = await apiFetch<{ email: string }>("/api/users/me")
          if (normalizeEmail(me.email) !== normalizeEmail(invitedEmail)) {
            clearAuth()
            setChecking(false)
            return
          }
        }
        router.replace(sanitizeNextPath(params.get("next")))
      })
      .catch(() => setChecking(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (checking) return null

  return <PageTransition>{children}</PageTransition>
}
