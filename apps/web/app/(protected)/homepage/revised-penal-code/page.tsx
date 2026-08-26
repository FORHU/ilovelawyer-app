"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Provision {
  label: string;
  title: string;
  description: string;
}

const PROVISIONS: Provision[] = [
  {
    label: "Book One",
    title: "General Provisions",
    description:
      "Felonies and the circumstances — justifying, exempting, mitigating, aggravating, and alternative — that determine criminal liability, the persons criminally liable, and the graduated scale of penalties.",
  },
  {
    label: "Book Two · Title VIII",
    title: "Crimes Against Persons",
    description:
      "Parricide, murder, homicide, and physical injuries. Rape was reclassified here from Crimes Against Chastity by R.A. No. 8353, the Anti-Rape Law of 1997.",
  },
  {
    label: "Book Two · Title X",
    title: "Crimes Against Property",
    description: "Theft, robbery, estafa, and malicious mischief — offenses that violate a person's dominion over their own property.",
  },
  {
    label: "Book Two · Title III",
    title: "Crimes Against Public Order",
    description: "Rebellion, sedition, direct assault, and other offenses against the stability of government and public authority.",
  },
  {
    label: "Book Two · Title XIII",
    title: "Crimes Against Honor",
    description: "Libel, slander, and other offenses against a person's reputation and dignity.",
  },
];

export default function RevisedPenalCodePage() {
  const jurisdictionGuard = usePhStatutoryContentGuard("revised-penal-code");
  if (jurisdictionGuard) return jurisdictionGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="revised-penal-code" />

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
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Codals</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            The Revised Penal Code <span className="italic">of the Philippines.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Act No. 3815 — the general penal statute of the Philippines, defining felonies and their penalties, in
            force since January 1, 1932.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Two Books</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">From the general rules of criminal liability to the specific offenses they govern.</p>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {PROVISIONS.map((provision) => (
              <div key={provision.label} className="px-6 md:px-8 py-6 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{provision.label}</p>
                  <h3 className="text-[16px] font-medium text-foreground mt-1">{provision.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{provision.description}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="px-6 md:px-8 py-4 border-t border-border text-[12px] text-muted-foreground italic leading-relaxed">
            Title V, originally covering prohibited drugs, was repealed and superseded by R.A. No. 9165, the
            Comprehensive Dangerous Drugs Act of 2002.
          </p>
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 p-8 md:p-10 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <Scale className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[24px]">Search the full text with AI</h2>
              <p className="text-white/70 text-[14px] mt-1 max-w-md">
                Ask about any article of the Revised Penal Code and get an annotated, citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=Revised%20Penal%20Code"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search the Revised Penal Code with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
