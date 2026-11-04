"use client"

import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"

interface ConfirmPassModalProps {
  open: boolean
  isPending: boolean
  onConfirm: () => void
  onClose: () => void
}

/** Asked before Pass hides a request, so a stray click can't lose one: a pass can't be undone. */
export function ConfirmPassModal({ open, isPending, onConfirm, onClose }: ConfirmPassModalProps) {
  const { t } = useTranslation("client-request")
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent role="alertdialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmPass.title")}</DialogTitle>
          <DialogDescription>{t("confirmPass.description")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
            {t("confirmPass.cancel")}
          </Button>
          <Button type="button" variant="accent" isPending={isPending} onClick={onConfirm}>
            {t("confirmPass.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
