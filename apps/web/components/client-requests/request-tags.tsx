"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import type { RequestUrgency } from "@/lib/client-handoff";
import type { CaseBrief } from "@/lib/client-requests/types";

const URGENCY_TONE = { URGENT: "danger", SOON: "caution", ROUTINE: "success" } as const satisfies Record<RequestUrgency, string>;

/** Practice area, jurisdiction and urgency chips — the inbox card and the detail page's header. */
export function RequestTags({ brief, muted = false }: { brief: Pick<CaseBrief, "practiceArea" | "ukJurisdiction" | "urgency" | "knownDeadline">; muted?: boolean }) {
  const { t } = useTranslation("client-request");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {brief.practiceArea && <Badge shape="pill" className="py-1 tracking-[1px]">{brief.practiceArea}</Badge>}
      {brief.ukJurisdiction && <Badge shape="pill" className="py-1 tracking-[1px]">{brief.ukJurisdiction}</Badge>}
      {!muted && (
        <Badge shape="pill" tone={URGENCY_TONE[brief.urgency]} className="py-1 tracking-[1px]">
          {t(`urgency.${brief.urgency.toLowerCase()}`)}
          {brief.knownDeadline ? ` · ${t("detail.deadline", { date: brief.knownDeadline })}` : ""}
        </Badge>
      )}
    </div>
  );
}
