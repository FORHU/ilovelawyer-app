"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ApplyStep } from "@/components/onboarding/apply-step"
import { OnboardingLoading, OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { PlanStep } from "@/components/onboarding/plan-step"
import { setupHeadingClass, setupPrimaryButtonClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles"
import { useLogoutMutation } from "@/lib/auth/mutations"
import { useClientRequestProfileQuery } from "@/lib/client-requests/profile"
import { useAuthStore } from "@/lib/store/auth.store"
import { usePlanGateQuery, useStartWithoutPayingMutation } from "@/lib/user/plan-gate"

/**
 * Verify before plan (UK, new sign-ups; ilovelawyer-api's PlanGateSvc): where the protected layout
 * sends an approved solo lawyer or firm founder until they're in. While their Lawyer Application
 * waits for the bar check they see its status: the form to send it (or send it again with the
 * admin's reason, if it was rejected), or that it's being checked — polled, so a verification or a
 * rejection shows without a reload. Once it's verified, the plan step: subscribe, or go on without
 * paying (a solo lawyer's 14-day trial starts then). Then into the app. Every step can log out, and
 * a failed lookup offers Retry rather than spinning.
 */
export default function VerificationPage() {
  const router = useRouter()
  const { t } = useTranslation("onboarding")
  const organization = useAuthStore((s) => s.organization)
  const gateQuery = usePlanGateQuery()
  const state = gateQuery.data?.state
  const profileQuery = useClientRequestProfileQuery(state === "AWAITING_VERIFICATION", { pollWhilePending: true })
  const start = useStartWithoutPayingMutation()
  const logout = useLogoutMutation()

  useEffect(() => {
    if (state === "OPEN") router.replace("/homepage")
  }, [state, router])

  const logOutButton = (
    <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} className={setupSecondaryButtonClass}>
      {t("verification.logOut")}
    </button>
  )

  // A lookup that failed with nothing to show: say so, rather than spin.
  const failed = (!state && gateQuery.isError) || (state === "AWAITING_VERIFICATION" && !profileQuery.data && profileQuery.isError)
  if (failed)
    return (
      <OnboardingShell>
        <div className="flex flex-col gap-1 text-center">
          <h1 className={setupHeadingClass}>{t("verification.loadFailedTitle")}</h1>
          <p className={setupSubtitleClass}>{t("verification.loadFailedBody")}</p>
        </div>
        <button
          type="button"
          onClick={() => void (gateQuery.isError ? gateQuery.refetch() : profileQuery.refetch())}
          disabled={gateQuery.isFetching || profileQuery.isFetching}
          className={setupPrimaryButtonClass}
        >
          {t("verification.retry")}
        </button>
        {logOutButton}
      </OnboardingShell>
    )

  if (!state || state === "OPEN") return <OnboardingLoading />

  if (state === "CHOOSE_PLAN") {
    // A solo lawyer works in their own workspace; a founder chooses for their firm.
    const solo = !organization || organization.isPersonal
    return (
      <OnboardingShell wide>
        {/* Subscribed: the gate is already open, so ask it again and the effect above moves them on.
            Skipped: the API starts the trial (or the unpaid plan) and answers OPEN. */}
        <PlanStep
          trial={solo}
          trialStartsNow
          onDone={() => void gateQuery.refetch()}
          onSkip={() => start.mutate()}
          skipping={start.isPending}
        />
        {start.isError && (
          <p className="text-center text-[13px] text-red-600" role="alert">
            {(start.error as Error).message}
          </p>
        )}
        <div className="mx-auto w-full max-w-sm">{logOutButton}</div>
      </OnboardingShell>
    )
  }

  const profile = profileQuery.data
  if (!profile) return <OnboardingLoading />
  const { status, note } = profile.verification

  // Not sent yet (closed the tab during setup), or sent back: the form, which re-sends it.
  if (status === "UNSUBMITTED" || status === "REJECTED")
    return (
      <OnboardingShell>
        {status === "REJECTED" && (
          <div className="rounded-xl border border-border px-4 py-3 text-[13px]" role="status">
            <p className="font-medium text-foreground">{t("verification.rejectedTitle")}</p>
            <p className="text-muted-foreground">{t("verification.rejectedBody")}</p>
            {note && <p className="mt-1 text-muted-foreground">{t("verification.rejectedReason", { note })}</p>}
          </div>
        )}
        <ApplyStep profile={profile} required onDone={() => void profileQuery.refetch()} />
        {logOutButton}
      </OnboardingShell>
    )

  return (
    <OnboardingShell>
      <div className="flex flex-col gap-1 text-center">
        <h1 className={setupHeadingClass}>{t("verification.pendingTitle")}</h1>
        <p className={setupSubtitleClass}>{t("verification.pendingBody")}</p>
      </div>
      {logOutButton}
    </OnboardingShell>
  )
}
