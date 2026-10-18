"use client"

import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { useLogoutMutation } from "@/lib/auth/mutations"
import { useTrial, useTrialBudget } from "@/lib/trial"

/** Ends the guest session, then opens the sign-up tab, so the account they make is a real one. */
export function useCreateAccountFromTrial() {
  const router = useRouter()
  const logout = useLogoutMutation()
  return () => logout.mutate(undefined, { onSettled: () => router.push("/login?tab=signup") })
}

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

/** What is left of the trial and the way out of it, over every page a guest can open: answers left
 * on the chat-only trial, dollars of AI left on the full trial. */
export function TrialBanner() {
  const { t } = useTranslation("landing")
  const trial = useTrial()
  const budget = useTrialBudget()
  const createAccount = useCreateAccountFromTrial()
  if (!trial) return null

  const status =
    trial.kind === "FULL"
      ? budget
        ? budget.spent
          ? t("trial.budgetSpent")
          : t("trial.budgetLeft", { amount: usd.format(budget.leftUsd) })
        : null
      : trial.answersLeft > 0
        ? t("trial.answersLeft", { count: trial.answersLeft })
        : t("trial.noAnswersLeft")

  return (
    <div
      role="status"
      className="fixed bottom-4 right-4 z-(--z-sidebar) flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-4 pr-1.5 text-[12.5px] text-card-foreground shadow-lg"
    >
      {status && <span>{status}</span>}
      <button
        type="button"
        onClick={createAccount}
        className="cursor-pointer whitespace-nowrap rounded-full bg-brand-gold px-4 py-2 text-[11px] font-semibold uppercase tracking-[1.2px] text-brand-gold-foreground transition-colors duration-200 hover:bg-brand-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("trial.createAccount")}
      </button>
    </div>
  )
}
