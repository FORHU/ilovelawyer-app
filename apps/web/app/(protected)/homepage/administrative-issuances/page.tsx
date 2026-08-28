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
    title: "Implementing Rules and Regulations (IRRs)",
    description: "Detailed rules that operationalize a statute — an IRR that expands, contradicts, or narrows the law it implements is void.",
  },
  {
    title: "Bureau of Internal Revenue Issuances",
    description: "Revenue regulations, memorandum circulars, and rulings that interpret and enforce the National Internal Revenue Code.",
  },
  {
    title: "Department and Agency Orders",
    description: "Circulars from agencies such as the DOLE, DTI, and SEC that guide compliance within their regulatory mandates.",
  },
  {
    title: "Local Government Ordinances",
    description: "Legislative issuances of local government units exercising delegated police power under the Local Government Code.",
  },
];

export default function AdministrativeIssuancesPage() {
  const tenantCodeGuard = usePhStatutoryContentGuard("administrative-issuances");
  if (tenantCodeGuard) return tenantCodeGuard;
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="administrative-issuances" />

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
            Administrative Agency <span className="italic">Issuances.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Rules and regulations issued by executive agencies under delegated rule-making power, giving practical
            effect to the statutes they administer.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">Where Agency Rule-Making Shows Up</h2>
            <p className="text-[13px] text-muted-foreground mt-0.5">Subordinate legislation, and the boundary it can't cross.</p>
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
                Ask about a specific agency circular or IRR and get a citation-linked answer from the Library.
              </p>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/library?q=Administrative%20Agency%20Issuances"
                className="relative inline-flex shrink-0 cursor-pointer items-center gap-2 self-start sm:self-center rounded-lg bg-white px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-brand-navy-950 transition-colors hover:bg-brand-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-navy-950"
              >
                Open in Library
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Search administrative agency issuances with AI</TooltipContent>
          </Tooltip>
        </section>
      </main>
    </div>
  );
}
