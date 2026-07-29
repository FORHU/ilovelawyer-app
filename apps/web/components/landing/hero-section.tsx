"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function HeroSection() {
  const { t } = useTranslation("landing");
  return (
    <section id="hero" className="relative min-h-[85vh] flex items-center overflow-hidden bg-[#f7fafc] dark:bg-background">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e8e0d0]/30 via-[#f0ebe0]/20 to-transparent dark:from-brand-gold/10 dark:via-brand-navy-800/30 dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f7fafc] via-[rgba(247,250,252,0.8)] to-[rgba(247,250,252,0)] dark:from-background dark:via-background/80 dark:to-transparent" />
      </div>

      <div className="relative z-10 max-w-360 mx-auto w-full px-8 md:px-16 py-24 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-start-2 lg:col-span-8 flex flex-col gap-6">
          <p className="text-[#735c00] dark:text-brand-gold text-xs tracking-[2.4px] uppercase" style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}>
            {t("hero.eyebrow")}
          </p>
          <h1
            className="text-black dark:text-foreground text-[clamp(40px,5.5vw,64px)] tracking-[-1.28px] leading-[1.1]"
            style={{ fontFamily: "'Libre Caslon Text', serif", fontWeight: 400 }}
          >
            {t("hero.titleLine1")}<br />
            <em style={{ fontStyle: "italic" }}>{t("hero.titleEmphasis")}</em><br />
            {t("hero.titleLine3")}
          </h1>
          <p className="text-[#45464d] dark:text-muted-foreground text-lg leading-[1.6] max-w-[576px]" style={{ fontFamily: "Inter, sans-serif" }}>
            {t("hero.description")}
          </p>
          <div className="flex flex-wrap gap-6 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className="bg-black text-white dark:bg-primary dark:text-primary-foreground text-xs tracking-[1.2px] uppercase px-8 py-4 flex items-center gap-3 hover:bg-[#1a1a1a] dark:hover:bg-primary/90 transition-colors duration-200"
                  style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                >
                  {t("hero.ctaPrimary")}
                  <ArrowUpRight size={14} className="text-white dark:text-primary-foreground" />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Create your free ilovelawyer account</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="#features"
                  className="border border-black text-black dark:border-foreground dark:text-foreground text-xs tracking-[1.2px] uppercase px-8 py-4 hover:bg-black/5 dark:hover:bg-foreground/5 transition-colors duration-200 inline-flex items-center"
                  style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Jump down to see what the platform can do</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
        <div className="w-px h-12 bg-black dark:bg-foreground animate-pulse" />
      </div>
    </section>
  );
}
