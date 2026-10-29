"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { formatTimeAgo } from "@/lib/client-requests/format";
import type { ClientRequestForLawyer } from "@/lib/client-requests/types";
import { RequestTags } from "./request-tags";

interface RequestCardProps {
  request: ClientRequestForLawyer;
  /** Only the first card in the inbox is raised — it's the one to act on first. */
  featured?: boolean;
  /** Omitted outside the inbox view (mine/history): those are read-only lists. */
  onPass?: (id: string) => void;
  onAccept?: (id: string) => void;
  passPending?: boolean;
  acceptPending?: boolean;
}

const META = "text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground";

export function RequestCard({ request, featured = false, onPass, onAccept, passPending, acceptPending }: RequestCardProps) {
  const { t } = useTranslation("client-request");
  const actionable = !!onPass && !!onAccept;

  return (
    // One markup for both breakpoints: actions stack under the copy on mobile, sit to its right from md.
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6",
        featured && actionable ? "bg-background shadow-md" : "bg-card"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <RequestTags brief={request.brief} />
        <p className="max-w-[860px] text-[13px] leading-relaxed text-foreground">{request.brief.summary}</p>
        {request.brief.clientNote && (
          <p className="max-w-[860px] text-[13px] leading-relaxed text-muted-foreground italic">“{request.brief.clientNote}”</p>
        )}
        <p className={cn("flex flex-wrap gap-x-4 gap-y-1", META)}>
          {request.routedAt && <span>{t("card.received", { ago: formatTimeAgo(request.routedAt) })}</span>}
          {request.assignedTo && <span>{t("card.assignedTo", { name: request.assignedTo.name })}</span>}
        </p>
      </div>

      {!actionable ? (
        <Badge shape="pill" className="self-start py-1 tracking-[1px] md:self-center">
          {/* Several lawyers: the request moved on for the lawyer the client hired, not for this one. */}
          {request.claim?.outcome === "NOT_CHOSEN" ? t("detail.notChosen.badge") : request.status}
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
            <TooltipContent>{t("card.passTooltip")}</TooltipContent>
          </Tooltip>
          {/* Only the first (newest) card carries the page's one gold CTA; every open request
              stays acceptable either way. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={featured ? "accent" : "outline"}
                disabled={passPending || acceptPending}
                onClick={() => onAccept(request.id)}
                className={cn(
                  "h-10 flex-1 px-6 md:flex-none",
                  !featured && "text-[11px] font-semibold tracking-[1.2px] uppercase"
                )}
              >
                {t("card.accept")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("card.acceptTooltip")}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </article>
  );
}
