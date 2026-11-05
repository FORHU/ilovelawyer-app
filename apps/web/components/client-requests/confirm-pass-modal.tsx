"use client"

import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { PASS_NOTE_MAX_LENGTH, PASS_REASONS, type PassReason } from "@/lib/client-handoff"
import type { PassInput } from "@/lib/client-requests/api"

interface ConfirmPassModalProps {
  open: boolean
  isPending: boolean
  onConfirm: (input: PassInput) => void
  onClose: () => void
}

/**
 * Asked before Pass hides a request, so a stray click can't lose one: a pass can't be undone. The
 * lawyer may say why (a reason, a note, both or neither); Pass never waits on it. What they say is
 * kept for ilovelawyer staff only.
 */
export function ConfirmPassModal({ open, isPending, onConfirm, onClose }: ConfirmPassModalProps) {
  const { t } = useTranslation("client-request")
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent role="alertdialog" className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("confirmPass.title")}</DialogTitle>
          <DialogDescription>{t("confirmPass.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounts each time the dialog opens, so what was typed for one request never reaches the next. */}
        <PassForm isPending={isPending} onConfirm={onConfirm} onClose={onClose} />
      </DialogContent>
    </Dialog>
  )
}

function PassForm({ isPending, onConfirm, onClose }: Omit<ConfirmPassModalProps, "open">) {
  const { t } = useTranslation("client-request")
  const [reason, setReason] = useState<PassReason | null>(null)
  const [note, setNote] = useState("")
  const noteRef = useRef<HTMLTextAreaElement>(null)
  // The note is the "Other" reason in the lawyer's own words: shown only while Other is picked. What
  // was typed is kept if they pick another reason, so going back to Other brings it back.
  const noteOpen = reason === "OTHER"

  useEffect(() => {
    if (noteOpen) noteRef.current?.focus()
  }, [noteOpen])

  function confirm() {
    const trimmed = noteOpen ? note.trim() : ""
    onConfirm({ ...(reason ? { reason } : {}), ...(trimmed ? { note: trimmed } : {}) })
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("confirmPass.reasonLabel")}</span>
        <div role="radiogroup" aria-label={t("confirmPass.reasonLabel")} className="flex flex-wrap gap-1.5">
          {PASS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={reason === r}
              disabled={isPending}
              // Picking the chosen reason again clears it: the reason is optional.
              onClick={() => setReason(reason === r ? null : r)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[1px] disabled:opacity-60",
                reason === r ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
              )}
            >
              {t(`confirmPass.reasons.${r}`)}
            </button>
          ))}
        </div>
        {noteOpen && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none">
            <div className="relative">
              <textarea
                ref={noteRef}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={PASS_NOTE_MAX_LENGTH}
                rows={3}
                disabled={isPending}
                aria-label={t("confirmPass.notePlaceholder")}
                placeholder={t("confirmPass.notePlaceholder")}
                className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 pb-6 text-[13px] outline-none focus:border-foreground disabled:opacity-60"
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[10.5px] tabular-nums text-muted-foreground">
                {note.length} / {PASS_NOTE_MAX_LENGTH}
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground">{t("confirmPass.noteHint")}</p>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
          {t("confirmPass.cancel")}
        </Button>
        <Button type="button" variant="accent" isPending={isPending} onClick={confirm}>
          {t("confirmPass.confirm")}
        </Button>
      </DialogFooter>
    </>
  )
}
