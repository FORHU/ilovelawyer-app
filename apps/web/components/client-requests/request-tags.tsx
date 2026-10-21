"use client";

import { useTranslation } from "react-i18next";
import { Badge } from "@workspace/ui/components/badge";
import type { ClientRequest, RequestUrgency } from "@/lib/client-requests/types";

const URGENCY_TONE = { high: "danger", medium: "caution", low: "success" } as const satisfies Record<RequestUrgency, string>;

/** Practice area, jurisdiction and urgency chips — the header row of a request card and the detail page. */
export function RequestTags({ request, muted = false }: { request: ClientRequest; muted?: boolean }) {
  const { t } = useTranslation("client-request");
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge shape="pill" className="py-1 tracking-[1px]">{request.practiceArea}</Badge>
      <Badge shape="pill" className="py-1 tracking-[1px]">{request.jurisdiction}</Badge>
      {!muted && (
        <Badge shape="pill" tone={URGENCY_TONE[request.urgency]} className="py-1 tracking-[1px]">
          {t(`urgency.${request.urgency}`)}
          {request.urgencyNote ? ` · ${request.urgencyNote}` : ""}
        </Badge>
      )}
    </div>
  );
}
