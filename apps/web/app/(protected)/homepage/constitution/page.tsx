"use client";

import { BookOpen, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="constitution"
      eyebrow="Research · Codals"
      title={<>The 1987 <span className="italic">Constitution.</span></>}
      subtitle="The supreme law of the Republic of the Philippines, ratified February 2, 1987 — the charter from which every statute, regulation, and judicial decision in this library ultimately draws its authority."
      aiCta={{
        icon: Scale,
        body: "Query any provision of the Constitution and get an annotated, citation-linked answer from the Library.",
        href: "/homepage/library?q=1987%20Constitution",
        tooltip: "Search the 1987 Constitution with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
