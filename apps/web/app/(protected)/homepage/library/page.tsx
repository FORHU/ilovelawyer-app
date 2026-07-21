"use client";
import React, { useState } from "react";
import Link from "next/link";
import { Search, Scale, Landmark, FileStack, ChevronRight, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import LegalMarkdown from "@/components/library/legal-markdown";
import { useAnalyzeKeywordMutation } from "@/lib/legal-rag/mutations";

export default function LegalLibraryPage() {
  const { t } = useTranslation("library");
  const [searchQuery, setSearchQuery] = useState("");
  const analyzeKeyword = useAnalyzeKeywordMutation();

  const runAnalysis = (keyword: string) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    setSearchQuery(trimmed);
    analyzeKeyword.mutate({ keyword: trimmed });
  };

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    runAnalysis(searchQuery);
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-linear-to-b from-slate-50 to-blue-50/50 text-[#181c1e] font-['Inter',sans-serif]">

      <GlobalHeader activeTab="library" />

      {/* CORE WORKSPACE FRAMEWORK CONTAINER */}
      <main className="w-full flex flex-col flex-1 pt-14">

        {/* HERO SEARCH SECTION */}
        <section className="relative bg-white border-b border-gray-200 overflow-hidden">
          <div className="w-full max-w-[1440px] mx-auto px-6 md:px-16 py-8 md:py-10 relative z-20">
            <div className="max-w-xl w-full flex flex-col gap-4">
              <h1 className="font-['Libre_Caslon_Text'] text-4xl md:text-5xl text-black font-normal leading-[1.1] tracking-tight">
                {t("hero.titlePrefix")} <span className="font-['Liberation_Serif'] italic block mt-1">{t("hero.titleEmphasis")}</span>
              </h1>

              <form onSubmit={handleSearch} className="w-full bg-white border border-black rounded-lg flex items-center p-1.5 shadow-xl focus-within:ring-2 focus-within:ring-black/10 transition-shadow">
                <Search className="w-4 h-4 text-gray-400 shrink-0 ml-3" aria-hidden="true" />
                <input
                  type="text"
                  aria-label={t("hero.searchAriaLabel")}
                  className="flex-1 bg-transparent py-3 px-3 outline-none text-base text-gray-800 placeholder-gray-400"
                  placeholder={t("hero.searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={analyzeKeyword.isPending}
                  className="bg-black text-white text-xs font-semibold tracking-wider px-6 py-3.5 rounded-md hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {analyzeKeyword.isPending ? t("hero.searching") : t("hero.queryAi")}
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] text-gray-500 tracking-wider font-semibold uppercase">
                <span>{t("hero.quickAccess")}</span>
                <button type="button" onClick={() => runAnalysis("Revised Penal Code")} className="bg-transparent border-0 border-b border-gray-300 p-0 cursor-pointer text-gray-600 hover:text-black hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded-xs uppercase">{t("hero.revisedPenalCode")}</button>
                <button type="button" onClick={() => runAnalysis("1987 Constitution")} className="bg-transparent border-0 border-b border-gray-300 p-0 cursor-pointer text-gray-600 hover:text-black hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded-xs uppercase">{t("hero.constitution1987")}</button>
                <button type="button" onClick={() => runAnalysis("Rule 130")} className="bg-transparent border-0 border-b border-gray-300 p-0 cursor-pointer text-gray-600 hover:text-black hover:border-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded-xs uppercase">{t("hero.rule130")}</button>
              </div>
            </div>
          </div>
        </section>

        {/* AI ANALYSIS RESULT */}
        {(analyzeKeyword.isPending || analyzeKeyword.isError || analyzeKeyword.data) && (
          <section className="bg-white border-b border-gray-200 py-8">
            <div className="max-w-[1440px] mx-auto px-6 md:px-16">
              <div className="max-w-3xl">
                {analyzeKeyword.isPending && (
                  <p className="text-gray-500 text-sm italic">{t("analysis.analyzing", { query: searchQuery })}</p>
                )}

                {analyzeKeyword.isError && (
                  <p className="text-red-600 text-sm">{t("analysis.error")}</p>
                )}

                {analyzeKeyword.data && (
                  <div className="flex flex-col gap-4">
                    <h2 className="font-['Libre_Caslon_Text'] text-2xl text-black">{analyzeKeyword.data.title}</h2>

                    {analyzeKeyword.data.url && (
                      <a
                        href={analyzeKeyword.data.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-900 hover:underline"
                      >
                        {t("analysis.viewSource")}
                      </a>
                    )}

                    <LegalMarkdown content={analyzeKeyword.data.formatted_markdown} />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CLASSIFICATION SUMMARY CARDS */}
        <section className="bg-slate-100 border-b border-gray-200 py-8">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 grid grid-cols-1 md:grid-cols-3 gap-5">

            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">{t("categories.codals.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                  <Scale className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{t("categories.codals.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#civil-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.civilCode")}</a>
                <a href="#revised-penal-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.revisedPenalCode")}</a>
                <a href="#labor-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.laborCode")}</a>
                <a href="#family-code" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.codals.familyCode")}</a>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">{t("categories.jurisprudence.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{t("categories.jurisprudence.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#scra" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.enBancDecisions")}</a>
                <a href="#gr-search" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.divisionDecisions")}</a>
                <a href="#en-banc" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.jurisprudence.lowerCourtRulings")}</a>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-3 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
              <div className="flex justify-between items-center">
                <h3 className="font-['Libre_Caslon_Text'] text-lg text-black font-normal">{t("categories.issuance.title")}</h3>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
                  <FileStack className="h-4 w-4" aria-hidden="true" />
                </div>
              </div>
              <p className="text-gray-500 text-sm leading-relaxed">{t("categories.issuance.description")}</p>
              <div className="mt-1 flex flex-col gap-2 text-xs text-blue-900 font-medium">
                <a href="#commentaries" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.presidentialIssuances")}</a>
                <a href="#journals" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.administrativeAgencyIssuances")}</a>
                <a href="#bar-review" className="flex items-center gap-1.5 hover:underline"><ChevronRight className="w-3 h-3 shrink-0" aria-hidden="true" />{t("categories.issuance.judicialIssuances")}</a>
              </div>
            </div>

          </div>
        </section>

        {/* EDITORIAL BENTO CONTAINER */}
        <section className="bg-white py-10">
          <div className="max-w-[1440px] mx-auto px-6 md:px-16 grid grid-cols-1 lg:grid-cols-2 gap-8">

            <div className="flex flex-col gap-4">
              <div className="h-48 relative rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 overflow-hidden group flex items-center justify-center">
                <Scale className="w-16 h-16 text-[#131a33]/10" strokeWidth={1} aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold tracking-widest text-amber-700 uppercase">{t("bento.statutesLabel")}</span>
                <h2 className="font-['Libre_Caslon_Text'] text-2xl text-black">{t("bento.statutesTitle")}</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  {t("bento.statutesDescription")}
                </p>
                <ul className="mt-1 flex flex-col gap-2 text-xs text-gray-800 font-normal pl-1">
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> {t("bento.civilCodeOfPhilippines")}
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> {t("bento.revisedPenalCode")}
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1 w-1 bg-black rounded-full" /> {t("bento.laborCodeOfPhilippines")}
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="bg-gradient-to-br from-[#1c2547] to-[#0b132b] text-white rounded-2xl p-6 flex flex-col justify-between h-48 relative overflow-hidden">
                <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-[#ffe088]/10 blur-3xl" aria-hidden="true" />
                <div className="relative z-10 flex flex-col gap-2">
                  <span className="text-xs font-semibold tracking-widest text-[#ffe088] uppercase">{t("bento.jurisprudenceLabel")}</span>
                  <h3 className="font-['Libre_Caslon_Text'] text-xl italic font-normal text-white">{t("bento.supremeCourtReports")}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-sm mt-1">
                    {t("bento.supremeCourtReportsDescription")}
                  </p>
                </div>
                <div className="relative z-10 flex items-end justify-between w-full border-t border-slate-700 pt-4">
                  <div>
                    <div className="font-['Libre_Caslon_Text'] text-2xl text-[#ffe088] font-normal">AI</div>
                    <div className="text-[9px] font-medium text-slate-400 tracking-wider uppercase">{t("bento.doctrineExtraction")}</div>
                  </div>
                  <Link
                    href="/homepage/library/documents"
                    aria-label={t("bento.exploreSupremeCourtReports")}
                    className="w-12 h-12 rounded-full border border-slate-500 hover:border-white hover:bg-white/5 flex items-center justify-center text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  >
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <h4 className="text-xs font-semibold tracking-wider text-gray-500 uppercase border-b pb-2">
                  {t("bento.recentDecisions")}
                </h4>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-500 tracking-wide font-medium">G.R. NO. 251000</span>
                    <span className="text-base font-bold text-gray-800">People vs. Dela Cruz</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-500 tracking-wide font-medium">G.R. NO. 248123</span>
                    <span className="text-base font-bold text-gray-800">Ayala Land vs. CIR</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-gray-500 tracking-wide font-medium">G.R. NO. 260555</span>
                    <span className="text-base font-bold text-gray-800">Santos vs. Court of Appeals</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>
      </main>

      <SiteFooter compact />

    </div>
  );
}
