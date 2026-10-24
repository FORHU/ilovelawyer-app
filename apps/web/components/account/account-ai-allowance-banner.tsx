"use client"

import { useState } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { useAccountAiAllowanceQuery } from "@/lib/account/ai-allowance"
import { AccountAiTopUpModal } from "@/components/account/account-ai-topup-modal"

/** Shown across the top of the Case Workspace once the signed-in account has used up its AI usage
 * allowance (account-level now — cases aren't billed individually, so this applies regardless of
 * which case is open). Reading is still unaffected; only AI work (chat, analysis refresh) is held
 * back, as the inline error toasts already say. This banner is the persistent, always-visible way
 * out, with the top-up CTA — or, once a solo lawyer's free trial has ended, a link to the plans
 * (a top-up isn't a way out then: the API refuses it until they subscribe). */
export function AccountAiAllowanceBanner() {
  const { t } = useTranslation("case-portfolio")
  const [topUpOpen, setTopUpOpen] = useState(false)
  const { data: allowance } = useAccountAiAllowanceQuery()

  if (!allowance?.locked) return null

  if (allowance.trialEnded) {
    return (
      <div className="flex items-center gap-3 border-b border-amber-600/30 bg-amber-600/10 px-4 py-2 text-[13px] text-amber-600 md:px-6 dark:text-brand-gold">
        <Lock className="size-4 shrink-0" />
        <span className="flex-1">{t("aiAllowance.trialEndedBanner")}</span>
        <Button asChild size="sm" variant="outline" className="shrink-0 border-amber-600/40 text-amber-600 hover:bg-amber-600/10 dark:text-brand-gold">
          <Link href="/plans">{t("aiAllowance.choosePlanCta")}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber-600/30 bg-amber-600/10 px-4 py-2 text-[13px] text-amber-600 md:px-6 dark:text-brand-gold">
      <Lock className="size-4 shrink-0" />
      <span className="flex-1">{t("aiAllowance.lockedBanner")}</span>
      <Button size="sm" variant="outline" className="shrink-0 border-amber-600/40 text-amber-600 hover:bg-amber-600/10 dark:text-brand-gold" onClick={() => setTopUpOpen(true)}>
        {t("aiAllowance.topUpCta")}
      </Button>
      <AccountAiTopUpModal open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  )
}
