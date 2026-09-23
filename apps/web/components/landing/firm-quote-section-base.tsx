"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical markup/motion here too (see hero-section-base.tsx for why
// this is one component instead of two hand-copied files) — differing only in tenant
// asset path and i18next context.

interface Quote {
  text: string;
  author: string;
  firm: string;
}

const AUTOPLAY_MS = 6000;

export function FirmQuoteSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const tCtx = tenantCode === "UK" ? { context: "UK" as const } : undefined;
  const firmWorkspaceImage = getTenantCodeConfig(tenantCode).landingAssets.firmWorkspace;
  const quotes = t("quotes.items", { ...tCtx, returnObjects: true }) as Quote[];
  const [displayed, setDisplayed] = useState(0);
  const [fading, setFading] = useState(false);

  const [sectionRef, backgroundPositionY] = useScrollDrift<HTMLElement, string>(["-12%", "12%"]);

  const changeQuote = (index: number) => {
    if (index === displayed) return;
    setFading(true);
    setTimeout(() => {
      setDisplayed(index);
      setFading(false);
    }, 200);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setDisplayed((prev) => (prev + 1) % quotes.length);
        setFading(false);
      }, 200);
    }, AUTOPLAY_MS);
    return () => clearInterval(interval);
  }, [quotes.length]);

  const quote = quotes[displayed] ?? quotes[0]!;

  return (
    <section ref={sectionRef} id="testimonials" className="relative w-full h-[82dvh] min-h-[560px] overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: `url('${firmWorkspaceImage}')`, backgroundPositionX: "50%", backgroundPositionY }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/85" />
      {/* Handoff §4/note: fade the photo into the solid #0b0b0b sections above and below it,
          so the boundary doesn't show a hard seam. */}
      <div className="absolute inset-x-0 top-0 h-[200px] bg-gradient-to-b from-[#0b0b0b] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-[200px] bg-gradient-to-t from-[#0b0b0b] to-transparent" />

      <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-16 pb-12 gap-8">
        <div
          className="flex flex-col gap-3 max-w-[760px] transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <p className="font-display text-white text-[clamp(22px,2.4vw,32px)] font-light leading-[1.25] tracking-[-0.023em] line-clamp-3">
            &ldquo;{quote.text}&rdquo;
          </p>
          <div className="flex flex-col gap-0.5">
            <span className="text-white text-base font-medium">{quote.author}</span>
            <span className="text-white/70 text-sm">{quote.firm}</span>
          </div>
        </div>

        <div className="flex gap-3 items-center">
          {quotes.map((_, i) => (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => changeQuote(i)}
                  aria-label={t("quotes.quoteLabel", { number: i + 1 })}
                  className="size-5 flex items-center justify-center cursor-pointer bg-transparent border-0"
                >
                  <span
                    className={`rounded-full transition-all duration-300 ${
                      i === displayed ? "size-2.5 bg-brand-gold" : "size-2 bg-white/35 hover:bg-white/60"
                    }`}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("quotes.quoteLabel", { number: i + 1 })}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </section>
  );
}
