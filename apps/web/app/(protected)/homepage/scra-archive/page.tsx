"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Landmark, Sparkles } from "lucide-react";
import GlobalHeader from "@/components/global-header";

interface Decision {
  grNumber: string;
  caption: string;
  year: string;
  doctrine: string;
}

const DECISIONS: Decision[] = [
  { grNumber: "G.R. No. 221029", caption: "Republic vs. Manalo", year: "2018", doctrine: "Recognition of a foreign divorce decree under Article 26 of the Family Code" },
  { grNumber: "G.R. No. 204819", caption: "Imbong vs. Ochoa", year: "2014", doctrine: "Constitutionality of the Responsible Parenthood and Reproductive Health Law" },
  { grNumber: "G.R. No. 101083", caption: "Oposa vs. Factoran", year: "1993", doctrine: "Intergenerational responsibility and the right to a balanced and healthful ecology" },
  { grNumber: "G.R. No. 208566", caption: "Belgica vs. Ochoa", year: "2013", doctrine: "Unconstitutionality of the pork barrel system under the separation of powers" },
];

export default function ScraArchivePage() {
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="scra-archive" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <Link
          href="/homepage/library"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Library
        </Link>

        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Jurisprudence</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            SCRA <span className="italic">Archive.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Supreme Court Reports Annotated — the full-text archive of En Banc and Division decisions, indexed and
            cross-referenced so the doctrine behind every ruling is one query away.
          </p>
        </div>

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <p className="font-['Libre_Caslon_Text',serif] text-3xl text-foreground">100k+</p>
            <p className="text-[13px] text-muted-foreground mt-1">Full-text decisions indexed</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <p className="font-['Libre_Caslon_Text',serif] text-3xl text-foreground">En Banc</p>
            <p className="text-[13px] text-muted-foreground mt-1">&amp; Division decisions, both covered</p>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6">
            <p className="font-['Libre_Caslon_Text',serif] text-3xl text-foreground">AI</p>
            <p className="text-[13px] text-muted-foreground mt-1">Doctrine extraction on every result</p>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">Landmark Decisions</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Foundational rulings that shaped Philippine jurisprudence.</p>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {DECISIONS.map((decision) => (
              <div key={decision.grNumber} className="px-6 md:px-8 py-5 flex gap-4 items-start">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <Landmark className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-[16px] font-medium text-foreground">{decision.caption}</p>
                    <span className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{decision.grNumber} · {decision.year}</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3 shrink-0 text-amber-600" aria-hidden="true" />
                    {decision.doctrine}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 p-8 md:p-10 text-white shadow-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
              <Landmark className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[24px]">Search the archive with AI</h2>
              <p className="text-white/70 text-[14px] mt-1 max-w-md">
                Query by G.R. number, case name, or doctrine and get a citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Link
            href="/homepage/library?q=Supreme%20Court%20decisions"
            className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
          >
            Open in Library
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </div>
  );
}
