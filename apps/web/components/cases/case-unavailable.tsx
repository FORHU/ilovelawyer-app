"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useTranslation } from "react-i18next"
import { Briefcase } from "lucide-react"
import { useAuthStore } from "@/lib/store/auth.store"
import { useSwitchWorkspace } from "@/lib/organizations/mutations"

/** A 403/404 on a case: it isn't in the workspace being viewed — usually an organization's case
 * after its creator left (their copy is in their portfolio), or a link opened from the other
 * workspace. */
export function isCaseUnavailableError(error: unknown) {
  const status = (error as { status?: number } | null)?.status
  return status === 403 || status === 404
}

/** Stands in for a case page whose case can't be opened here, pointing to where it might be. */
export function CaseUnavailable() {
  const { t } = useTranslation("case-portfolio")
  const router = useRouter()
  const organization = useAuthStore((s) => s.organization)
  const workspace = useAuthStore((s) => s.workspace)
  const switchWorkspace = useSwitchWorkspace()
  const hasPortfolio = !!organization && !organization.isPersonal
  const inPortfolio = workspace === "portfolio"

  // A shared case that's no longer shared (or was deleted): back to the list of shared cases,
  // which the guard leaves the owner's portfolio for.
  if (workspace === "shared") {
    return (
      <main className="flex flex-1 items-center justify-center px-6 pt-24 pb-16">
        <div className="flex max-w-[440px] flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-muted-foreground">
            <Briefcase className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground">{t("portfolioView.unavailableTitle")}</h1>
          <p className="text-[14px] leading-relaxed text-muted-foreground">{t("portfolioView.sharedUnavailable")}</p>
          <Link
            href="/homepage/case-portfolio?view=shared"
            className="mt-2 rounded-full border border-border px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-foreground transition-colors hover:border-foreground/40"
          >
            {t("portfolioView.backToShared")}
          </Link>
        </div>
      </main>
    )
  }

  const openOther = () => {
    switchWorkspace(inPortfolio ? "organization" : "portfolio")
    router.push("/homepage/case-portfolio")
  }

  return (
    <main className="flex flex-1 items-center justify-center px-6 pt-24 pb-16">
      <div className="flex max-w-[440px] flex-col items-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-muted-foreground">
          <Briefcase className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground">{t("portfolioView.unavailableTitle")}</h1>
        <p className="text-[14px] leading-relaxed text-muted-foreground">
          {inPortfolio
            ? t("portfolioView.unavailableBodyPortfolio", { orgName: organization?.name ?? "" })
            : t("portfolioView.unavailableBody")}
        </p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          {hasPortfolio && (
            <button
              type="button"
              onClick={openOther}
              className="cursor-pointer rounded-full bg-brand-gold px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-brand-gold-foreground transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
            >
              {inPortfolio ? t("portfolioView.openOrganization", { orgName: organization?.name ?? "" }) : t("portfolioView.openPortfolio")}
            </button>
          )}
          <Link
            href="/homepage/case-portfolio"
            className="rounded-full border border-border px-6 py-2.5 text-[11px] font-semibold uppercase tracking-[1.2px] text-foreground transition-colors hover:border-foreground/40"
          >
            {t("portfolioView.backToCases")}
          </Link>
        </div>
      </div>
    </main>
  )
}
