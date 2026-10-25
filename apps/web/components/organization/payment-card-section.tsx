"use client"

import { useState } from "react"
import { CreditCard } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import { ErrorState } from "@/components/error-state"
import { AddCardModal } from "@/components/client-requests/add-card-modal"
import { useOrganizationCardQuery } from "@/lib/organizations/billing"
import { OWN_WORKSPACE_ID } from "@/lib/store/auth.store"

/** The organization's card on file (ilovelawyer-api#505), shown and changed from here. Owners
 * and Admins only, same as the API's requireOrgRole(ADMIN) — mirrors FeeHistorySection and
 * AuditLogSection, its siblings on this page. With OWN_WORKSPACE_ID it's a solo lawyer's own card,
 * on their profile. */
export function PaymentCardSection({ organizationId }: { organizationId: string }) {
  const { t } = useTranslation("organization")
  const [modalOpen, setModalOpen] = useState(false)

  const query = useOrganizationCardQuery(organizationId)
  const showSkeleton = useDelayedLoading(query.isLoading)
  const card = query.data ?? null
  const solo = organizationId === OWN_WORKSPACE_ID

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl ring-1 shadow-black/20 ring-black/5 dark:ring-white/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5 md:px-8">
        <div>
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">{t("billing.card.heading")}</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{t(solo ? "billing.card.subheadingSolo" : "billing.card.subheading")}</p>
        </div>
        {!showSkeleton && !query.isError && (
          <Button type="button" variant={card ? "outline" : "accent"} onClick={() => setModalOpen(true)}>
            {card ? t("billing.card.change") : t("billing.card.add")}
          </Button>
        )}
      </div>

      <div className="px-6 py-5 md:px-8">
        {showSkeleton ? (
          <Skeleton className="h-9 w-64" />
        ) : query.isError ? (
          <ErrorState message={t("billing.card.error")} retryLabel={t("billing.card.retry")} onRetry={() => query.refetch()} />
        ) : card ? (
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">
                <span className="capitalize">{card.brand}</span> {t("billing.card.endingIn", { last4: card.last4 })}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {t("billing.card.expires", { month: String(card.expMonth).padStart(2, "0"), year: card.expYear })}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">{t(solo ? "billing.card.noCardHelpSolo" : "billing.card.noCardHelp")}</p>
        )}
      </div>

      <AddCardModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </section>
  )
}
