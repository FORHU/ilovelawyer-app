"use client";

import { BookOpen, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="revised-penal-code"
      eyebrow="Research · Codals"
      title={<>The Revised Penal Code <span className="italic">of the Philippines.</span></>}
      subtitle="Act No. 3815 — the general penal statute of the Philippines, defining felonies and their penalties, in force since January 1, 1932."
      aiCta={{
        icon: Scale,
        body: "Ask about any article of the Revised Penal Code and get an annotated, citation-linked answer from the Library.",
        href: "/homepage/library?q=Revised%20Penal%20Code",
        tooltip: "Search the Revised Penal Code with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
