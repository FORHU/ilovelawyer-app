"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [hydrating, setHydrating] = useState(() => !accessToken)

  useEffect(() => {
    if (accessToken) {
      return
    }

    // No in-memory access token (fresh tab or reload) — the refresh token only
    // lives in the httpOnly cookie, so ask the server to mint a new access token.
    fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Refresh failed")
        return res.json()
      })
      .then((data) => {
        setAccessToken(data.accessToken)
        setHydrating(false)
      })
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
