"use client";

import { FileStack, Scale } from "lucide-react";
import { LegalCodePage } from "@/components/legal-code-page";

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
  return (
    <LegalCodePage
      activeTab="administrative-issuances"
      eyebrow="Research · Issuance"
      title={<>Administrative Agency <span className="italic">Issuances.</span></>}
      subtitle="Rules and regulations issued by executive agencies under delegated rule-making power, giving practical effect to the statutes they administer."
      aiCta={{
        icon: Scale,
        heading: "Search the archive with AI",
        body: "Ask about a specific agency circular or IRR and get a citation-linked answer from the Library.",
        href: "/homepage/library?q=Administrative%20Agency%20Issuances",
        tooltip: "Search administrative agency issuances with AI",
      }}
    >
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
    </LegalCodePage>
  );
}
