"use client";

import { Landmark, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="persuasive-rulings"
      eyebrow="Research · Jurisprudence"
      title={<>Persuasive <span className="italic">Lower Court Rulings.</span></>}
      subtitle="Under Article 8 of the Civil Code, only Supreme Court decisions form part of the legal system as binding precedent — rulings from other courts inform, but do not bind."
      aiCta={{
        icon: Landmark,
        heading: "Search the archive with AI",
        body: "Ask about a specific ruling and get a citation-linked answer from the Library.",
        href: "/homepage/library?q=Persuasive%20Lower%20Court%20Rulings",
        tooltip: "Search persuasive lower court rulings with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
