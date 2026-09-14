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
    <LegalCodePage
      activeTab="family-code"
      eyebrow="Research · Codals"
      title={<>The Family Code <span className="italic">of the Philippines.</span></>}
      subtitle="Executive Order No. 209 — the law governing marriage and family relations, in force since August 3, 1988, superseding Book I of the Civil Code on Persons and Family Relations."
      aiCta={{
        icon: Scale,
        body: "Ask about any article of the Family Code and get an annotated, citation-linked answer from the Library.",
        href: "/homepage/library?q=Family%20Code%20of%20the%20Philippines",
        tooltip: "Search the Family Code with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
