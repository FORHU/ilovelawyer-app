"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { OnboardingShell } from "@/components/onboarding/onboarding-shell"
import { PlanPicker } from "@/components/account/plan-picker"
import { usePaymentPlansQuery } from "@/lib/account/payment-plans"

const HOME_PATH = "/homepage"

/**
 * Every plan of the lawyer's tenant, to subscribe to one: where the free trial's emails and the
 * locked banner send a solo lawyer (ilovelawyer-api's PlanTrialSvc, PLANS_PAGE_PATH), and the user
 * menu's Plans. Says how the trial stands: when it ends, or that it has and the account is read-only
 * until they choose. Once the plan is active, back into the app.
 */
export default function PlansPage() {
  const router = useRouter()
  const { t, i18n } = useTranslation("onboarding")
  const { data } = usePaymentPlansQuery()

  const trialEndsOn = data?.trialEndsAt
    ? new Date(data.trialEndsAt).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" })
    : null
  const subtitle = data?.subscribed
    ? undefined
    : data?.trialEnded
      ? t("plansPage.trialEnded")
      : trialEndsOn
        ? t("plansPage.trialEndsOn", { date: trialEndsOn })
        : undefined

  return (
    <OnboardingShell wide onBack={() => router.push(HOME_PATH)}>
      <PlanPicker onDone={() => router.push(HOME_PATH)} subtitle={subtitle} />
    </OnboardingShell>
  )
}
