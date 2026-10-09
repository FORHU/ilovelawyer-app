"use client"

import { useRouter } from "next/navigation"
import { ArrowUpRight, Copy, Lock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { cn } from "@workspace/ui/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { useAuthStore } from "@/lib/store/auth.store"
import { useSwitchWorkspace } from "@/lib/organizations/mutations"
import { dateLocale } from "@/lib/i18n/date-locale"
import type { CaseRecord } from "@/lib/cases/mutations"

function initialsOf(name: string) {
  const [first, second] = name.split(/[.\s_-]+/).filter(Boolean)
  if (!first) return "?"
  return (second ? `${first[0]}${second[0]}` : first.slice(0, 2)).toUpperCase()
}

/** True while the user is looking at their portfolio — the portfolio view from an organization,
 * or their personal workspace itself (which is the same thing). */
export function useInPortfolio() {
  return useAuthStore((s) => s.workspace === "portfolio" || (s.workspace === "organization" && !!s.organization?.isPersonal))
}

/**
 * Where a case comes from. In an organization: who created it ("Created by you", a teammate, a
 * former member, or a deleted account). In the portfolio: "Personal" for a case made there, or
 * "Copied from <org>" for the copy kept of a case created in an organization since left.
 */
export function CaseOrigin({ caseRecord, className }: { caseRecord: CaseRecord; className?: string }) {
  const { t } = useTranslation("case-portfolio")
  const currentUserId = useAuthStore((s) => s.user?.id)
  const inPortfolio = useInPortfolio()
  const base = cn("inline-flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground", className)

  if (inPortfolio) {
    if (caseRecord.copiedFromOrgName) {
      const date = caseRecord.copiedAt
        ? new Intl.DateTimeFormat(dateLocale(), { month: "short", day: "numeric", year: "numeric" }).format(new Date(caseRecord.copiedAt))
        : ""
      return (
        <span className={base}>
          <Copy className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {t("portfolioView.copiedFrom", { orgName: caseRecord.copiedFromOrgName, date })}
            {caseRecord.copyVersion && ` · ${t("portfolioView.copyVersion", caseRecord.copyVersion)}`}
          </span>
          {caseRecord.original?.changedSinceCopy && (
            <span className="shrink-0 rounded-full border border-brand-gold/40 bg-brand-gold/10 px-1.5 py-px text-[10px] font-semibold text-amber-700 dark:text-brand-gold">
              {t("portfolioView.originalChanged")}
            </span>
          )}
        </span>
      )
    }
    return (
      <span className={base}>
        <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="truncate">{t("portfolioView.personalBadge")}</span>
      </span>
    )
  }

  const creator = caseRecord.createdBy
  const name = creator?.name ?? caseRecord.createdByName
  if (!name) return null
  const isMe = !!creator && creator.id === currentUserId
  const note = !creator ? t("portfolioView.deletedAccount") : !creator.isMember ? t("portfolioView.formerMember") : null

  return (
    <span className={base}>
      <UserAvatar
        avatarUrl={creator?.avatarUrl}
        initials={initialsOf(name)}
        className="h-4 w-4 bg-secondary text-[7px] font-semibold text-secondary-foreground"
      />
      <span className="truncate">
        {isMe ? t("portfolioView.createdByYou") : t("portfolioView.createdBy", { name })}
        {note && <span className="text-muted-foreground/70"> · {note}</span>}
      </span>
    </span>
  )
}

/** On a portfolio copy whose original the user can open again (they're back in its
 * organization): a way to it, to compare the two by hand. Rendered outside any link. */
export function OpenOriginalButton({ caseRecord }: { caseRecord: CaseRecord }) {
  const { t } = useTranslation("case-portfolio")
  const router = useRouter()
  const switchWorkspace = useSwitchWorkspace()
  const inPortfolio = useInPortfolio()
  const original = caseRecord.original
  if (!inPortfolio || !original) return null

  return (
    <button
      type="button"
      onClick={() => {
        switchWorkspace("organization")
        router.push(`/homepage/case-portfolio/${original.id}`)
      }}
      className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-foreground transition-colors hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    >
      {t("portfolioView.openOriginal", { orgName: original.organizationName ?? caseRecord.copiedFromOrgName ?? "" })}
      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
    </button>
  )
}
