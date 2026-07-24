"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/auth.store"

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

// Pages a user shouldn't see once already signed in elsewhere (this tab, or
// logged in from another tab sharing the same refreshToken cookie).
const REDIRECT_IF_AUTHED = ["/login", "/signup"]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const shouldCheck = REDIRECT_IF_AUTHED.includes(pathname)
  const [checking, setChecking] = useState(shouldCheck)

  useEffect(() => {
    if (!shouldCheck) return

    setChecking(true)

    // A valid refreshToken cookie (set by a login in this tab or any other tab
    // on this browser) means there's already a signed-in session — silently
    // redeem it instead of asking for credentials again.
    fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) {
          setChecking(false)
          return
        }
        const data = await res.json()
        setAccessToken(data.accessToken)
        router.replace("/homepage")
      })
      .catch(() => setChecking(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  if (checking) return null

  return <>{children}</>
}
