"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import GlobalFooter from "@/components/global-footer";
import CustomSelect from "@/components/ui/custom-select";
import { Search, Plus, Briefcase } from "lucide-react";

type CaseRecord = {
  id: number;
  title: string;
  docket: string;
  category: string;
  metaLabel: string;
  metaValue: string;
  statusText: string;
  badge: string | null;
};

const initialCases: CaseRecord[] = [];

// Soft, muted category colors — quick visual scanning without turning the grid into a rainbow.
const CATEGORY_STYLES: Record<string, string> = {
  "CIVIL CASE": "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  "FAMILY LAW": "bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300",
  "LABOR RELATIONS": "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  "CRIMINAL LAW": "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  "COMMERCIAL": "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
};

export default function CaseManagerDashboard() {
  const { t } = useTranslation("case-portfolio");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const categories = ["All", ...new Set(initialCases.map(c => c.category))];
  const filterOptions = categories.map((cat) => ({
    value: cat,
    label: cat === "All" ? t("all") : t("statusOption", { category: cat }),
  }));

  const filteredCases = initialCases.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.docket.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterCategory === "All" || item.category === filterCategory;
    return matchesSearch && matchesFilter;
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
            {t("managingActiveProceedings", { count: initialCases.length })}
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
              className="w-full bg-white border border-gray-300 rounded-xl py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm hover:border-gray-400 focus:border-black focus:ring-2 focus:ring-black/5 transition-colors"
              placeholder="Search by case name, docket number, or client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <label htmlFor="filterCategory" className="text-[12px] font-semibold tracking-[1.2px] text-gray-500 whitespace-nowrap uppercase">
              FILTER BY
            </label>
            <CustomSelect
              id="filterCategory"
              value={filterCategory}
              onChange={setFilterCategory}
              options={filterOptions}
              className="min-w-52 shadow-sm"
            />
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
          {filteredCases.map((c) => (
            <article
              key={c.id}
              className="min-h-75 bg-card rounded-2xl border border-border p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <span className={`text-[11px] font-semibold tracking-[1.2px] uppercase px-2.5 py-1 rounded-full ${CATEGORY_STYLES[c.category] ?? "bg-muted text-muted-foreground"}`}>
                    {c.category}
                  </span>
                  {c.badge && (
                    <span className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 text-[10px] font-bold px-2 py-1 rounded-full tracking-wide">
                      {c.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground font-normal leading-tight mb-2">
                  {c.title}
                </h3>
                <p className="text-muted-foreground text-[14px] font-['Inter']">
                  {c.docket}
                </p>
              </div>

              <div className="border-t border-border pt-5 mt-8 flex items-end justify-between">
                <div>
                  <span className="block text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                    {c.metaLabel}
                  </span>
                  <span className="text-foreground text-[14px] font-semibold">
                    {c.metaValue}
                  </span>
                </div>
                <span className="text-muted-foreground text-[12px] italic">
                  {c.statusText}
                </span>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={handleNewFiling}
            className="group min-h-75 border-2 border-dashed border-border bg-transparent hover:bg-card hover:border-primary/30 rounded-2xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors mb-3">
              <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <span className="text-[12px] font-semibold tracking-[1.2px] text-gray-500 group-hover:text-[#131a33] transition-colors uppercase">
              Initiate New Filing
            </span>
          </button>
        </section>

        {initialCases.length > 0 && filteredCases.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-[#181c1e] mb-2">No matching cases</h4>
            <p className="text-gray-500 text-[15px] max-w-[320px]">
              Try a different search term, or clear the category filter above.
            </p>
          </div>
        )}
      </main>

      {/* SYSTEMATIC LEGAL FOOTER BLOCK */}
      <footer className="w-full bg-white border-t border-gray-200 py-16 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between gap-12">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">ilovelawyer</span>
            <p className="text-sm text-gray-500 leading-relaxed font-normal">
              Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">
              © 2026 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-gray-500">
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">RESEARCH</span>
              <a href="#const" className="hover:text-black font-normal">Constitution</a>
              <a href="#civil" className="hover:text-black font-normal">Civil Code</a>
              <a href="#scra" className="hover:text-black font-normal">SCRA Archive</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">LEGAL</span>
              <a href="/homepage/term" className="hover:text-black font-normal">Privacy Policy</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Terms of Use</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Ethics Policy</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">CONNECT</span>
              <a href="#support" className="hover:text-black font-normal">Support Center</a>
              <a href="#media" className="hover:text-black font-normal">Media Inquiries</a>
              <a href="#contact" className="hover:text-black font-normal">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
