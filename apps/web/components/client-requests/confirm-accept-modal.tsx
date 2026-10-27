"use client"

import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

interface ConfirmAcceptModalProps {
  open: boolean
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Asked before the inbox's Accept claims a request, so a stray click can't take one. */
export function ConfirmAcceptModal({ open, isPending, onConfirm, onClose }: ConfirmAcceptModalProps) {
  const { t } = useTranslation("client-request")
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent role="alertdialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmAccept.title")}</DialogTitle>
          <DialogDescription>{t("confirmAccept.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            {t("confirmAccept.cancel")}
          </Button>
          <Button type="button" variant="accent" isPending={isPending} onClick={onConfirm}>
            {t("confirmAccept.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
