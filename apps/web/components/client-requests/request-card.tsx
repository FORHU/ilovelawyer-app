"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { formatTimeAgo } from "@/lib/client-requests/format";
import { closingSoon, leftToShow, readiness, timeLeft } from "@/lib/client-requests/request-meta";
import { useNow } from "@/lib/client-requests/use-countdown";
import type { ClientRequestForLawyer } from "@/lib/client-requests/types";
import { RequestTags } from "./request-tags";
import { claimEndedKey } from "@/lib/client-requests/claim-ended";

interface RequestCardProps {
  request: ClientRequestForLawyer;
  /** Omitted outside the inbox view (mine/history): those are read-only lists. */
  onPass?: (id: string) => void;
  onAccept?: (id: string) => void;
  passPending?: boolean;
  acceptPending?: boolean;
}

const META = "text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground";

export function RequestCard({ request, onPass, onAccept, passPending, acceptPending }: RequestCardProps) {
  const { t } = useTranslation("client-request");
  const actionable = !!onPass && !!onAccept;
  const ready = readiness(request);
  // Only an unclaimed request is still counting down to its 48-hour expiry. Re-read every minute, so
  // the time left stays true and a request that has run out stops being acceptable.
  const now = useNow();
  const left = actionable ? timeLeft(request.routingExpiresAt, now) : null;
  const expired = left === 0;
  const shown = left === null ? null : leftToShow(left);
  const openText = !shown
    ? ""
    : "hours" in shown
      ? t("card.open", shown)
      : shown.minutes > 0
        ? t("card.openMinutes", shown)
        : t("card.closed");

  return (
    // One markup for both breakpoints: actions stack under the copy on mobile, sit to its right from md.
    <article className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        {request.askedForYou && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge shape="pill" className="self-start py-1 tracking-[1px]">
                {t("card.askedForYou")}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{t("card.askedForYouTooltip")}</TooltipContent>
          </Tooltip>
        )}
        <RequestTags brief={request.brief} />
        <p className="max-w-[860px] text-[15px] leading-relaxed text-foreground">{request.brief.summary}</p>
        {request.brief.clientNote && (
          <p className="max-w-[860px] text-[14px] leading-relaxed text-muted-foreground italic">“{request.brief.clientNote}”</p>
        )}
        <p className={cn("flex flex-wrap gap-x-4 gap-y-1", META)}>
          {request.routedAt && <span>{t("card.received", { ago: formatTimeAgo(request.routedAt) })}</span>}
          {ready && (
            <span className={cn(ready.met === ready.total && "text-brand-status-green")}>
              {t(ready.met === ready.total ? "card.ready" : "card.notReady", ready)}
            </span>
          )}
          {left !== null && (
            <span className={cn(closingSoon(left) && "text-danger")}>{expired ? t("card.expired") : openText}</span>
          )}
          {request.assignedTo && <span>{t("card.assignedTo", { name: request.assignedTo.name })}</span>}
        </p>
      </div>

      {!actionable ? (
        <Badge shape="pill" className="self-start py-1 tracking-[1px] md:self-center">
          {/* Several lawyers: once this lawyer's claim has ended, the request's own status is how it
              looks to the others (still ROUTED, say), so the badge says how it ended for them. */}
          {claimEndedKey(request.claim) ? t(`${claimEndedKey(request.claim)}.badge`) : t(`detail.status.${request.status}`)}
        </Badge>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={passPending || acceptPending}
                onClick={() => onPass(request.id)}
                className="h-10 flex-1 px-6 text-[11px] font-semibold tracking-[1.2px] uppercase md:flex-none"
              >
                {t("card.pass")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(request.onlyForYou ? "card.passOnlyForYouTooltip" : "card.passTooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                disabled={passPending || acceptPending || expired}
                onClick={() => onAccept(request.id)}
                className="h-10 flex-1 border-foreground px-6 text-[11px] font-semibold tracking-[1.2px] uppercase md:flex-none"
              >
                {t("card.accept")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t(request.onlyForYou ? "card.acceptOnlyForYouTooltip" : "card.acceptTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </article>
  );
}
