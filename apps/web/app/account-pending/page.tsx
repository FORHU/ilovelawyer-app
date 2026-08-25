"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { refreshAccessToken } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useLogoutMutation } from "@/lib/auth/mutations"
import { LoadingScreen } from "@/components/loading-screen"

// Standalone route (not under (protected)) — needs a session to know the viewer's own
// approvalStatus, but deliberately skips (protected)/layout.tsx's org-membership/invite
// machinery, which a PENDING/DENIED/BLOCKED user has no business triggering.
export default function AccountPendingPage() {
  const router = useRouter()
  const accessToken = useAuthStore((s) => s.accessToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [hydrating, setHydrating] = useState(() => !accessToken)
  const logoutMutation = useLogoutMutation()

  useEffect(() => {
    if (accessToken) {
      setHydrating(false)
      return
    }
    refreshAccessToken()
      .then(() => setHydrating(false))
      .catch(() => {
        clearAuth()
        router.replace("/login")
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const { data: currentUser, isLoading, isError, error } = useCurrentUserQuery()

  const isAuthError =
    isError && ((error as Error & { status?: number }).status === 401 || (error as Error & { status?: number }).status === 403)

  useEffect(() => {
    if (isAuthError) {
      clearAuth()
      router.replace("/login")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthError])

  useEffect(() => {
    // Already active (e.g. they logged back in after being approved/reactivated/
    // unblocked) — nothing to wait for, send them into the real app instead of
    // stranding them here.
    if (currentUser?.approvalStatus === "ACTIVE") router.replace("/homepage")
  }, [currentUser, router])

  if (hydrating || isLoading || !currentUser || currentUser.approvalStatus === "ACTIVE") return <LoadingScreen />

  const { approvalStatus, denialReason } = currentUser

  const copy =
    approvalStatus === "DENIED"
      ? {
          heading: "Your signup wasn't approved",
          body: denialReason ? `Reason: ${denialReason}` : "If you believe this was a mistake, please contact support.",
        }
      : approvalStatus === "BLOCKED"
        ? {
            heading: "Your account has been blocked",
            body: "If you believe this was a mistake, please contact support.",
          }
        : {
            heading: "Your account is pending approval",
            body: "An admin needs to approve your account before you can access ilovelawyer. We'll email you as soon as it's reviewed.",
          }

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-black">
      <div className="w-full max-w-md text-center">
        <h1
          className="text-[32px] text-foreground leading-10"
          style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
        >
          {copy.heading}
        </h1>
        <p className="text-muted-foreground mt-4 text-base leading-6.5" style={{ fontFamily: "Inter, sans-serif" }}>
          {copy.body}
        </p>
        <button
          type="button"
          onClick={() => logoutMutation.mutate()}
          className="text-muted-foreground hover:text-foreground mt-8 text-xs tracking-[1.2px] uppercase underline"
          style={{ fontFamily: "Inter, sans-serif" }}
        >
          Log out
        </button>
      </div>
    </div>
  )
}
