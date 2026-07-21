"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
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
  "CIVIL CASE": "bg-blue-50 text-blue-700",
  "FAMILY LAW": "bg-purple-50 text-purple-700",
  "LABOR RELATIONS": "bg-emerald-50 text-emerald-700",
  "CRIMINAL LAW": "bg-red-50 text-red-700",
  "COMMERCIAL": "bg-amber-50 text-amber-700",
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
    <div className="min-h-screen w-full relative flex flex-col bg-slate-50 text-[#181c1e] font-['Inter',sans-serif]">
      <GlobalHeader activeTab="case-portfolio" />

      {/* HERO BACKDROP */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1c2547] to-[#0b132b] py-14 md:py-16">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-[#ffe088]/10 blur-3xl" aria-hidden="true" />
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
            <span className="absolute left-4 text-gray-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              className="w-full bg-white border border-gray-300 rounded-xl py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm hover:border-gray-400 focus:border-black focus:ring-2 focus:ring-black/5 transition-colors"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <label htmlFor="filterCategory" className="text-[12px] font-semibold tracking-[1.2px] text-gray-500 whitespace-nowrap uppercase">
              {t("filterBy")}
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
              className="min-h-75 bg-white rounded-2xl border border-gray-200 p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="w-full">
                <div className="flex items-center justify-between mb-6">
                  <span className={`text-[11px] font-semibold tracking-[1.2px] uppercase px-2.5 py-1 rounded-full ${CATEGORY_STYLES[c.category] ?? "bg-slate-100 text-slate-600"}`}>
                    {c.category}
                  </span>
                  {c.badge && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-full tracking-wide">
                      {c.badge}
                    </span>
                  )}
                </div>

                <h3 className="font-['Libre_Caslon_Text'] text-[24px] text-black font-normal leading-tight mb-2">
                  {c.title}
                </h3>
                <p className="text-gray-500 text-[14px] font-['Inter']">
                  {c.docket}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-5 mt-8 flex items-end justify-between">
                <div>
                  <span className="block text-gray-500 text-[10px] uppercase font-semibold tracking-wider mb-1">
                    {c.metaLabel}
                  </span>
                  <span className="text-[#181c1e] text-[14px] font-semibold">
                    {c.metaValue}
                  </span>
                </div>
                <span className="text-gray-500 text-[12px] italic">
                  {c.statusText}
                </span>
              </div>
            </article>
          ))}

          <button
            type="button"
            onClick={handleNewFiling}
            className="group min-h-75 border-2 border-dashed border-gray-300 bg-transparent hover:bg-white hover:border-[#131a33]/30 rounded-2xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#131a33]/30"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-gray-400 group-hover:bg-[#131a33]/5 group-hover:text-[#131a33] transition-colors mb-3">
              <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
            </div>
            <span className="text-[12px] font-semibold tracking-[1.2px] text-gray-500 group-hover:text-[#131a33] transition-colors uppercase">
              {t("initiateNewFiling")}
            </span>
          </button>
        </section>

        {initialCases.length > 0 && filteredCases.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 text-gray-300 shadow-sm">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-[#181c1e] mb-2">{t("noMatchingCases")}</h4>
            <p className="text-gray-500 text-[15px] max-w-[320px]">
              {t("noMatchingCasesHint")}
            </p>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
