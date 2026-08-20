"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { Search, Plus, Briefcase, Loader2, AlertCircle } from "lucide-react";
import { useCasesQuery } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export default function TerminalLandingPage() {
  const { t } = useTranslation("terminal");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const { data, isLoading, isError, refetch } = useCasesQuery(1, 20, debouncedSearch);
  const cases = data?.data ?? [];

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="terminal" />

      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 py-14 md:py-16">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-[1440px] w-full mx-auto px-6 md:px-16 flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text'] text-3xl md:text-4xl text-white font-normal tracking-[-0.6px]">
            {t("landing.title")}
          </h1>
          <p className="text-white/70 text-sm max-w-md">{t("landing.subtitle")}</p>
        </div>
      </section>

      <main className="max-w-[1440px] w-full mx-auto px-6 md:px-16 py-12 relative z-10 flex flex-col gap-10">
        <section className="flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-between w-full">
          <div className="relative w-full md:max-w-xl flex items-center">
            <span className="absolute left-4 text-muted-foreground">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors"
              placeholder={t("landing.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("landing.loading")}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-600">{t("landing.loadError")}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  {t("landing.retry")}
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("landing.retry")}</TooltipContent>
            </Tooltip>
          </div>
        )}

        {!isLoading && !isError && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {cases.map((c) => (
              <div
                key={c.id}
                className="relative min-h-75 bg-card rounded-2xl border border-border p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/homepage/terminal/${c.id}`} className="w-full">
                      <h3 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground font-normal leading-tight mb-2">
                        {c.caseName}
                      </h3>
                      <p className="text-muted-foreground text-[14px] font-['Inter']">
                        {c.parties.length > 0 ? c.parties.map((p) => p.name).join(", ") : t("landing.noPartyListed")}
                      </p>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{t("landing.openTerminal")}</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/homepage/terminal/${c.id}`} className="border-t border-border pt-5 mt-8 flex items-end justify-between">
                      <div>
                        <span className="block text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                          {t("landing.lastUpdated")}
                        </span>
                        <span className="text-foreground text-[14px] font-semibold">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {t("landing.openTerminal")}
                      </span>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>{t("landing.openTerminal")}</TooltipContent>
                </Tooltip>
              </div>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => router.push("/homepage/create-case?next=terminal")}
                  className="group min-h-75 border-2 border-dashed border-border bg-transparent hover:bg-card hover:border-primary/30 rounded-2xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors mb-3">
                    <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                  </div>
                  <span className="text-[12px] font-semibold tracking-[1.2px] text-muted-foreground group-hover:text-foreground transition-colors uppercase text-center">
                    {t("landing.createCase")}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("landing.createCase")}</TooltipContent>
            </Tooltip>
          </section>
        )}

        {!isLoading && !isError && debouncedSearch !== "" && cases.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-foreground mb-2">{t("landing.noMatchingCases")}</h4>
            <p className="text-muted-foreground text-[15px] max-w-[320px]">{t("landing.noMatchingCasesHint")}</p>
          </div>
        )}
      </main>
    </div>
  );
}
