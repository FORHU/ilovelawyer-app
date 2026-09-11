"use client";

import { FileStack, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="presidential-issuances"
      eyebrow="Research · Issuance"
      title={<>Presidential <span className="italic">Issuances.</span></>}
      subtitle="Instruments through which the President exercises executive power, classified under Book III of the 1987 Administrative Code (Executive Order No. 292)."
      aiCta={{
        icon: Scale,
        heading: "Search the archive with AI",
        body: "Ask about a specific Executive Order or Proclamation and get a citation-linked answer from the Library.",
        href: "/homepage/library?q=Presidential%20Issuances",
        tooltip: "Search presidential issuances with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
