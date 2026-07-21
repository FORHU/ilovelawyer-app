"use client";

import React, { useState } from "react";
import { Ban } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";

interface Section {
  number: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  prohibited?: string[];
  quote?: string;
}

export default function TermsPage() {
  const { t } = useTranslation("term");
  const SECTIONS = t("sections", { returnObjects: true }) as Section[];
  const [accepted, setAccepted] = useState(false);

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 via-slate-300 to-[#3d4763]">
      <GlobalHeader activeTab="term" />

      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <article className="overflow-hidden rounded-2xl bg-neutral-50 shadow-2xl ring-1 ring-black/5">
          <div className="px-10 pb-4 pt-12 sm:px-14">
            <p className="border-b border-black/10 pb-2 text-xs font-medium uppercase tracking-[2px] text-[#0b132b]/70">
              {t("legalGovernanceModule")}
            </p>
            <h1 className="mt-6 font-['Libre_Caslon_Text'] text-4xl font-normal tracking-[-0.6px] text-[#0b132b] sm:text-5xl">
              {t("title")}
            </h1>
            <p className="mt-3 text-sm italic text-gray-500">
              {t("effectiveDate")}
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
              <p className="text-[10px] uppercase tracking-[1.5px] text-gray-500">{t("verifiedJurisExcellence")}</p>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="cursor-pointer rounded-md border border-[#0b132b]/20 px-5 py-2.5 text-xs font-medium uppercase tracking-[1px] text-[#0b132b] transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b132b]/30"
              >
                {t("downloadPdf")}
              </button>
              <button
                type="button"
                disabled={accepted}
                onClick={() => setAccepted(true)}
                className="cursor-pointer rounded-md bg-[#0b132b] px-5 py-2.5 text-xs font-medium uppercase tracking-[1px] text-white transition-colors hover:bg-[#162244] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b132b]/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {accepted ? t("termsAccepted") : t("acceptTerms")}
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
              {t("footerTagline")}
            </p>
          </div>

          <div className="flex flex-col gap-2 text-xs text-white/60 sm:items-end">
            <div className="flex flex-wrap gap-x-4 gap-y-1 sm:justify-end">
              <a href="/homepage/term" className="font-semibold text-white">
                {t("footerLinks.termsOfService")}
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                {t("footerLinks.privacyPolicy")}
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                {t("footerLinks.regulatoryCompliance")}
              </a>
              <a href="/homepage/term" className="transition-colors hover:text-white">
                {t("footerLinks.contactUs")}
              </a>
            </div>
            <p className="text-white/40">{t("copyright", { year: new Date().getFullYear() })}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
