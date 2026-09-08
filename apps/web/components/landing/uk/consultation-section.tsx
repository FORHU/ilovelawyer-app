"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";

// UK-only design — see uk/hero-section.tsx for why the context is hardcoded.
const tCtx = { context: "UK" };

interface RelatedCase {
  title: string;
  citation: string;
  vetted: boolean;
}

export function UkConsultationSection() {
  const { t } = useTranslation("landing");
  const relatedCases = t("consultation.relatedCasesItems", { ...tCtx, returnObjects: true }) as RelatedCase[];
  const [ref, y] = useScrollDrift([-16, 16]);

  return (
    <section className="bg-background py-24 px-6 md:px-16">
      <div ref={ref} className="max-w-360 mx-auto grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
        <div className="flex flex-col gap-6 max-w-[480px]">
          <h2 className="font-['Libre_Caslon_Text'] text-foreground text-[clamp(38px,5vw,64px)] font-light leading-[0.98] tracking-[-0.02em]">
            {t("consultation.heading")}
          </h2>
          <p className="text-muted-foreground text-base leading-[1.6]">{t("consultation.body")}</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/signup"
                className="self-start text-xs tracking-[1.2px] uppercase font-semibold px-6 py-3 rounded-full bg-brand-gold text-brand-navy-950 hover:bg-brand-gold/85 transition-colors duration-200"
              >
                {t("consultation.cta")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Sign up to start an AI-assisted consultation</TooltipContent>
          </Tooltip>
        </div>

        <motion.div
          style={{ y }}
          className="justify-self-center w-[320px] h-[400px] rounded-xl bg-card border border-border shadow-xl overflow-hidden flex flex-col"
        >
          <div className="p-4 border-b border-border flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-brand-gold shrink-0" />
            <span className="font-['Libre_Caslon_Text'] text-card-foreground text-sm uppercase tracking-[-0.01em]">
              {t("consultation.caseName", tCtx)}
            </span>
          </div>
          <div className="px-4 pt-3 pb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-semibold text-card-foreground">{t("consultation.relatedCases")}</span>
            <span>&middot; {relatedCases.length}</span>
          </div>
          <div className="p-3 flex flex-col gap-2">
            {relatedCases.map((c) => (
              <div key={c.title} className="border border-border rounded-xl p-3 relative">
                <p className="text-[12.5px] font-semibold text-card-foreground pr-4">{c.title}</p>
                <ExternalLink size={11} className="absolute top-3 right-3 text-muted-foreground" />
                <p className="text-[10.5px] text-muted-foreground mt-0.5">{c.citation}</p>
                {c.vetted && (
                  <div className="mt-2 inline-flex items-center gap-1 border border-border rounded-md px-2 py-1">
                    <CheckCircle2 size={10} className="text-brand-gold" />
                    <span className="text-[9.5px] tracking-[0.04em] uppercase text-muted-foreground">
                      {t("consultation.vetted")}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border flex flex-col gap-1">
            <span className="inline-flex items-center gap-1.5 self-start bg-muted rounded-full px-2.5 py-1 text-[11px] text-card-foreground">
              {t("consultation.mockFilename", tCtx)}
            </span>
            <span className="text-[10.5px] text-muted-foreground">{t("consultation.indexing")}</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
