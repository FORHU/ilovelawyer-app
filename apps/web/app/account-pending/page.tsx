"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

import { refreshAccessToken } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useLogoutMutation } from "@/lib/auth/mutations"
import { LoadingScreen } from "@/components/loading-screen"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { setupHeadingClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles"

// Standalone route (not under (protected)) — needs a session to know the viewer's own
// approvalStatus, but deliberately skips (protected)/layout.tsx's org-membership/invite
// machinery, which a PENDING/DENIED/BLOCKED user has no business triggering. For a pending lawyer
// it's the last step of account setup: they finish /onboarding first, then wait here, in the same
// layout as the steps before it.
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

  const unfinishedSetup = currentUser?.approvalStatus === "PENDING" && !currentUser.setupCompletedAt && !currentUser.trialExpiresAt

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
    // Approval comes after setup: a pending lawyer who hasn't finished it does that first.
    else if (unfinishedSetup) router.replace("/onboarding")
  }, [currentUser, router, unfinishedSetup])

  if (hydrating || isLoading || !currentUser || currentUser.approvalStatus === "ACTIVE" || unfinishedSetup) return <LoadingScreen />

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
            body: "You're all set up. An admin needs to approve your account before you can access ilovelawyer. We'll email you as soon as it's reviewed.",
          }

  return (
    <OnboardingShell>
      <div className="flex flex-col gap-1">
        <h1 className={setupHeadingClass}>{copy.heading}</h1>
        <p className={setupSubtitleClass}>{copy.body}</p>
      </div>
      <button type="button" onClick={() => logoutMutation.mutate()} className={setupSecondaryButtonClass}>
        Log out
      </button>
    </OnboardingShell>
  )
}
