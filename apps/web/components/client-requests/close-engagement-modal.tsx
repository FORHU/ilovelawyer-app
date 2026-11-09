"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { RELEASE_REASONS, type CloseOutcome, type ReleaseReason } from "@/lib/client-handoff"
import type { CloseInput } from "@/lib/client-requests/api"
import { formatMoney } from "@/lib/money"

const LABEL = "text-[11px] font-semibold uppercase tracking-[1px] text-muted-foreground"
const NOTE_MAX_LENGTH = 1000
const CLAIM_NOTE_MAX_LENGTH = 500

interface CloseEngagementModalProps {
  open: boolean
  isPending: boolean
  /** The client paid through ilovelawyer: what can be refunded, and what the lawyer may claim. */
  paid: boolean
  /** The lawyer's share of the fee: the most they can claim for work done. */
  maxClaimMinor: number
  /** They've already said the work is finished and it waits on the client: only "can't continue" is left. */
  completionPending?: boolean
  onConfirm: (input: CloseInput) => void
  onClose: () => void
}

/**
 * Closing an engagement (FORHU/ilovelawyer-app#972). The lawyer says how it ends: the work is
 * finished, which asks the client to confirm before it closes, or they can't continue (a Lawyer Exit),
 * which closes it at once. Can't continue asks why and, when the client paid,
 * whether any work was done; with work done, what they claim for it (at most their share) and a short
 * explanation. The dialog says what each choice does to the client's money before they confirm.
 */
export function CloseEngagementModal(props: CloseEngagementModalProps) {
  const { t } = useTranslation("client-request")
  const { open, isPending, onClose } = props
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent role="alertdialog" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("closeEngagement.title")}</DialogTitle>
          <DialogDescription>{t("closeEngagement.description")}</DialogDescription>
        </DialogHeader>
        {/* Mounts each time the dialog opens, so what was typed never carries over. */}
        {open && <CloseForm {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function Choice({ selected, disabled, onClick, title, body }: { selected: boolean; disabled: boolean; onClick: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left disabled:opacity-60",
        selected ? "border-foreground bg-muted/60" : "border-border hover:border-foreground/40"
      )}
    >
      <span className="text-[13px] font-semibold text-foreground">{title}</span>
      <span className="text-[12px] text-muted-foreground">{body}</span>
    </button>
  )
}

function Pill({ selected, disabled, onClick, children }: { selected: boolean; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[1px] disabled:opacity-60",
        selected ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
      )}
    >
      {children}
    </button>
  )
}

function CloseForm({ isPending, paid, maxClaimMinor, completionPending, onConfirm, onClose }: CloseEngagementModalProps) {
  const { t } = useTranslation("client-request")
  const [outcome, setOutcome] = useState<CloseOutcome | null>(completionPending ? "CANT_CONTINUE" : null)
  const [reason, setReason] = useState<ReleaseReason | null>(null)
  const [workDone, setWorkDone] = useState<boolean | null>(null)
  const [claimed, setClaimed] = useState("")
  const [claimNote, setClaimNote] = useState("")
  const [note, setNote] = useState("")
  const [showErrors, setShowErrors] = useState(false)

  const exit = outcome === "CANT_CONTINUE"
  // Work done only matters on money paid through ilovelawyer: there's nothing to refund otherwise.
  const claiming = exit && paid && workDone === true
  const claimedValue = Number(claimed)
  const claimedMinor = claimed.trim() !== "" && Number.isFinite(claimedValue) ? Math.round(claimedValue * 100) : null
  const claimError = claiming && (claimedMinor === null || claimedMinor <= 0 || claimedMinor > maxClaimMinor)

  const missing =
    !outcome || (exit && !reason) || (exit && paid && workDone === null) || (claiming && (claimError || claimNote.trim() === ""))

  const effect = !outcome
    ? null
    : outcome === "WORK_FINISHED"
      ? t(paid ? "closeEngagement.effect.finished" : "closeEngagement.effect.finishedUnpaid")
      : !paid
        ? t("closeEngagement.effect.exitUnpaid")
        : workDone === null
          ? null
          : workDone
            ? t("closeEngagement.effect.claimed")
            : t("closeEngagement.effect.noWork")

  function confirm() {
    if (missing) return setShowErrors(true)
    const trimmed = note.trim()
    if (outcome === "WORK_FINISHED") return onConfirm({ outcome, ...(trimmed ? { note: trimmed } : {}) })
    onConfirm({
      outcome: "CANT_CONTINUE",
      reason: reason!,
      workDone: claiming,
      ...(claiming ? { claimed: { amountMinor: claimedMinor!, currency: "GBP" as const }, claimNote: claimNote.trim() } : {}),
      ...(trimmed ? { note: trimmed } : {}),
    })
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label={t("closeEngagement.outcomeLabel")} className="flex flex-col gap-2 sm:flex-row">
          <Choice
            selected={outcome === "WORK_FINISHED"}
            disabled={isPending || !!completionPending}
            onClick={() => setOutcome("WORK_FINISHED")}
            title={t("closeEngagement.finished")}
            body={t(completionPending ? "closeEngagement.finishedPending" : "closeEngagement.finishedHint")}
          />
          <Choice selected={exit} disabled={isPending} onClick={() => setOutcome("CANT_CONTINUE")} title={t("closeEngagement.cantContinue")} body={t("closeEngagement.cantContinueHint")} />
        </div>
        {showErrors && !outcome && <p className="text-xs text-red-600">{t("closeEngagement.outcomeRequired")}</p>}

        {exit && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-150 motion-reduce:animate-none">
            <span className={LABEL}>{t("closeEngagement.reasonLabel")}</span>
            <div role="radiogroup" aria-label={t("closeEngagement.reasonLabel")} className="flex flex-wrap gap-1.5">
              {RELEASE_REASONS.map((r) => (
                <Pill key={r} selected={reason === r} disabled={isPending} onClick={() => setReason(r)}>
                  {t(`closeEngagement.reasons.${r}`)}
                </Pill>
              ))}
            </div>
            {showErrors && !reason && <p className="text-xs text-red-600">{t("closeEngagement.reasonRequired")}</p>}

            {paid && (
              <>
                <span className={LABEL}>{t("closeEngagement.workDoneLabel")}</span>
                <div role="radiogroup" aria-label={t("closeEngagement.workDoneLabel")} className="flex flex-wrap gap-1.5">
                  <Pill selected={workDone === false} disabled={isPending} onClick={() => setWorkDone(false)}>
                    {t("closeEngagement.noWork")}
                  </Pill>
                  <Pill selected={workDone === true} disabled={isPending} onClick={() => setWorkDone(true)}>
                    {t("closeEngagement.someWork")}
                  </Pill>
                </div>
                {showErrors && workDone === null && <p className="text-xs text-red-600">{t("closeEngagement.workDoneRequired")}</p>}
              </>
            )}

            {claiming && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exit-claimed" className={LABEL}>
                    {t("closeEngagement.claimLabel", { max: formatMoney(maxClaimMinor) })}
                  </label>
                  <div className={cn("flex items-center gap-2 rounded-full border bg-background px-4 focus-within:border-foreground", showErrors && claimError ? "border-red-500" : "border-border")}>
                    <span className="text-sm text-muted-foreground" aria-hidden="true">
                      £
                    </span>
                    <input
                      id="exit-claimed"
                      inputMode="decimal"
                      value={claimed}
                      placeholder="0.00"
                      disabled={isPending}
                      aria-invalid={showErrors && claimError}
                      onChange={(e) => setClaimed(e.target.value.replace(/[^\d.]/g, ""))}
                      className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                  {showErrors && claimError && <p className="text-xs text-red-600">{t("closeEngagement.claimInvalid", { max: formatMoney(maxClaimMinor) })}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="exit-claim-note" className={LABEL}>
                    {t("closeEngagement.claimNoteLabel")}
                  </label>
                  <textarea
                    id="exit-claim-note"
                    value={claimNote}
                    onChange={(e) => setClaimNote(e.target.value)}
                    maxLength={CLAIM_NOTE_MAX_LENGTH}
                    rows={3}
                    disabled={isPending}
                    placeholder={t("closeEngagement.claimNotePlaceholder")}
                    aria-invalid={showErrors && claimNote.trim() === ""}
                    className={cn(
                      "w-full resize-none rounded-xl border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-foreground disabled:opacity-60",
                      showErrors && claimNote.trim() === "" ? "border-red-500" : "border-border"
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {outcome && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="close-note" className={LABEL}>
              {t(exit ? "closeEngagement.exitNoteLabel" : "closeEngagement.noteLabel")}
            </label>
            <textarea
              id="close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={NOTE_MAX_LENGTH}
              rows={2}
              disabled={isPending}
              className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-foreground disabled:opacity-60"
            />
            <p className="text-[11.5px] text-muted-foreground">{t(exit ? "closeEngagement.exitNoteHint" : "closeEngagement.noteHint")}</p>
          </div>
        )}

        {effect && <p className="rounded-xl bg-muted/60 px-3.5 py-2.5 text-[12.5px] text-foreground">{effect}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
          {t("detail.back")}
        </Button>
        <Button type="button" variant="accent" isPending={isPending} onClick={confirm}>
          {t(outcome === "WORK_FINISHED" ? "closeEngagement.askClient" : "detail.engaged.close")}
        </Button>
      </DialogFooter>
    </>
  )
}
