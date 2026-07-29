"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { attemptRefresh } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
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
    // Shared with lib/fetch.ts's 401-retry path so concurrent refresh attempts
    // (e.g. this effect firing alongside an in-flight authorized request) dedupe
    // onto a single request instead of racing the single-use refresh token.
    attemptRefresh()
      .then(() => setHydrating(false))
      .catch(() => {
        // attemptRefresh already clears auth and redirects to /login on failure.
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
  const { data: currentUser, isError } = useCurrentUserQuery()

  useEffect(() => {
    if (!accessToken || user || !currentUser) return
    setAuth({
      accessToken,
      user: { id: currentUser.id, username: currentUser.username, email: currentUser.email },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, user, currentUser])

  useEffect(() => {
    if (isError) {
      clearAuth()
      router.replace("/login")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError])

  if (hydrating || (accessToken && !user && !isError)) return null

  return <>{children}</>
}
