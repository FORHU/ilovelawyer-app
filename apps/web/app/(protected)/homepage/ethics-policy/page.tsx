"use client";

import { AlertTriangle, Ban, Gavel, Mail, ShieldCheck, Users } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import GlobalFooter from "@/components/global-footer";

interface Section {
  icon: typeof Gavel;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: Gavel,
    title: "Purpose & Scope",
    paragraphs: [
      "This policy sets out the ethical commitments that govern how ilovelawyer's AI-assisted tools may be used within the practice of law, consistent with the Code of Professional Responsibility and Accountability (CPRA) and the standards of the Philippine Bar.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Confidentiality & Privilege",
    paragraphs: [
      "Case materials, client communications, and any content processed through the Platform's AI features remain subject to attorney-client privilege and the duty of confidentiality owed to your clients. The Platform is a tool for your practice, not a party to that relationship.",
    ],
  },
  {
    icon: AlertTriangle,
    title: "AI-Assisted Work Product Disclaimer",
    paragraphs: [
      "Outputs from AI-driven research, transcription, or document analysis are drafting aids, not legal advice or a finished work product. They may contain errors, omissions, or outdated citations.",
    ],
    bullets: [
      "Every AI-generated summary, transcript, or analysis must be independently reviewed before reliance",
      "Cited authorities should be verified against the primary source before filing or advising a client",
      "The practitioner of record remains solely responsible for all filings and advice",
    ],
  },
  {
    icon: Users,
    title: "Human Oversight & Accountability",
    paragraphs: [
      "AI assistance supplements, but never replaces, independent professional judgment. A licensed attorney must review and take responsibility for any AI-assisted output before it is used in practice.",
    ],
  },
  {
    icon: Ban,
    title: "Prohibited Uses",
    paragraphs: ["The Platform's AI features may not be used to:"],
    bullets: [
      "Generate fraudulent documents or deceptive legal strategies",
      "Circumvent a court's or opposing counsel's disclosure obligations",
      "Automate the unauthorized practice of law by non-lawyers",
    ],
  },
];

export default function EthicsPolicyPage() {
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="ethics-policy" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Legal · Governance</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Ethics <span className="italic">Policy.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Our commitments on confidentiality, human oversight, and responsible use of AI in legal practice.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex flex-col divide-y divide-border">
            {SECTIONS.map((section) => (
              <div key={section.title} className="px-6 md:px-8 py-6 flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                  <section.icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-[17px] font-medium text-foreground">{section.title}</h2>
                  <div className="mt-2 flex flex-col gap-2 text-[14px] leading-relaxed text-muted-foreground">
                    {section.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                  {section.bullets && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {section.bullets.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-muted-foreground">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-6 flex gap-4 items-center justify-between flex-wrap">
            <div className="flex gap-4 items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[16px]">Report an ethical concern</p>
                <p className="text-muted-foreground text-[14px]">Flag a misuse of the Platform&apos;s AI features to our team directly.</p>
              </div>
            </div>
            <a
              href="/homepage/contact-us"
              className="cursor-pointer rounded-lg bg-brand-navy-900 px-6 py-2.5 text-[12px] font-semibold tracking-[1.2px] uppercase text-white transition-colors hover:bg-brand-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2"
            >
              Contact Us
            </a>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
