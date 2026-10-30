"use client";

import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@workspace/ui/lib/utils";
import { stepPosition } from "@/lib/client-requests/request-meta";
import type { ClientRequestForLawyer } from "@/lib/client-requests/types";

const STEPS = ["received", "accepted", "quoted", "confirmed", "engaged"] as const;

/** "29 Oct, 10:43" */
function when(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

/**
 * Where the request is on its five steps, and what the client sees at each one — so a lawyer knows
 * what the client is looking at while they work. Nothing for a request that expired or was
 * withdrawn: it never got past the first step.
 */
export function RequestStepper({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  const position = stepPosition(request.status);
  if (position === null) return null;

  // The times the API gives; a step with none shows no time rather than a guess.
  const times = [request.routedAt, request.claim?.claimedAt, request.quote?.sentAt, null, request.engagement?.engagedAt].map(when);

  return (
    <ol aria-label={t("detail.steps.label")} className="grid gap-5 rounded-2xl border border-border bg-card p-5 sm:grid-cols-5 sm:gap-4">
      {STEPS.map((step, i) => {
        const state = i < position ? "done" : i === position ? "current" : "upcoming";
        const last = i === STEPS.length - 1;
        return (
          <li key={step} aria-current={state === "current" ? "step" : undefined} className="flex flex-col gap-2">
            <div className="flex items-center gap-2" aria-hidden="true">
              <span
                className={cn(
                  "flex size-[26px] shrink-0 items-center justify-center rounded-full border-[1.5px] text-[11px] font-bold",
                  state === "done" && "border-foreground bg-foreground text-background",
                  state === "current" && "border-brand-gold bg-background text-brand-gold",
                  state === "upcoming" && "border-border text-muted-foreground"
                )}
              >
                {state === "done" ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              {!last && <span className={cn("hidden h-0.5 flex-1 sm:block", i < position ? "bg-foreground" : "bg-border")} />}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className={cn("text-[14px]", state === "upcoming" ? "text-muted-foreground" : "font-medium text-foreground")}>
                {t(`detail.steps.${step}`)}
                {/* The dot above is decorative, so say where this step stands. */}
                <span className="sr-only"> — {t(`detail.steps.state.${state}`)}</span>
              </span>
              {state !== "upcoming" && times[i] && <span className="text-xs text-muted-foreground">{times[i]}</span>}
            </div>
            <span className="self-start rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
              {t("detail.steps.clientSees", { what: t(`detail.steps.see.${step}`) })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
