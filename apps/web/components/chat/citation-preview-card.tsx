"use client";
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { lawPreviewQueryOptions, type LawCategoryParam } from "@/lib/law/queries";
import type { CitationRankItem } from "@/lib/chat/mutations";

export interface CitationTarget {
  category: LawCategoryParam;
  id: string;
}

/** The hover card CitationLink floats over a chat citation: preview body + "Open in Library". */
export function CitationPreviewCard({
  target,
  href,
  label,
  rank,
}: {
  target: CitationTarget;
  href: string;
  label: React.ReactNode;
  rank?: CitationRankItem;
}) {
  return (
    <div className="w-[340px] max-w-[calc(100vw-24px)] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl animate-in fade-in-0 zoom-in-95 duration-150 motion-reduce:animate-none">
      <CitationPreviewBody target={target} label={label} />
      {rank && <CitationRankNote rank={rank} className="mt-3" />}
      {/* tabIndex -1: the citation link itself already opens this same URL, so for keyboard users
          the CTA would only be a redundant tab stop — it's here for the mouse. */}
      <CitationCta href={href} tabIndex={-1} className="mt-4" />
    </div>
  );
}

/** Why a cited authority got its tier, plus the line that says what the tier is not: it is a
 * reading aid based on the user's question, never a check that the authority or the advice is right. */
export function CitationRankNote({ rank, className }: { rank: CitationRankItem; className?: string }) {
  const { t } = useTranslation("library");
  return (
    <div className={cn("flex flex-col gap-1.5 border-t border-border pt-3 text-xs", className)}>
      <p className="font-semibold text-foreground">{t(`citationRank.${rank.tier.toLowerCase()}`)}</p>
      <dl className="flex flex-col gap-1">
        {rank.relevance && (
          <div>
            <dt className="inline font-medium text-foreground">{t("citationRank.relevanceLabel")}: </dt>
            <dd className="inline text-muted-foreground">{t(`citationRank.relevance.${rank.relevance.toLowerCase()}`)}</dd>
          </div>
        )}
        {rank.importance && (
          <div>
            <dt className="inline font-medium text-foreground">{t("citationRank.importanceLabel")}: </dt>
            <dd className="inline text-muted-foreground">{t(`citationRank.importance.${rank.importance.toLowerCase()}`)}</dd>
          </div>
        )}
      </dl>
      {rank.reason && <p className="text-muted-foreground">{rank.reason}</p>}
      <p className="text-muted-foreground">{t("citationRank.disclaimer")}</p>
    </div>
  );
}

/** Header layout mirrors the Library search result card (components/library/law-search-panel.tsx)
 * so a previewed citation reads as the same object the user lands on. Shared with the touch
 * bottom sheet, which supplies its own full-width CTA. */
export function CitationPreviewBody({ target, label }: { target: CitationTarget; label: React.ReactNode }) {
  const { t } = useTranslation("library");
  const { data, isPending, isError } = useQuery(lawPreviewQueryOptions(target.category, target.id));

  if (isPending) {
    return (
      <div className="flex flex-col gap-2.5" aria-busy="true">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-10" />
        </div>
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-[15px] leading-snug font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{t("citationPreview.unavailable")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
          {data.reference ?? label}
        </span>
        {data.year != null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{data.year}</span>}
      </div>
      {data.court && (
        <span className="w-fit rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {data.court}
        </span>
      )}
      <h3 className="line-clamp-3 text-[15px] leading-snug font-semibold text-foreground">{data.title}</h3>
      <p className="line-clamp-4 text-xs leading-relaxed text-muted-foreground italic">
        {data.snippet ?? t("citationPreview.noSummary")}
      </p>
    </div>
  );
}

/** The gold pill from the case portfolio's "New Case" button. Always a new tab, so opening a
 * citation never costs the user their place in the conversation. */
export function CitationCta({ href, className, ...rest }: Omit<React.ComponentProps<"a">, "href" | "target" | "rel"> & { href: string }) {
  const { t } = useTranslation("library");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full bg-brand-gold px-5 text-[11px] font-semibold tracking-[1.2px] text-white uppercase dark:text-brand-navy-950 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:outline-none",
        className,
      )}
      {...rest}
    >
      {t("citationPreview.openInLibrary")}
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}
