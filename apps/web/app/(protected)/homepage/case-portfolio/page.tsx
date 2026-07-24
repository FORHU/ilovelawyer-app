"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { Search, Plus, Briefcase, Loader2, AlertCircle } from "lucide-react";
import { useCasesQuery } from "@/lib/cases/mutations";

export default function CaseManagerDashboard() {
  const { t } = useTranslation("case-portfolio");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, isError, refetch } = useCasesQuery();
  const cases = data?.data ?? [];

  const filteredCases = cases.filter((item) => {
    const query = searchQuery.toLowerCase();
    return (
      item.caseName.toLowerCase().includes(query) ||
      (item.partyInvolved ?? "").toLowerCase().includes(query)
    );
  });

  const handleNewFiling = () => {
    router.push("/homepage/create-case");
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="case-portfolio" />

      {/* HERO BACKDROP — always navy regardless of theme, matching the header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 py-14 md:py-16">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-[1440px] w-full mx-auto px-6 md:px-16 flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text'] text-3xl md:text-4xl text-white font-normal tracking-[-0.6px]">
            {t("title")}
          </h1>
          <p className="text-white/70 text-sm max-w-md">
            {t("managingActiveProceedings", { count: cases.length })}
          </p>
        </div>
      </section>

      {/* Main Framework Dashboard Body */}
      <main className="max-w-[1440px] w-full mx-auto px-6 md:px-16 py-12 relative z-10 flex flex-col gap-10">

        <section className="flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-between w-full">
          <div className="relative w-full md:max-w-xl flex items-center">
            <span className="absolute left-4 text-muted-foreground">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("loading")}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-600">{t("loadError")}</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
            >
              {t("retry")}
            </button>
          </div>
        )}

        {!isLoading && !isError && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {filteredCases.map((c) => (
              <Link
                key={c.id}
                href={`/homepage/case-portfolio/${c.id}`}
                className="min-h-75 bg-card rounded-2xl border border-border p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="w-full">
                  <h3 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground font-normal leading-tight mb-2">
                    {c.caseName}
                  </h3>
                  <p className="text-muted-foreground text-[14px] font-['Inter']">
                    {c.partyInvolved || t("noPartyListed")}
                  </p>
                </div>

                <div className="border-t border-border pt-5 mt-8 flex items-end justify-between">
                  <div>
                    <span className="block text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                      {t("lastUpdated")}
                    </span>
                    <span className="text-foreground text-[14px] font-semibold">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}

            <button
              type="button"
              onClick={handleNewFiling}
              className="group min-h-75 border-2 border-dashed border-border bg-transparent hover:bg-card hover:border-primary/30 rounded-2xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors mb-3">
                <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
              </div>
              <span className="text-[12px] font-semibold tracking-[1.2px] text-muted-foreground group-hover:text-foreground transition-colors uppercase">
                {t("initiateNewFiling")}
              </span>
            </button>
          </section>
        )}

        {!isLoading && !isError && cases.length > 0 && filteredCases.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-foreground mb-2">{t("noMatchingCases")}</h4>
            <p className="text-muted-foreground text-[15px] max-w-[320px]">
              {t("noMatchingCasesHint")}
            </p>
          </div>
        )}
      </main>

      {/* SYSTEMATIC LEGAL FOOTER BLOCK */}
      <footer className="w-full bg-card border-t border-border py-16 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between gap-12">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-foreground">ilovelawyer</span>
            <p className="text-sm text-muted-foreground leading-relaxed font-normal">
              Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
            </p>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-1">
              © 2026 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-muted-foreground">
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-foreground tracking-wider uppercase text-[11px]">RESEARCH</span>
              <a href="#const" className="hover:text-foreground font-normal">Constitution</a>
              <a href="#civil" className="hover:text-foreground font-normal">Civil Code</a>
              <a href="#scra" className="hover:text-foreground font-normal">SCRA Archive</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-foreground tracking-wider uppercase text-[11px]">LEGAL</span>
              <Link href="/homepage/term" className="hover:text-foreground font-normal">Privacy Policy</Link>
              <Link href="/homepage/term" className="hover:text-foreground font-normal">Terms of Use</Link>
              <Link href="/homepage/term" className="hover:text-foreground font-normal">Ethics Policy</Link>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-foreground tracking-wider uppercase text-[11px]">CONNECT</span>
              <a href="#support" className="hover:text-foreground font-normal">Support Center</a>
              <a href="#media" className="hover:text-foreground font-normal">Media Inquiries</a>
              <a href="#contact" className="hover:text-foreground font-normal">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
