"use client";
import { useTranslation } from "react-i18next";
import { Loader2, ExternalLink, BadgeCheck } from "lucide-react";
import type { RelatedCase } from "@/lib/chat/mutations";

/** Renders legal-precedent citations (source, not the user's own cases) surfaced by the
 * consultation's latest assistant reply. */
export function HubRelatedCases({
  entries,
  isLoading,
  emptyLabel,
}: {
  entries: RelatedCase[];
  isLoading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation("homepage");

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseHub.loadingRelated")}
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {entries.map((entry, i) => {
        const label = entry.title || entry.case_number || t("caseHub.untitledCitation");
        const Wrapper = entry.url ? "a" : "div";
        return (
          <Wrapper
            key={`${entry.case_number ?? entry.title ?? "citation"}-${i}`}
            {...(entry.url ? { href: entry.url, target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`flex w-full flex-col gap-1 rounded-xl border border-border bg-background p-3 text-left transition-colors ${
              entry.url ? "cursor-pointer hover:border-brand-gold/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground line-clamp-2">{label}</span>
              {entry.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
            {entry.case_number && entry.title && (
              <div className="text-[11px] text-muted-foreground">{entry.case_number}</div>
            )}
            {entry.snippet && <p className="line-clamp-2 text-[12px] text-muted-foreground">{entry.snippet}</p>}
            {entry.vetted && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <BadgeCheck className="h-3 w-3 text-brand-gold" aria-hidden="true" />
                {t("caseHub.vetted")}
              </span>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}
