"use client"

import { Clock } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { ClientRequestForLawyer, ClientRequestInboxView } from "@/lib/client-requests/types"
import type { RequestUrgency } from "@/lib/client-handoff"

const URGENCY_TONE: Record<RequestUrgency, "neutral" | "caution" | "danger"> = {
  ROUTINE: "neutral",
  SOON: "caution",
  URGENT: "danger",
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })

function formatMoney(amountMinor: number): string {
  return gbp.format(amountMinor / 100)
}

function hoursUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / (60 * 60 * 1000)))
}

export function ClientRequestCard({
  request,
  view,
  onAccept,
  onPass,
  isAccepting,
  isPassing,
}: {
  request: ClientRequestForLawyer
  view: ClientRequestInboxView
  onAccept: () => void
  onPass: () => void
  isAccepting: boolean
  isPassing: boolean
}) {
  const { t } = useTranslation("client-requests")
  const { brief } = request
  const expiresInHours = hoursUntil(request.routingExpiresAt)
  const claimExpiresInHours = hoursUntil(request.claim?.claimExpiresAt ?? null)

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge shape="pill" tone={URGENCY_TONE[brief.urgency]}>
            {t(`urgency.${brief.urgency}`)}
          </Badge>
          <Badge shape="pill" tone="neutral">
            {t(`practiceArea.${brief.practiceArea}`)}
          </Badge>
          <span className="text-[12px] text-muted-foreground">{brief.ukJurisdiction}</span>
        </div>
        {view === "inbox" && expiresInHours !== null && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3" aria-hidden="true" />
            {t("expiresIn", { hours: expiresInHours })}
          </span>
        )}
        {view !== "inbox" && (
          <Badge shape="pill" tone="neutral">
            {t(`status.${request.status}`)}
          </Badge>
        )}
      </div>

      <p className="text-[15px] leading-relaxed text-foreground">{brief.summary}</p>

      {brief.clientNote && <p className="text-[13px] italic leading-relaxed text-muted-foreground">&ldquo;{brief.clientNote}&rdquo;</p>}

      <div className="flex flex-wrap items-center gap-4 text-[12px] text-muted-foreground">
        {brief.knownDeadline && <span>{t("knownDeadline", { date: brief.knownDeadline })}</span>}
        <span>{t("perCaseFee", { amount: formatMoney(request.perCaseFee.amountMinor) })}</span>
      </div>

      {view === "inbox" && (
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onPass} isPending={isPassing} disabled={isAccepting}>
            {t("pass")}
          </Button>
          <Button variant="accent" onClick={onAccept} isPending={isAccepting} disabled={isPassing}>
            {t("accept")}
          </Button>
        </div>
      )}

      {view === "mine" && request.claim && claimExpiresInHours !== null && (
        <p className="text-[12px] text-muted-foreground">{t("claimExpiresIn", { hours: claimExpiresInHours })}</p>
      )}

      {view === "mine" && request.quote && (
        <p className="text-[13px] text-foreground">{t("quoteSent", { amount: formatMoney(request.quote.amount.amountMinor) })}</p>
      )}

      {request.engagement && (
        <div className="flex flex-col gap-0.5 border-t border-border pt-3 text-[12px] text-muted-foreground">
          <span>{t("engagedWith", { name: request.engagement.clientName })}</span>
          {request.engagement.closedAt && <span>{t("closedOn", { date: new Date(request.engagement.closedAt).toLocaleDateString() })}</span>}
        </div>
      )}
    </div>
  )
}
