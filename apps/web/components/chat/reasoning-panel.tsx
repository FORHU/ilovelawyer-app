"use client";
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import type { MessageReasoning } from "@/lib/chat/mutations";

/** Renders the legal persona's "why this answer" explanation for one turn. Absence
 * (`reasoning` undefined/null) is normal — direct-answer turns with no lookups, or a
 * failed generation, both mean no data — so this renders nothing, not an empty shell. */
export function ReasoningPanel({ reasoning }: { reasoning?: MessageReasoning | null }) {
  const { t } = useTranslation("homepage");

  if (!reasoning?.reasoning) return null;

  return (
    <div className="mt-3 rounded-[14px] border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2.5 border-b border-border text-[12px]">
        <Lightbulb className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
        <span className="font-semibold text-foreground">{t("caseHub.reasoning")}</span>
      </div>
      <div className="p-3 space-y-2">
        <p className="text-[13px] leading-5 text-foreground">{reasoning.reasoning}</p>
        {reasoning.citationReasons.length > 0 && (
          <ul className="space-y-1.5">
            {reasoning.citationReasons.map((c, i) => (
              <li key={`${c.title}-${i}`} className="text-[12px] leading-4">
                <span className="font-semibold text-foreground">{c.title}</span>
                <span className="text-muted-foreground"> — {c.why_cited}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
