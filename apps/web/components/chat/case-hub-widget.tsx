"use client";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Grid2x2, Loader2, ExternalLink, BadgeCheck } from "lucide-react";
import { useCaseQuery } from "@/lib/cases/mutations";
import { useRelatedCasesQuery, type RelatedCase } from "@/lib/chat/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function CaseHubWidget({
  caseId,
  consultationId,
}: {
  /** Explicit link for this consultation, if any (e.g. arrived via a case's "Start Chat"
   * action, or tagged on the consultation when the case was created from within it). Null
   * means this consultation has no case of its own — must NOT fall back to some other
   * case (e.g. the most recently updated one), or a case created in one chat would bleed
   * into every other unrelated consultation's hub. */
  caseId: string | null;
  /** Consultation the related-cases panel pulls legal-precedent citations for — those are
   * surfaced by the AI's latest reply in this consultation, not tied to `caseId` at all. */
  consultationId: string | null;
}) {
  const { t } = useTranslation("homepage");

  const { data: caseRecord } = useCaseQuery(caseId ?? "");
  const { data: relatedData, isLoading: isLoadingRelated } = useRelatedCasesQuery(consultationId ?? undefined);
  const relatedCases = relatedData?.relatedCases ?? [];

  // A case is linked/available but its full record hasn't loaded yet — don't flash the
  // "no case" layout while that's in flight.
  if (caseId && !caseRecord) {
    return (
      <section className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseHub.loadingCase")}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {caseRecord && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/homepage/case-portfolio/${caseId}`}
                className="flex items-center gap-2 font-['Libre_Caslon_Text'] text-[15px] uppercase tracking-wide text-foreground min-w-0 hover:text-primary transition-colors"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold shadow-[0_0_0_3px_rgba(246,196,69,0.15)]" aria-hidden="true" />
                <span className="truncate">{caseRecord.caseName}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Open {caseRecord.caseName}&rsquo;s full record</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[13px] font-semibold text-foreground">
        <Grid2x2 className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
        {t("caseHub.relatedCases")}
        {relatedCases.length > 0 && <span className="text-muted-foreground font-normal">· {relatedCases.length}</span>}
      </div>

      <div className="max-h-[280px] overflow-y-auto px-4 py-3">
        <HubRelatedCases entries={relatedCases} isLoading={isLoadingRelated} emptyLabel={t("caseHub.relatedEmpty")} />
      </div>
    </section>
  );
}

/** Renders legal-precedent citations (source, not the user's own cases) surfaced by the
 * consultation's latest assistant reply. */
function HubRelatedCases({
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
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => {
        const label = entry.title || entry.case_number || t("caseHub.untitledCitation");
        const Wrapper = entry.url ? "a" : "div";
        return (
          <Wrapper
            key={`${entry.case_number ?? entry.title ?? "citation"}-${i}`}
            {...(entry.url ? { href: entry.url, target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`flex w-full flex-col gap-1 rounded-xl border border-border p-3 text-left transition-colors ${
              entry.url ? "cursor-pointer hover:bg-muted/60 hover:border-brand-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40" : ""
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
