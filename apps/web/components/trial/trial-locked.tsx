"use client"

import { useTranslation } from "react-i18next"
import { useCreateAccountFromTrial } from "@/components/trial/trial-banner"

/** What a trial guest sees in place of every page but the consultation. */
export function TrialLocked() {
  const { t } = useTranslation("landing")
  const createAccount = useCreateAccountFromTrial()

  return (
    <div className="flex min-h-[70vh] w-full items-center px-6 pt-16 md:px-16">
      <div className="mx-auto flex w-full max-w-[1100px] flex-col items-start gap-5">
        <h1 className="m-0 max-w-[16ch] font-['Libre_Caslon_Text'] text-[clamp(32px,5vw,56px)] font-light leading-[1] tracking-[-0.02em] text-balance text-foreground">
          {t("trial.lockedHeading")}
        </h1>
        <p className="m-0 max-w-[52ch] text-base leading-relaxed text-muted-foreground">{t("trial.lockedBody")}</p>
        <button
          type="button"
          onClick={createAccount}
          className="cursor-pointer rounded-full bg-brand-gold px-6 py-3 text-xs font-semibold uppercase tracking-[1.2px] text-brand-gold-foreground transition-colors duration-200 hover:bg-brand-gold/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("trial.createAccount")}
        </button>
      </div>
    </div>
  )
}
