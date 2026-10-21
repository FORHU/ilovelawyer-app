"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { TextField } from "@workspace/ui/components/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { useAuthStore } from "@/lib/store/auth.store"
import type { OrganizationRole } from "@/lib/organizations/queries"
import { useAddBillingCardMutation } from "@/lib/client-requests/billing"
import type { PaymentCard } from "@/lib/client-requests/types"

const CAN_MANAGE_BILLING: OrganizationRole[] = ["OWNER", "ADMIN"]

/**
 * Opened when accepting a request answers 402 CARD_REQUIRED (ilovelawyer-api#505's contract —
 * see lib/client-requests/billing.ts for why this takes fake card details directly instead of
 * redirecting to a real Stripe Checkout session). Organization OWNER/ADMIN only, matching the
 * real route's own restriction, so this doesn't teach a workflow the backend will refuse.
 */
export function AddCardModal({ open, onClose, onCardAdded }: { open: boolean; onClose: () => void; onCardAdded: () => void }) {
  const { t } = useTranslation("client-requests")
  const organization = useAuthStore((s) => s.organization)
  const addCard = useAddBillingCardMutation(organization?.id)
  const [last4, setLast4] = useState("")

  const canManageBilling = !!organization && CAN_MANAGE_BILLING.includes(organization.role)
  const valid = /^\d{4}$/.test(last4)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid) return
    const card: PaymentCard = { brand: "visa", last4, expMonth: 12, expYear: new Date().getFullYear() + 3 }
    addCard.mutate(card, {
      onSuccess: () => {
        setLast4("")
        onCardAdded()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cardModal.title")}</DialogTitle>
          <DialogDescription>{t("cardModal.description")}</DialogDescription>
        </DialogHeader>

        {canManageBilling ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label={t("cardModal.last4Label")}
              helperText={t("cardModal.last4Help")}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              errorText={last4 && !valid ? t("cardModal.last4Error") : undefined}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {t("cardModal.cancel")}
              </Button>
              <Button type="submit" variant="accent" isPending={addCard.isPending} disabled={!valid}>
                {t("cardModal.save")}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <p className="text-[14px] text-muted-foreground">{t("cardModal.notAllowed")}</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
