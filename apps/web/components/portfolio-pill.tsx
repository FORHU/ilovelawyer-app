"use client"

import { Lock, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useAuthStore } from "@/lib/store/auth.store"
import { useSwitchWorkspace } from "@/lib/organizations/mutations"

/** Shown in the header while the portfolio is being viewed — every page (calendar, chat, cases)
 * then shows portfolio data, so it has to be obvious, and one click away from the organization. */
export function PortfolioPill() {
  const { t } = useTranslation("case-portfolio")
  const organization = useAuthStore((s) => s.organization)
  const viewing = useAuthStore((s) => s.workspace === "portfolio" && !!s.portfolio)
  const switchWorkspace = useSwitchWorkspace()
  if (!viewing || !organization || organization.isPersonal) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => switchWorkspace("organization")}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 pl-3 pr-2 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-brand-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 dark:text-brand-gold"
        >
          <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
          {t("portfolioView.portfolioTab")}
          <X className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("portfolioView.indicatorBack", { orgName: organization.name })}</TooltipContent>
    </Tooltip>
  )
}
