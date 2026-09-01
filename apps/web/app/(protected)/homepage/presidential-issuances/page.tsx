"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, FileStack, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Issuance {
  title: string;
  description: string;
}

const ISSUANCES: Issuance[] = [
  {
    title: "Executive Orders",
    description: "Acts of the President providing for rules of a general or permanent character in the implementation of a law.",
  },
  {
    title: "Proclamations",
    description: "Acts fixing a date or declaring a status or condition of public interest, such as holidays or states of calamity.",
  },
  {
    title: "Administrative Orders",
    description: "Acts of the President relating to particular aspects of governmental operations pursuant to their administrative duties.",
  },
  {
    title: "Memorandum Circulars",
    description: "Acts of the President on matters of administrative detail, or of subordinate or temporary interest.",
  },
];

export default function PresidentialIssuancesPage() {
  const tenantCodeGuard = usePhStatutoryContentGuard("presidential-issuances");
  if (tenantCodeGuard) return tenantCodeGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="presidential-issuances" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/homepage/library"
              className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Back to Library
            </Link>
          </TooltipTrigger>
          <TooltipContent>Return to the Library home</TooltipContent>
        </Tooltip>

        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Issuance</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Presidential <span className="italic">Issuances.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Instruments through which the President exercises executive power, classified under Book III of the
            1987 Administrative Code (Executive Order No. 292).
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Four Categories</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">How the executive branch's issuances are classified by function.</p>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {ISSUANCES.map((issuance) => (
              <div key={issuance.title} className="px-6 md:px-8 py-6 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <FileStack className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-medium text-foreground">{issuance.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{issuance.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 p-8 md:p-10 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[24px]">Search the archive with AI</h2>
              <p className="text-white/70 text-[14px] mt-1 max-w-md">
                Ask about a specific Executive Order or Proclamation and get a citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=Presidential%20Issuances"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search presidential issuances with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
