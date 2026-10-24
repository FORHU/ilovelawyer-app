"use client"

import { useTranslation } from "react-i18next"
import { PageHeading } from "@workspace/ui/components/page-heading"
import { PageShell } from "@/components/page-shell"
import { PlanPicker } from "@/components/account/plan-picker"
import { usePaymentPlansQuery } from "@/lib/account/payment-plans"
import { CONTENT_WIDTH_MD } from "@/lib/layout-constants"

/**
 * Every plan of the lawyer's tenant, under the app header: where the free trial's emails and the
 * locked banner send a solo lawyer (ilovelawyer-api's PlanTrialSvc, PLANS_PAGE_PATH), and the user
 * menu's Plans. The heading says where they stand: on a plan (and when it renews, or moves to a
 * cheaper one), on a trial (and when it ends), or with the trial over and the account read-only.
 * Subscribing opens Stripe's checkout in place; a lawyer who already pays upgrades now or downgrades
 * at renewal (PlanPicker's page variant).
 */
export default function PlansPage() {
  const { t, i18n } = useTranslation("onboarding")
  const { data } = usePaymentPlansQuery()
  const day = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "long", year: "numeric" }) : ""

  const current = data?.plans.find((p) => p.code === data.currentPlanCode)
  const scheduled = data?.plans.find((p) => p.code === data.scheduledPlanCode)

  let eyebrow: string | undefined
  let subtitle: string | undefined
  if (data?.subscribed) {
    eyebrow = t("plansPage.eyebrowOn", { plan: current?.name ?? data.currentPlanCode })
    subtitle = scheduled
      ? t("planChange.subtitleScheduled", { current: current?.name, plan: scheduled.name, date: day(data.renewsAt) })
      : t("planChange.subtitle", { current: current?.name ?? data.currentPlanCode, date: day(data.renewsAt) })
  } else if (data?.trialEnded) {
    eyebrow = t("plansPage.eyebrowTrialEnded")
    subtitle = t("plansPage.trialEnded")
  } else if (data?.trialEndsAt) {
    eyebrow = t("plansPage.eyebrowTrial")
    subtitle = t("plansPage.trialEndsOn", { date: day(data.trialEndsAt) })
  } else if (data) {
    subtitle = t("plansPage.subtitle")
  }

  return (
    <PageShell>
      <main className={`mx-auto w-full ${CONTENT_WIDTH_MD} flex-1 px-6 pb-16 pt-24 md:px-16`}>
        <PageHeading eyebrow={eyebrow} title={t("plansPage.title")} subtitle={subtitle} />
        <div className="mt-10">
          <PlanPicker variant="page" />
        </div>
      </main>
    </PageShell>
  )
}
