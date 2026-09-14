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
    label: "Book I",
    title: "Pre-Employment",
    description: "Recruitment and placement of workers, and the regulation of employment for both local and overseas Filipino workers.",
  },
  {
    label: "Book III",
    title: "Conditions of Employment",
    description: "Hours of work, wages, holiday and overtime pay, service incentive leave, and other minimum labor standards.",
  },
  {
    label: "Book IV",
    title: "Health, Safety, and Social Welfare Benefits",
    description: "Medical and occupational safety standards, plus coverage under the SSS, PhilHealth, and Pag-IBIG systems.",
  },
  {
    label: "Book V",
    title: "Labor Relations",
    description: "The right to self-organization, collective bargaining, and the settlement of disputes through the NLRC, strikes, and lockouts.",
  },
  {
    label: "Book VI",
    title: "Post-Employment",
    description: "The just and authorized causes for termination, due process requirements, separation pay, and retirement benefits.",
  },
];

export default function LaborCodePage() {
  return (
    <LegalCodePage
      activeTab="labor-code"
      eyebrow="Research · Codals"
      title={<>The Labor Code <span className="italic">of the Philippines.</span></>}
      subtitle="Presidential Decree No. 442 — the consolidated labor and social legislation protecting Filipino workers, in force since November 1, 1974."
      aiCta={{
        icon: Scale,
        body: "Ask about any article of the Labor Code and get an annotated, citation-linked answer from the Library.",
        href: "/homepage/library?q=Labor%20Code%20of%20the%20Philippines",
        tooltip: "Search the Labor Code with AI",
      }}
    >
      <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 md:px-8 py-5 border-b border-border">
          <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">The Seven Books</h2>
          <p className="text-[13px] text-muted-foreground mt-0.5">From hiring through the end of the employment relationship.</p>
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
          Regional minimum wage rates are now fixed by Regional Tripartite Wages and Productivity Boards under
          R.A. No. 6727, the Wage Rationalization Act of 1989, rather than by the Code itself.
        </p>
      </section>
    </LegalCodePage>
  );
}
