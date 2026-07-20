"use client";

import React, { useState } from "react";
import { Ban } from "lucide-react";
import GlobalHeader from "@/components/global-header";

interface Section {
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  prohibited?: string[];
  quote?: string;
}

const SECTIONS: Section[] = [
  {
    number: "Section 01",
    title: "Acceptance of Terms",
    paragraphs: [
      'By accessing or using the ilovelawyer platform ("the Platform"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. This agreement constitutes a legally binding contract between you and ilovelawyer Juris Editorial Excellence.',
      "If you do not agree to these terms, you must immediately cease all use of the Platform and its associated AI counsel services. We reserve the right to modify these terms at any time, with continued use constituting acceptance of such changes.",
    ],
  },
  {
    number: "Section 02",
    title: "User Accounts",
    paragraphs: [
      "To access certain premium features, including AI-driven case management and transcription, you must register for an account. You represent and warrant that all information provided during registration is accurate, current, and complete.",
    ],
    bullets: [
      "Confidentiality of login credentials rests solely with the account holder.",
      "Unauthorized access must be reported within 24 hours of discovery.",
      "Each account is personal and non-transferable without express written consent.",
    ],
  },
  {
    number: "Section 03",
    title: "Intellectual Property",
    paragraphs: [
      'The Platform, including but not limited to its AI algorithms, proprietary legal database, interface design, and "ilovelawyer" branding, is the exclusive property of our organization protected by Philippine and international copyright laws.',
    ],
    quote:
      "Users retain ownership of the original documents uploaded to the platform. However, the AI-generated insights, summaries, and comparative analyses derived from such documents remain the intellectual property of ilovelawyer.",
  },
  {
    number: "Section 04",
    title: "Prohibited Uses",
    paragraphs: [
      "You agree not to use the Platform for any unlawful purpose or in any way that violates the ethical standards of the Philippine Bar. Prohibited actions include:",
    ],
    prohibited: [
      "Reverse engineering, decompiling, or attempting to extract the source code of our AI modules.",
      "Using the AI to generate fraudulent documents or deceptive legal strategies.",
      "Automated scraping of the Legal Library for external commercial use.",
    ],
  },
  {
    number: "Section 05",
    title: "Termination",
    paragraphs: [
      "We reserve the right to suspend or terminate your access to the Platform without prior notice for any breach of these Terms. Termination does not waive your liability for outstanding fees or obligations accrued during the period of service.",
      "Upon termination, all licenses granted herein shall immediately cease, and you must destroy any confidential Platform material in your possession.",
    ],
  },
];

export default function TermsPage() {
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 via-slate-300 to-[#3d4763]">
      <GlobalHeader activeTab="term" />

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <article className="overflow-hidden rounded-2xl bg-neutral-50 shadow-2xl ring-1 ring-black/5">
          <div className="px-10 pb-4 pt-12 sm:px-14">
            <p className="border-b border-black/10 pb-2 text-xs font-medium uppercase tracking-[2px] text-[#0b132b]/70">
              Legal Governance Module
            </p>
            <h1 className="mt-6 font-['Libre_Caslon_Text'] text-4xl font-normal tracking-[-0.6px] text-[#0b132b] sm:text-5xl">
              Terms and Conditions
            </h1>
            <p className="mt-3 text-sm italic text-gray-500">
              Effective Date: October 24, 2024. Jurisdiction: Republic of the Philippines.
            </p>
          </div>

          <div className="flex flex-col">
            {SECTIONS.map((section) => (
              <section
                key={section.number}
                className="grid grid-cols-1 gap-3 border-t border-black/10 px-10 py-10 sm:grid-cols-[140px_1fr] sm:gap-8 sm:px-14"
              >
                <p className="text-xs font-medium uppercase tracking-[1.5px] text-gray-500">{section.number}</p>

                <div>
                  <h2 className="font-['Libre_Caslon_Text'] text-xl font-normal text-[#0b132b]">{section.title}</h2>

                  <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-gray-600">
                    {section.paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>

                  {section.bullets && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {section.bullets.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-600">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.prohibited && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {section.prohibited.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-gray-600">
                          <Ban className="mt-0.5 size-3.5 shrink-0 text-red-500" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  )}

                  {section.quote && (
                    <blockquote className="mt-4 border-l-2 border-[#0b132b] bg-black/[0.03] py-2 pl-4 text-sm italic leading-relaxed text-gray-600">
                      {section.quote}
                    </blockquote>
                  )}
                </div>
              </section>
            ))}
          </div>

          <div className="flex flex-col gap-4 border-t border-black/10 px-10 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-14">
            <div>
              <p className="font-['Libre_Caslon_Text'] text-lg text-[#0b132b]">ilovelawyer</p>
              <p className="text-[10px] uppercase tracking-[1.5px] text-gray-500">Verified Juris Excellence</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="cursor-pointer rounded-md border border-[#0b132b]/20 px-5 py-2.5 text-xs font-medium uppercase tracking-[1px] text-[#0b132b] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b132b]/30"
              >
                Download PDF
              </button>
              <button
                type="button"
                disabled={accepted}
                onClick={() => setAccepted(true)}
                className="cursor-pointer rounded-md bg-[#0b132b] px-5 py-2.5 text-xs font-medium uppercase tracking-[1px] text-white transition-colors hover:bg-[#162244] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b132b]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accepted ? "Terms Accepted" : "Accept Terms"}
              </button>
            </div>
          </div>
        </article>
      </main>

      <footer className="border-t border-white/10 bg-[#0b132b]/95">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-['Libre_Caslon_Text'] text-lg text-white">ilovelawyer</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-white/50">
              Elevating the practice of law through editorial precision and intelligent counsel.
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-white/60 sm:items-end">
            <div className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              <a href="/homepage/term" className="font-semibold text-white">
                Terms of Service
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                Privacy Policy
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                Regulatory Compliance
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                Contact Us
              </a>
            </div>
            <p className="text-white/40">© 2026 ilovelawyer. All rights reserved. Juris Editorial Excellence.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
