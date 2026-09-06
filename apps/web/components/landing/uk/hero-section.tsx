"use client"

import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"

// UK-only design: rendered exclusively when the request resolved to the UK tenant (see
// app/page.tsx), so the i18next `context` is hardcoded rather than read from the hint —
// this component has no PH code path to fall back to.
const tCtx = { context: "UK" }

export function UkHeroSection() {
  const { t } = useTranslation("landing")
  return (
    <section
      id="hero"
      className="relative flex min-h-[85vh] items-center overflow-hidden bg-[#f7fafc] dark:bg-background"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#e8e0d0]/30 via-[#f0ebe0]/20 to-transparent dark:from-brand-gold/10 dark:via-brand-navy-800/30 dark:to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#f7fafc] via-[rgba(247,250,252,0.8)] to-[rgba(247,250,252,0)] dark:from-background dark:via-background/80 dark:to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-360 grid-cols-12 gap-8 px-8 py-24 md:px-16">
        <div className="col-span-12 flex flex-col gap-6 lg:col-span-8 lg:col-start-2">
          <p
            className="text-xs tracking-[2.4px] text-[#735c00] uppercase dark:text-brand-gold"
            style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
          >
            {t("hero.eyebrow")}
          </p>
          <h1
            className="text-[clamp(40px,5.5vw,64px)] leading-[1.1] tracking-[-1.28px] text-black dark:text-foreground"
            style={{
              fontFamily: "'Libre Caslon Text', serif",
              fontWeight: 400,
            }}
          >
            {t("hero.titleLine1", tCtx)}
            <br />
            <em style={{ fontStyle: "italic" }}>
              {t("hero.titleEmphasis", tCtx)}
            </em>
            <br />
            {t("hero.titleLine3", tCtx)}
          </h1>
          <p
            className="max-w-[576px] text-lg leading-[1.6] text-[#45464d] dark:text-muted-foreground"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            {t("hero.description", tCtx)}
          </p>
          <div className="flex flex-wrap gap-6 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className="flex items-center gap-3 bg-black px-8 py-4 text-xs tracking-[1.2px] text-white uppercase transition-colors duration-200 hover:bg-[#1a1a1a] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                  style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                >
                  {t("hero.ctaPrimary")}
                  <ArrowUpRight
                    size={14}
                    className="text-white dark:text-primary-foreground"
                  />
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                Create your free ilovelawyer account
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="#features"
                  className="inline-flex items-center border border-black px-8 py-4 text-xs tracking-[1.2px] text-black uppercase transition-colors duration-200 hover:bg-black/5 dark:border-foreground dark:text-foreground dark:hover:bg-foreground/5"
                  style={{ fontFamily: "Inter, sans-serif", fontWeight: 600 }}
                >
                  {t("hero.ctaSecondary")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                Jump down to see what the platform can do
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 opacity-40">
        <div className="h-12 w-px animate-pulse bg-black dark:bg-foreground" />
      </div>
    </section>
  )
}
