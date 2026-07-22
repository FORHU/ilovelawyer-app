"use client";

import { Database, Eye, Lock, Mail, Share2, ShieldCheck, UserCog } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import GlobalFooter from "@/components/global-footer";

interface Section {
  icon: typeof Database;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

const SECTIONS: Section[] = [
  {
    icon: Database,
    title: "Information We Collect",
    paragraphs: [
      "We collect the information you provide directly — your name, email, and username at signup — along with the case files, audio recordings, and documents you upload or generate while using the Platform.",
    ],
    bullets: [
      "Account details: name, username, email address",
      "Work product: case records, uploaded documents, audio recordings and transcripts",
      "Usage data: login timestamps and session activity",
    ],
  },
  {
    icon: Eye,
    title: "How We Use Your Information",
    paragraphs: [
      "Your information powers the core features of the Platform: authenticating your session, organizing your case portfolio, and running the AI-assisted research, transcription, and document analysis tools you initiate.",
      "We do not use your case files or client data to train models shared across other organizations.",
    ],
  },
  {
    icon: UserCog,
    title: "AI Processing & Data Handling",
    paragraphs: [
      "Where a feature relies on AI — legal research summaries, transcription, or document analysis — the relevant content is processed only for the purpose of producing the output you requested, and is handled with the same confidentiality safeguards as the rest of your workspace.",
    ],
  },
  {
    icon: Lock,
    title: "Data Retention & Security",
    paragraphs: [
      "Recordings, transcripts, and documents remain in your workspace until you remove them. We apply encryption in transit and access controls scoped to your account to guard against unauthorized access.",
    ],
  },
  {
    icon: Share2,
    title: "Third-Party Disclosure",
    paragraphs: [
      "We do not sell your personal information or client data. Limited data may be shared with infrastructure providers strictly to operate the Platform, under confidentiality obligations no less protective than this policy.",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Your Rights",
    paragraphs: [
      "You may access, correct, or delete your account information and stored work product at any time from your workspace, or by contacting us directly.",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="privacy-policy" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Legal · Governance</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Privacy <span className="italic">Policy.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            How ilovelawyer collects, uses, and safeguards the information in your workspace. Effective date: January 1, 2026.
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
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[16px]">Questions about this policy?</p>
                <p className="text-muted-foreground text-[14px]">Reach our privacy team and we&apos;ll get back to you.</p>
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
