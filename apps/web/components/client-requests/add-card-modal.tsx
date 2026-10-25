"use client"

import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { OWN_WORKSPACE_ID, useAuthStore } from "@/lib/store/auth.store"
import type { OrganizationRole } from "@/lib/organizations/queries"
import { useOrganizationCardQuery, useStartCardSetupMutation } from "@/lib/organizations/billing"

const CAN_MANAGE_BILLING: OrganizationRole[] = ["OWNER", "ADMIN"]

/**
 * Opened from the Organization Billing page's "Add card"/"Change card" action (a solo lawyer's: their
 * profile), from the inbox when accepting a request answers 402 CARD_REQUIRED, and from a confirmed
 * request whose per-case fee failed. Organization OWNER/ADMIN only, matching the real route's own
 * restriction (ilovelawyer-api#505); a solo lawyer's card is their own (their workspace's role is
 * OWNER).
 *
 * Confirming redirects the whole page to Stripe's hosted Checkout (setup mode) and back — the
 * card itself never passes through this app. See use-card-setup-return.ts for the return half;
 * `extraReturnParams` is how a caller carries its own state (e.g. which request to resume
 * claiming) across that round trip.
 */
export function AddCardModal({
  open,
  onClose,
  extraReturnParams,
}: {
  open: boolean
  onClose: () => void
  extraReturnParams?: Record<string, string>
}) {
  const { t } = useTranslation("client-requests")
  const organization = useAuthStore((s) => s.organization)
  const cardQuery = useOrganizationCardQuery(organization?.id)
  const startSetup = useStartCardSetupMutation(organization?.id)

  const canManageBilling = !!organization && CAN_MANAGE_BILLING.includes(organization.role)
  const solo = organization?.id === OWN_WORKSPACE_ID
  const hasCard = !!cardQuery.data

  function handleContinue() {
    if (typeof window === "undefined") return
    const url = new URL(window.location.pathname, window.location.origin)
    for (const [key, value] of Object.entries(extraReturnParams ?? {})) url.searchParams.set(key, value)
    startSetup.mutate(url.toString(), {
      onSuccess: (data) => {
        window.location.href = data.url
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{hasCard ? t("cardModal.changeTitle") : t("cardModal.title")}</DialogTitle>
          <DialogDescription>
            {hasCard
              ? t(solo ? "cardModal.changeDescriptionSolo" : "cardModal.changeDescription")
              : t(solo ? "cardModal.descriptionSolo" : "cardModal.description")}
          </DialogDescription>
        </DialogHeader>

        {canManageBilling ? (
          <div className="flex flex-col gap-4">
            {cardQuery.data && (
              <p className="text-[13px] text-muted-foreground">
                {t("cardModal.currentCard", { brand: cardQuery.data.brand, last4: cardQuery.data.last4 })}
              </p>
            )}
            <p className="text-[13px] text-muted-foreground">{t("cardModal.redirectNotice")}</p>
            {startSetup.isError && <p className="text-[13px] text-red-600 dark:text-red-400">{t("cardModal.startError")}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cardModal.cancel")}
              </Button>
              <Button type="button" variant="accent" isPending={startSetup.isPending} onClick={handleContinue}>
                {t("cardModal.continue")}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <p className="text-[14px] text-muted-foreground">{t("cardModal.notAllowed")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
