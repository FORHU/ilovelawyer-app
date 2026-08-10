"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { refreshAccessToken } from "@/lib/fetch"
import { PageTransition } from "@/components/page-transition"

// Pages a user shouldn't see once already signed in elsewhere (this tab, or
// logged in from another tab sharing the same refreshToken cookie).
const REDIRECT_IF_AUTHED = ["/login", "/signup"]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
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
    refreshAccessToken()
      .then(() => router.replace("/homepage"))
      .catch(() => setChecking(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (checking) return null

  return <PageTransition>{children}</PageTransition>
}
