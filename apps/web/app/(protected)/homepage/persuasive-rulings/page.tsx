"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Landmark, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Source {
  title: string;
  description: string;
}

const SOURCES: Source[] = [
  {
    title: "Court of Appeals Decisions",
    description: "Binding on the parties to the specific case, but merely persuasive authority in other cases — even before other divisions of the same court.",
  },
  {
    title: "Sandiganbayan & Court of Tax Appeals Decisions",
    description: "Specialized collegiate courts whose rulings carry persuasive weight within their respective jurisdictions over graft cases and tax disputes.",
  },
  {
    title: "Regional Trial Court and First-Level Court Decisions",
    description: "Trial court rulings bind only the parties before them and create no precedent for other courts to follow.",
  },
  {
    title: "Foreign and Comparative Jurisprudence",
    description: "Cited only where Philippine law and jurisprudence are silent, and only as persuasive, never binding, authority.",
  },
];

export default function PersuasiveRulingsPage() {
  const tenantCodeGuard = usePhStatutoryContentGuard("persuasive-rulings");
  if (tenantCodeGuard) return tenantCodeGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="persuasive-rulings" />

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
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Jurisprudence</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Persuasive <span className="italic">Lower Court Rulings.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Under Article 8 of the Civil Code, only Supreme Court decisions form part of the legal system as binding
            precedent — rulings from other courts inform, but do not bind.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">How Persuasive Authority Works</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Sources practitioners cite when there's no controlling Supreme Court precedent on point.</p>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {SOURCES.map((source) => (
              <div key={source.title} className="px-6 md:px-8 py-6 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-medium text-foreground">{source.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{source.description}</p>
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
                Ask about a specific ruling and get a citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=Persuasive%20Lower%20Court%20Rulings"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search persuasive lower court rulings with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
