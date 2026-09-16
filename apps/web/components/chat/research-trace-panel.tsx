"use client";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { ResearchTraceList } from "@/components/chat/research-trace-list";
import type { TraceStep } from "@/lib/chat/mind-map-parser";

/** Same card shell as ReasoningPanel, for a *finished* research trace — the persisted
 * counterpart to the live ResearchTraceList shown in place of ThinkingIndicator while a
 * message is still streaming (see consultation-chat.tsx). Absence is normal (a turn with no
 * tool calls, or one sent before this shipped), so this renders nothing rather than an empty
 * shell, same convention as ReasoningPanel. */
export function ResearchTracePanel({ steps }: { steps?: TraceStep[] }) {
  const { t } = useTranslation("homepage");

  if (!steps || steps.length === 0) return null;

  return (
    <div className="mt-3 rounded-[14px] border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-border text-[12px]">
        <Search className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
        <span className="font-semibold text-foreground">{t("caseHub.researchSteps")}</span>
      </div>
      <div className="p-3">
        <ResearchTraceList steps={steps} maxVisible={steps.length} />
      </div>
    </div>
  );
}
