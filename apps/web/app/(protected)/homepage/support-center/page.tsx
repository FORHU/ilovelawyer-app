"use client";

import { useState } from "react";
import { ChevronDown, LifeBuoy, Mail, MessageCircle } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import GlobalFooter from "@/components/global-footer";

interface Faq {
  question: string;
  answer: string;
}

const FAQS: Faq[] = [
  {
    question: "How do I start a live transcription?",
    answer:
      "Open Transcription from the top navigation, then select Launch Recorder. Your browser will ask for microphone permission — once granted, recording and (where supported) live captioning begin immediately.",
  },
  {
    question: "Why doesn't my uploaded audio file show a text transcript?",
    answer:
      "Live text transcription currently runs only while recording directly in the browser. Files you upload are saved for playback in the Activity Queue, but don't yet generate text automatically.",
  },
  {
    question: "Can I recover a case I archived by mistake?",
    answer:
      "Yes — reach out through Contact Us with the case name or docket number and we'll restore it to your Case Portfolio.",
  },
  {
    question: "How is my data kept confidential?",
    answer:
      "Every workspace is scoped to your account, and case materials are never used to train models shared across other organizations. See our Privacy Policy and Ethics Policy for the full detail.",
  },
  {
    question: "Who can I contact for billing questions?",
    answer: "Billing and account questions go to the same Contact Us form — select \"Billing\" as the subject and our team will follow up.",
  },
];

export default function SupportCenterPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="support-center" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Connect</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Support <span className="italic">Center.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Answers to the questions we hear most, and a direct line to our team for everything else.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-5 border-b border-border">
            <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] text-foreground">Frequently Asked Questions</h2>
          </div>

          <div className="flex flex-col divide-y divide-border">
            {FAQS.map((faq, i) => {
              const isOpen = openIndex === i;
              return (
                <div key={faq.question}>
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                    className="w-full cursor-pointer flex items-center justify-between gap-4 px-6 md:px-8 py-5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                  >
                    <span className="text-[15px] font-medium text-foreground">{faq.question}</span>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                  {isOpen && (
                    <p className="px-6 md:px-8 pb-5 -mt-1 text-[14px] leading-relaxed text-muted-foreground max-w-2xl">{faq.answer}</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground text-[16px]">Still stuck?</p>
              <p className="text-muted-foreground text-[14px] mt-1">Send us the details and we&apos;ll get back within one business day.</p>
            </div>
            <a
              href="/homepage/contact-us"
              className="self-start cursor-pointer rounded-lg bg-brand-navy-900 px-5 py-2.5 text-[12px] font-semibold tracking-[1.2px] uppercase text-white transition-colors hover:bg-brand-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy-900/40 focus-visible:ring-offset-2"
            >
              Contact Us
            </a>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground text-[16px]">Email support directly</p>
              <p className="text-muted-foreground text-[14px] mt-1">support@ilovelawyer.ph — for account, billing, or technical issues.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden="true" />
              Typical reply time: under 24 hours
            </span>
          </div>
        </section>
      </main>

      <GlobalFooter />
    </div>
  );
}
