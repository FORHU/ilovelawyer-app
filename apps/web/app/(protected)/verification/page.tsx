"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { ApplyStep } from "@/components/onboarding/apply-step"
import { OnboardingLoading, OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { PlanStep } from "@/components/onboarding/plan-step"
import { setupHeadingClass, setupSecondaryButtonClass, setupSubtitleClass } from "@/components/onboarding/styles"
import { useLogoutMutation } from "@/lib/auth/mutations"
import { useClientRequestProfileQuery } from "@/lib/client-requests/profile"
import { useAuthStore } from "@/lib/store/auth.store"
import { usePlanGateQuery, useStartWithoutPayingMutation } from "@/lib/user/plan-gate"

/**
 * Verify before plan (UK, new sign-ups; ilovelawyer-api's PlanGateSvc): where the protected layout
 * sends an approved solo lawyer or firm founder until they're in. While their Lawyer Application
 * waits for the bar check they see its status: the form to send it (or send it again with the
 * admin's reason, if it was rejected), or that it's being checked. Once it's verified, the plan step:
 * subscribe, or go on without paying (a solo lawyer's 14-day trial starts then). Then into the app.
 */
export default function VerificationPage() {
  const router = useRouter()
  const { t } = useTranslation("onboarding")
  const organization = useAuthStore((s) => s.organization)
  const gateQuery = usePlanGateQuery()
  const state = gateQuery.data?.state
  const profileQuery = useClientRequestProfileQuery(state === "AWAITING_VERIFICATION")
  const start = useStartWithoutPayingMutation()
  const logout = useLogoutMutation()

  useEffect(() => {
    if (state === "OPEN") router.replace("/homepage")
  }, [state, router])

  if (!state || state === "OPEN") return <OnboardingLoading />

  if (state === "CHOOSE_PLAN") {
    // A solo lawyer works in their own workspace; a founder chooses for their firm.
    const solo = !organization || organization.isPersonal
    return (
      <OnboardingShell wide>
        {/* Subscribing, or "Start my free trial" / "Skip for now": either way the API settles the
            gate (after a subscription it's already open), and the effect above moves them on. */}
        <PlanStep trial={solo} trialStartsNow onDone={() => start.mutate()} />
        {start.isError && (
          <p className="text-center text-[13px] text-red-600" role="alert">
            {(start.error as Error).message}
          </p>
        )}
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
      </OnboardingShell>
    )

  return (
    <OnboardingShell>
      <div className="flex flex-col gap-1 text-center">
        <h1 className={setupHeadingClass}>{t("verification.pendingTitle")}</h1>
        <p className={setupSubtitleClass}>{t("verification.pendingBody")}</p>
      </div>
      <button type="button" onClick={() => logout.mutate()} className={setupSecondaryButtonClass}>
        {t("verification.logOut")}
      </button>
    </OnboardingShell>
  )
}
