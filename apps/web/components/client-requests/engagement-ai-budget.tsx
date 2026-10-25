"use client"

import { useState } from "react"
import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog"
import { cn } from "@workspace/ui/lib/utils"
import { formatMoney } from "@/lib/money"
import type { AiBudgetState } from "@/lib/client-handoff"
import { isCardRequiredError } from "@/lib/client-requests/inbox"
import { useBuyTopUpMutation, useEngagementAiBudgetQuery, useEngagementForCopy, useTopUpPacksQuery } from "@/lib/client-requests/ai-budget"
import { AddCardModal } from "@/components/client-requests/add-card-modal"

const TONE: Record<AiBudgetState, { bar: string; text: string }> = {
  OK: { bar: "bg-emerald-600", text: "text-muted-foreground" },
  WARNING: { bar: "bg-amber-500", text: "text-amber-600 dark:text-brand-gold" },
  EXHAUSTED: { bar: "bg-red-600", text: "text-red-600 dark:text-red-400" },
}

/**
 * Buying an AI top-up for the engagement (FORHU/ilovelawyer-app#885, ilovelawyer-api#516): the packs
 * on offer with their price and the AI credit each adds, and nothing is charged until the lawyer
 * confirms. With no card on file it offers to add one; a declined card says so.
 */
export function EngagementAiTopUpModal({ requestId, open, onClose }: { requestId: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation("client-request")
  const packs = useTopUpPacksQuery(open)
  const buy = useBuyTopUpMutation(requestId)
  const [chosen, setChosen] = useState<string | null>(null)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const packId = chosen ?? packs.data?.[0]?.id ?? null
  const pack = packs.data?.find((p) => p.id === packId)

  function confirm() {
    if (!packId) return
    buy.mutate(packId, {
      onSuccess: (charge) => {
        toast.success(charge.status === "PENDING" ? t("aiBudget.topUpPending") : t("aiBudget.topUpDone", { credit: formatMoney(pack?.credit.amountMinor ?? 0) }))
        onClose()
      },
      onError: (err) => {
        if (isCardRequiredError(err)) return setCardModalOpen(true)
        toast.error(err instanceof Error ? err.message : t("loadError"))
      },
    })
  }

  return (
    <>
      <Dialog open={open && !cardModalOpen} onOpenChange={(next) => !next && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("aiBudget.topUpTitle")}</DialogTitle>
            <DialogDescription>{t("aiBudget.topUpDescription")}</DialogDescription>
          </DialogHeader>
          {packs.isLoading ? (
            <p className="text-[13px] text-muted-foreground">{t("aiBudget.loadingPacks")}</p>
          ) : !packs.data?.length ? (
            <p className="text-[13px] text-muted-foreground">{t("aiBudget.noPacks")}</p>
          ) : (
            <div role="radiogroup" aria-label={t("aiBudget.topUpTitle")} className="flex flex-col gap-2">
              {packs.data.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={p.id === packId}
                  onClick={() => setChosen(p.id)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                    p.id === packId ? "border-foreground bg-muted/50" : "border-border hover:border-foreground/40"
                  )}
                >
                  <span>
                    <span className="block text-[14px] font-semibold text-foreground">{p.name}</span>
                    <span className="block text-[12px] text-muted-foreground">{t("aiBudget.packCredit", { credit: formatMoney(p.credit.amountMinor) })}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums text-foreground">{formatMoney(p.price.amountMinor)}</span>
                </button>
              ))}
            </div>
          )}
          {pack && <p className="text-[12px] text-muted-foreground">{t("aiBudget.chargeNote", { price: formatMoney(pack.price.amountMinor) })}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={buy.isPending}>
              {t("aiBudget.notNow")}
            </Button>
            <Button type="button" variant="accent" onClick={confirm} isPending={buy.isPending} disabled={!pack}>
              {pack ? t("aiBudget.confirm", { price: formatMoney(pack.price.amountMinor) }) : t("aiBudget.topUp")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AddCardModal open={cardModalOpen} onClose={() => setCardModalOpen(false)} />
    </>
  )
}

/**
 * The engagement's AI budget meter (FORHU/ilovelawyer-app#883, ilovelawyer-api#515): how much of it
 * the AI work on the workspace copy has used, green, amber from 80%, red once it's spent (when AI
 * actions are refused), with a Top up button once it's low. `variant="strip"` is the Terminal's
 * full-width bar; the default sits in a card.
 */
export function EngagementAiMeter({ requestId, variant = "card" }: { requestId: string; variant?: "card" | "strip" }) {
  const { t } = useTranslation("client-request")
  const budget = useEngagementAiBudgetQuery(requestId)
  const [topUpOpen, setTopUpOpen] = useState(false)
  if (!budget.data) return null
  const { percentUsed, state, remaining, used, included, toppedUp } = budget.data
  const tone = TONE[state]
  const total = included.amountMinor + toppedUp.amountMinor

  const message =
    state === "EXHAUSTED" ? t("aiBudget.exhausted") : state === "WARNING" ? t("aiBudget.warning", { remaining: formatMoney(remaining.amountMinor) }) : t("aiBudget.ok", { remaining: formatMoney(remaining.amountMinor) })

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        variant === "strip" && cn("border-b px-4 py-2 md:px-6", state === "EXHAUSTED" ? "border-red-600/30 bg-red-600/5" : state === "WARNING" ? "border-amber-500/30 bg-amber-500/5" : "border-border")
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Sparkles className={cn("size-4 shrink-0", tone.text)} aria-hidden="true" />
        <span className="text-[13px] font-semibold text-foreground">{t("aiBudget.title")}</span>
        <span className={cn("text-[12px]", tone.text)}>{message}</span>
        {state !== "OK" && (
          <Button type="button" size="sm" variant={state === "EXHAUSTED" ? "accent" : "outline"} className="ml-auto" onClick={() => setTopUpOpen(true)}>
            {t("aiBudget.topUp")}
          </Button>
        )}
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label={t("aiBudget.title")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentUsed}
        aria-valuetext={t("aiBudget.used", { used: formatMoney(used.amountMinor), total: formatMoney(total) })}
      >
        <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${Math.min(100, percentUsed)}%` }} />
      </div>
      <span className="text-[11px] text-muted-foreground tabular-nums">{t("aiBudget.used", { used: formatMoney(used.amountMinor), total: formatMoney(total) })}</span>
      <EngagementAiTopUpModal requestId={requestId} open={topUpOpen} onClose={() => setTopUpOpen(false)} />
    </div>
  )
}

/** The meter across the top of the Case Workspace when the open case is an engagement's workspace
 * copy; nothing for any other case. */
export function EngagementAiBudgetStrip({ caseId }: { caseId: string }) {
  const engagement = useEngagementForCopy(caseId)
  if (!engagement) return null
  return <EngagementAiMeter requestId={engagement.requestId} variant="strip" />
}
