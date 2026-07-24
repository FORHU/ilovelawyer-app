"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";

interface Provision {
  label: string;
  title: string;
  description: string;
}

const PROVISIONS: Provision[] = [
  {
    label: "Title I",
    title: "Marriage",
    description: "The essential and formal requisites of a valid marriage, and the grounds rendering a marriage void or voidable, including psychological incapacity under Article 36.",
  },
  {
    label: "Title IV",
    title: "Property Relations Between Spouses",
    description: "Absolute community of property, conjugal partnership of gains, and separation of property by marriage settlement.",
  },
  {
    label: "Title VI",
    title: "Paternity and Filiation",
    description: "The status of legitimate and illegitimate children, and their right to use a parent's surname under R.A. No. 9255.",
  },
  {
    label: "Title VIII",
    title: "Support",
    description: "The obligation to provide for the sustenance, education, and other needs of family members entitled to support.",
  },
  {
    label: "Title IX",
    title: "Parental Authority",
    description: "The rights and duties of parents over the person and property of their unemancipated children.",
  },
];

export default function FamilyCodePage() {
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="family-code" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <Link
          href="/homepage/library"
          className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Library
        </Link>

        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Codals</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            The Family Code <span className="italic">of the Philippines.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Executive Order No. 209 — the law governing marriage and family relations, in force since August 3,
            1988, superseding Book I of the Civil Code on Persons and Family Relations.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Nine Titles</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">From the requisites of marriage through parental authority.</p>
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
            Title VII, on Adoption, has been superseded by R.A. No. 11642, the Domestic Administrative Adoption and
            Alternative Child Care Act of 2022, which moved domestic adoption from a judicial to an administrative
            process before the National Authority for Child Care.
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
                Ask about any article of the Family Code and get an annotated, citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Link
            href="/homepage/library?q=Family%20Code%20of%20the%20Philippines"
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
