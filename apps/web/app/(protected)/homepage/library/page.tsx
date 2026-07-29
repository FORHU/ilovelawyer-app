"use client";
import React, { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Scale, Landmark, FileStack, ChevronRight, ChevronUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import LegalMarkdown from "@/components/library/legal-markdown";
import { useAnalyzeKeywordMutation } from "@/lib/legal-rag/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export default function LegalLibraryPage() {
  return (
    <Suspense fallback={null}>
      <LegalLibraryPageContent />
    </Suspense>
  );
}

function LegalLibraryPageContent() {
  const { t } = useTranslation("library");
  const [searchQuery, setSearchQuery] = useState("");
  const analyzeKeyword = useAnalyzeKeywordMutation();
  const searchParams = useSearchParams();
  const lastAppliedPrefillRef = useRef<string | null>(null);

  const runAnalysis = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    analyzeKeyword.mutate({ keyword: trimmed });
  };

  // Lets links into this page (e.g. the RESEARCH footer entries, or the quick-access
  // cards further down this page) deep-link straight into a query instead of landing
  // on an empty search box. Tracks the last applied value, rather than firing once ever,
  // so navigating from one ?q= link to another while already on this page still re-runs
  // the search.
  useEffect(() => {
    const prefill = searchParams.get("q");
    if (!prefill || prefill === lastAppliedPrefillRef.current) return;
    lastAppliedPrefillRef.current = prefill;
    runAnalysis(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runAnalysis(searchQuery);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">

      <GlobalHeader activeTab="library" />

      {/* CORE WORKSPACE FRAMEWORK CONTAINER */}
      <main className="w-full flex flex-col flex-1 pt-14">

        {/* HERO SEARCH SECTION */}
        <section className="relative bg-card border-b border-border overflow-hidden">
          <div className="w-full max-w-[1440px] mx-auto px-6 md:px-16 py-8 md:py-10 relative z-20">
            <div className="max-w-xl w-full flex flex-col gap-4">
              <h1 className="font-['Libre_Caslon_Text',serif] text-4xl md:text-5xl text-foreground font-normal leading-[1.1] tracking-tight">
                {t("hero.titlePrefix")} <span className="font-['Libre_Caslon_Text',serif] italic block mt-1">{t("hero.titleEmphasis")}</span>
              </h1>

              <form onSubmit={handleSearch} className="w-full bg-card border border-foreground rounded-lg flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 p-1.5 shadow-xl focus-within:ring-2 focus-within:ring-foreground/10 transition-shadow">
                <div className="flex items-center flex-1 min-w-0">
                  <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-3" aria-hidden="true" />
                  <input
                    type="text"
                    aria-label={t("hero.searchAriaLabel")}
                    className="flex-1 min-w-0 bg-transparent py-3 px-3 outline-none text-base text-foreground placeholder-muted-foreground"
                    placeholder={t("hero.searchPlaceholder")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="submit"
                      disabled={analyzeKeyword.isPending}
                      className="w-full sm:w-auto shrink-0 bg-primary text-primary-foreground text-xs font-semibold tracking-wider px-6 py-3.5 rounded-md hover:bg-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {analyzeKeyword.isPending ? t("hero.searching") : t("hero.queryAi")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Ask the AI to research this term across the library</TooltipContent>
                </Tooltip>
              </form>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-muted-foreground tracking-wider font-semibold uppercase">
                <span>{t("hero.quickAccess")}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => runAnalysis("Revised Penal Code")} className="bg-transparent border-0 border-b border-border p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs uppercase">{t("hero.revisedPenalCode")}</button>
                  </TooltipTrigger>
                  <TooltipContent>Look up the Revised Penal Code</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => runAnalysis("1987 Constitution")} className="bg-transparent border-0 border-b border-border p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs uppercase">{t("hero.constitution1987")}</button>
                  </TooltipTrigger>
                  <TooltipContent>Look up the 1987 Constitution</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => runAnalysis("Rule 130")} className="bg-transparent border-0 border-b border-border p-0 cursor-pointer text-muted-foreground hover:text-foreground hover:border-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs uppercase">{t("hero.rule130")}</button>
                  </TooltipTrigger>
                  <TooltipContent>Look up Rule 130 of the Rules of Court</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </section>

        {/* AI ANALYSIS RESULT */}
        {(analyzeKeyword.isPending || analyzeKeyword.isError || analyzeKeyword.data) && (
          <section className="bg-card border-b border-border py-8">
            <div className="max-w-[1440px] mx-auto px-6 md:px-16">
              <div className="max-w-3xl flex flex-col gap-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => analyzeKeyword.reset()}
                      className="self-end inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs"
                    >
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      {t("analysis.minimize")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Collapse this AI analysis</TooltipContent>
                </Tooltip>

                {analyzeKeyword.isPending && (
                  <p className="text-muted-foreground text-sm italic">{t("analysis.analyzing", { query: searchQuery })}</p>
                )}

                {analyzeKeyword.isError && (
                  <p className="text-red-600 dark:text-red-400 text-sm">{t("analysis.error")}</p>
                )}

                {analyzeKeyword.data && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-4">
                      <h2 className="font-['Libre_Caslon_Text',serif] text-2xl text-foreground">{analyzeKeyword.data.title}</h2>
                      <span className="shrink-0 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                        {analyzeKeyword.data.cached ? "Cached" : "Freshly generated"}
                      </span>
                    </div>

                    {analyzeKeyword.data.url && (
                      <a
                        href={analyzeKeyword.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-900 dark:text-blue-400 hover:underline"
                      >
                        {t("analysis.viewSource")}
                      </a>
                    )}

                    <LegalMarkdown content={analyzeKeyword.data.formatted_markdown} title={analyzeKeyword.data.title} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CLASSIFICATION SUMMARY CARDS */}
        <section className="bg-muted border-b border-border py-8">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 grid grid-cols-1 md:grid-cols-3 gap-5">

            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text',serif] text-lg text-foreground font-normal">{t("categories.codals.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{t("categories.codals.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 dark:text-blue-400 font-medium">
                <Link href="/homepage/civil-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.civilCode")}</Link>
                <Link href="/homepage/constitution" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.constitution1987")}</Link>
                <Link href="/homepage/revised-penal-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.revisedPenalCode")}</Link>
                <Link href="/homepage/labor-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.laborCode")}</Link>
                <Link href="/homepage/family-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.familyCode")}</Link>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text',serif] text-lg text-foreground font-normal">{t("categories.jurisprudence.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{t("categories.jurisprudence.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 dark:text-blue-400 font-medium">
                <Link href="/homepage/scra-archive" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.enBancDecisions")}</Link>
                <Link href="/homepage/scra-archive" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.divisionDecisions")}</Link>
                <Link href="/homepage/persuasive-rulings" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.lowerCourtRulings")}</Link>
                <Link href="/homepage/library/documents" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.indexedDecisions")}</Link>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text',serif] text-lg text-foreground font-normal">{t("categories.issuance.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <FileStack className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">{t("categories.issuance.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 dark:text-blue-400 font-medium">
                <Tooltip><TooltipTrigger asChild><Link href="/homepage/presidential-issuances" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.presidentialIssuances")}</Link></TooltipTrigger><TooltipContent>Browse presidential issuances</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Link href="/homepage/administrative-issuances" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.administrativeAgencyIssuances")}</Link></TooltipTrigger><TooltipContent>Browse administrative agency issuances</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Link href="/homepage/judicial-issuances" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.judicialIssuances")}</Link></TooltipTrigger><TooltipContent>Browse judicial issuances</TooltipContent></Tooltip>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}
