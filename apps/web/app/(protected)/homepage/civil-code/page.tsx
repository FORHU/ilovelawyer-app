"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Book {
  number: string;
  title: string;
  description: string;
}

const BOOKS: Book[] = [
  {
    number: "Book I",
    title: "Persons and Family Relations",
    description: "Civil personality, marriage, paternity and filiation, and the rights and obligations between spouses and family members.",
  },
  {
    number: "Book II",
    title: "Property, Ownership, and its Modifications",
    description: "Classification of property, co-ownership, possession, usufruct, easements, and the modes of acquiring ownership.",
  },
  {
    number: "Book III",
    title: "Different Modes of Acquiring Ownership",
    description: "Occupation, donation, and succession — testate and intestate — including the legitime reserved for compulsory heirs.",
  },
  {
    number: "Book IV",
    title: "Obligations and Contracts",
    description: "The sources of obligations, essential requisites of contracts, and the remedies available upon breach.",
  },
];

export default function CivilCodePage() {
  const tenantCodeGuard = usePhStatutoryContentGuard("civil-code");
  if (tenantCodeGuard) return tenantCodeGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="civil-code" />

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
            The Civil Code <span className="italic">of the Philippines.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Republic Act No. 386 — the general body of private law governing persons, property, and the civil
            relations arising between them, in force since August 30, 1950.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Four Books</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">The Code&apos;s structure, from personal status through contractual obligation.</p>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {BOOKS.map((book) => (
              <div key={book.number} className="px-6 md:px-8 py-6 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{book.number}</p>
                  <h3 className="text-[16px] font-medium text-foreground mt-1">{book.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{book.description}</p>
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
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[24px]">Search the full text with AI</h2>
              <p className="text-white/70 text-[14px] mt-1 max-w-md">
                Ask about any article of the Civil Code and get an annotated, citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=Civil%20Code%20of%20the%20Philippines"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search the Civil Code with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
