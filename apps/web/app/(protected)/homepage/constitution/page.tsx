"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpen, Scale } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { usePhStatutoryContentGuard } from "@/components/ph-statutory-content-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface Article {
  number: string;
  title: string;
  description: string;
}

const ARTICLES: Article[] = [
  {
    number: "Article II",
    title: "Declaration of Principles and State Policies",
    description: "The foundational commitments of the State — sovereignty, the renunciation of war, civilian supremacy, and the promotion of social justice.",
  },
  {
    number: "Article III",
    title: "Bill of Rights",
    description: "Due process, equal protection, and the civil liberties guaranteed to every person within Philippine jurisdiction.",
  },
  {
    number: "Article VI",
    title: "Legislative Department",
    description: "The composition, powers, and procedures of the Congress of the Philippines, including the legislative process itself.",
  },
  {
    number: "Article VII",
    title: "Executive Department",
    description: "The powers and qualifications of the President and Vice-President, and the line of succession to the presidency.",
  },
  {
    number: "Article VIII",
    title: "Judicial Department",
    description: "The scope of judicial power, the composition of the Supreme Court, and the doctrine of judicial review.",
  },
  {
    number: "Article IX",
    title: "Constitutional Commissions",
    description: "The Civil Service Commission, Commission on Elections, and Commission on Audit — their independence and mandates.",
  },
];

export default function ConstitutionPage() {
  const tenantCodeGuard = usePhStatutoryContentGuard("constitution");
  if (tenantCodeGuard) return tenantCodeGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="constitution" />

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
            The 1987 <span className="italic">Constitution.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            The supreme law of the Republic of the Philippines, ratified February 2, 1987 — the charter from which
            every statute, regulation, and judicial decision in this library ultimately draws its authority.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">Key Articles</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">The provisions practitioners cite most often, at a glance.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 divide-border">
            {ARTICLES.map((article, i) => (
              <div
                key={article.number}
                className={`px-6 md:px-8 py-6 flex gap-4 ${i % 2 === 0 ? "sm:border-r sm:border-border" : ""} ${
                  i >= 2 ? "sm:border-t sm:border-border" : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <BookOpen className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">{article.number}</p>
                  <h3 className="text-[16px] font-medium text-foreground mt-1">{article.title}</h3>
                  <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{article.description}</p>
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
                Query any provision of the Constitution and get an annotated, citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=1987%20Constitution"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search the 1987 Constitution with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
