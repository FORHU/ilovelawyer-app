"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuthStore } from "@/lib/store/auth.store"

const BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const getRefreshToken = useAuthStore((s) => s.getRefreshToken)
  const updateTokens = useAuthStore((s) => s.updateTokens)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [hydrating, setHydrating] = useState(true)

  useEffect(() => {
    if (accessToken) {
      setHydrating(false)
      return
    }

    const refreshToken = getRefreshToken()

    if (!refreshToken) {
      router.replace("/login")
      return
    }

    fetch(`${BASE_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Refresh failed")
        return res.json()
      })
      .then((data) => {
        updateTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
        setHydrating(false)
      })
      .catch(() => {
        clearAuth()
        router.replace("/login")
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (hydrating) return null

  return <>{children}</>
}
