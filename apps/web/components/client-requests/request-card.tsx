"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { cn } from "@workspace/ui/lib/utils";
import { formatTimeAgo } from "@/lib/client-requests/queries";
import type { ClientRequest } from "@/lib/client-requests/types";
import { RequestTags } from "./request-tags";

interface RequestCardProps {
  request: ClientRequest;
  /** Only the first card in the list is raised, as in the mock-up — it's the one to act on. */
  featured?: boolean;
  onPass: (id: string) => void;
  onAccept: (id: string) => void;
}

const META = "text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground";

export function RequestCard({ request, featured = false, onPass, onAccept }: RequestCardProps) {
  const { t } = useTranslation("client-request");
  const taken = request.status === "taken";

  return (
    // One markup for both breakpoints: actions stack under the copy on mobile, sit to its right from md.
    <article
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6",
        taken ? "bg-card/50 opacity-60" : featured ? "bg-background shadow-md" : "bg-card"
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <RequestTags request={request} muted={taken} />
        <h2
          className={cn(
            "text-[15px] leading-snug font-semibold text-foreground sm:text-base",
            taken && "font-medium text-muted-foreground line-through"
          )}
        >
          {request.title}
        </h2>
        {!taken && <p className="max-w-[860px] text-[13px] leading-relaxed text-muted-foreground">{request.summary}</p>}
        {!taken && (
          <p className={cn("flex flex-wrap gap-x-4 gap-y-1", META)}>
            <span>{t("card.received", { ago: formatTimeAgo(request.receivedAt) })}</span>
            <span>{t("card.documents", { count: request.documentCount })}</span>
            <span>{t("card.helpers", { count: request.helperCount })}</span>
          </p>
        )}
      </div>

      {taken ? (
        <Badge shape="pill" className="self-start py-1 tracking-[1px] md:self-center">
          {t("card.taken")}
        </Badge>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => onPass(request.id)}
                className="h-10 flex-1 px-6 text-[11px] font-semibold tracking-[1.2px] uppercase md:flex-none"
              >
                {t("card.pass")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("card.passTooltip")}</TooltipContent>
          </Tooltip>
          {/* Only the first (newest/most urgent) card carries the page's one gold CTA; the rest
              stay Pass-only in the mock-up, but every open request must remain acceptable. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant={featured ? "accent" : "outline"}
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
