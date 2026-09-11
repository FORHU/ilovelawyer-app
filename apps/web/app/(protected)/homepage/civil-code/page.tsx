"use client";

import { BookOpen, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="civil-code"
      eyebrow="Research · Codals"
      title={<>The Civil Code <span className="italic">of the Philippines.</span></>}
      subtitle="Republic Act No. 386 — the general body of private law governing persons, property, and the civil relations arising between them, in force since August 30, 1950."
      aiCta={{
        icon: Scale,
        body: "Ask about any article of the Civil Code and get an annotated, citation-linked answer from the Library.",
        href: "/homepage/library?q=Civil%20Code%20of%20the%20Philippines",
        tooltip: "Search the Civil Code with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
