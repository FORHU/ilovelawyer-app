"use client";

import { Landmark, Sparkles } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
    <LegalCodePage
      activeTab="scra-archive"
      eyebrow="Research · Jurisprudence"
      title={<>SCRA <span className="italic">Archive.</span></>}
      subtitle="Supreme Court Reports Annotated — the full-text archive of En Banc and Division decisions, indexed and cross-referenced so the doctrine behind every ruling is one query away."
      aiCta={{
        icon: Landmark,
        heading: "Search the archive with AI",
        body: "Query by G.R. number, case name, or doctrine and get a citation-linked answer from the Library.",
        href: "/homepage/library?q=Supreme%20Court%20decisions",
        tooltip: "Search Supreme Court decisions with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
