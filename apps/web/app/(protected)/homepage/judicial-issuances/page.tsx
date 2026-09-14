"use client";

import { FileStack, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

interface Issuance {
  title: string;
  description: string;
}

const ISSUANCES: Issuance[] = [
  {
    title: "Rules of Court",
    description: "The rules governing civil procedure, criminal procedure, and evidence in Philippine courts, most recently amended in 2019.",
  },
  {
    title: "Administrative Circulars",
    description: "Supreme Court directives on court administration, procedure, and internal governance binding on all lower courts.",
  },
  {
    title: "OCA Circulars",
    description: "Issuances of the Office of the Court Administrator implementing Supreme Court policy across the lower court system.",
  },
  {
    title: "Bar Matters",
    description: "Resolutions of the Supreme Court governing admission to the practice of law and the conduct of the Bar Examinations.",
  },
];

export default function JudicialIssuancesPage() {
  return (
    <LegalCodePage
      activeTab="judicial-issuances"
      eyebrow="Research · Issuance"
      title={<>Judicial <span className="italic">Issuances.</span></>}
      subtitle="Rules and directives through which the Supreme Court exercises its constitutional power to promulgate rules on pleading, practice, and procedure, under Article VIII, Section 5(5) of the 1987 Constitution."
      aiCta={{
        icon: Scale,
        heading: "Search the archive with AI",
        body: "Ask about a specific Rule of Court or Circular and get a citation-linked answer from the Library.",
        href: "/homepage/library?q=Judicial%20Issuances",
        tooltip: "Search judicial issuances with AI",
      }}
    >
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-border">
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Court's Rule-Making Power</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">The instruments through which the judiciary governs its own procedure.</p>
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
