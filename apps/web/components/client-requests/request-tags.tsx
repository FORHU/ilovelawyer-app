"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import type { RequestUrgency } from "@/lib/client-handoff";
import { budgetChip } from "@/lib/client-requests/budget";
import type { CaseBrief } from "@/lib/client-requests/types";

const URGENCY_TONE = { URGENT: "danger", SOON: "caution", ROUTINE: "success" } as const satisfies Record<RequestUrgency, string>;

/** Case area, jurisdiction, budget and urgency chips — the inbox card and the detail page's header. */
export function RequestTags({ brief, muted = false }: { brief: Pick<CaseBrief, "caseAreas" | "ukJurisdiction" | "urgency" | "knownDeadline" | "budget">; muted?: boolean }) {
  const { t } = useTranslation("client-request");
  const budget = budgetChip(brief.budget);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {brief.caseAreas.map((area) => (
        <Badge key={area} shape="pill" className="py-1 tracking-[1px]">{area}</Badge>
      ))}
      {brief.ukJurisdiction && <Badge shape="pill" className="py-1 tracking-[1px]">{brief.ukJurisdiction}</Badge>}
      {budget && (
        <Badge shape="pill" className="py-1 tracking-[1px]">
          {[budget.amount && t(`budget.${budget.amount.key}`, budget.amount.values), budget.fee && t(`budget.${budget.fee}`)].filter(Boolean).join(" · ")}
        </Badge>
      )}
      {!muted && (
        <Badge shape="pill" tone={URGENCY_TONE[brief.urgency]} className="py-1 tracking-[1px]">
          {t(`urgency.${brief.urgency.toLowerCase()}`)}
          {brief.knownDeadline ? ` · ${t("detail.deadline", { date: brief.knownDeadline })}` : ""}
        </Badge>
      )}
    </div>
  );
}
