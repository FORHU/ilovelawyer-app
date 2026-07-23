"use client";

import { Download, Mail, Newspaper, User } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import GlobalFooter from "@/components/global-footer";

export default function MediaInquiriesPage() {
  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="media-inquiries" />

      <main className="max-w-[1000px] w-full mx-auto px-6 md:px-[48px] py-16 md:py-[85px] flex flex-col gap-10">
        <div className="w-full flex flex-col gap-2">
          <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Connect</span>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[40px] md:text-[50px] text-foreground leading-tight">
            Media <span className="italic">Inquiries.</span>
          </h1>
          <p className="text-muted-foreground text-[16px] md:text-[18px] max-w-[672px] leading-relaxed">
            Reporting on legal technology in the Philippines, or covering ilovelawyer specifically? Here&apos;s how to reach us.
          </p>
        </div>

        <section className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8 flex flex-col gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
            <Newspaper className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="font-['Libre_Caslon_Text',serif] text-[20px] text-foreground">About ilovelawyer</h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground max-w-2xl">
            ilovelawyer is a digital research and case-management platform built for the Philippine legal community,
            combining an AI-assisted legal library, speaker-aware transcription, and document analysis in a single
            workspace. Founded to bring modern tooling to Philippine legal practice, the Platform is used by
            practitioners handling everything from consultation to case filing.
          </p>
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
              <User className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground text-[16px]">Press contact</p>
              <p className="text-muted-foreground text-[14px] mt-1">media@ilovelawyer.ph</p>
              <p className="text-muted-foreground text-[13px] mt-2 leading-relaxed">
                For interview requests, statements, or fact-checking on stories involving ilovelawyer.
              </p>
            </div>
          </div>
          <div className="bg-card rounded-xl border border-border shadow-sm p-6 flex flex-col gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
              <Download className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-medium text-foreground text-[16px]">Press kit</p>
              <p className="text-muted-foreground text-[14px] mt-1">Logos, product screenshots, and boilerplate copy.</p>
              <p className="text-muted-foreground text-[13px] mt-2 leading-relaxed">
                Email the press contact above and we&apos;ll send the current kit directly.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 md:px-8 py-6 flex gap-4 items-center justify-between flex-wrap">
            <div className="flex gap-4 items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
                <Mail className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-foreground text-[16px]">Not a media inquiry?</p>
                <p className="text-muted-foreground text-[14px]">General account or support questions go through Contact Us instead.</p>
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
