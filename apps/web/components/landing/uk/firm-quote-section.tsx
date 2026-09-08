"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { useScrollDrift } from "@/lib/landing/use-scroll-drift";

// UK-only design — see uk/hero-section.tsx for why the context is hardcoded.
const tCtx = { context: "UK" };

interface Quote {
  text: string;
  author: string;
  firm: string;
}

const AUTOPLAY_MS = 6000;
const firmWorkspaceImage = getTenantCodeConfig("UK").landingAssets.firmWorkspace;

export function UkFirmQuoteSection() {
  const { t } = useTranslation("landing");
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
    <section ref={sectionRef} id="testimonials" className="relative w-full h-[82vh] min-h-[560px] overflow-hidden">
      <motion.div
        className="absolute inset-0 bg-cover"
        style={{ backgroundImage: `url('${firmWorkspaceImage}')`, backgroundPositionX: "50%", backgroundPositionY }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/15 to-black/85" />

      <div className="relative z-10 h-full flex flex-col justify-end px-6 md:px-16 pb-12 gap-8">
        <div
          className="flex flex-col gap-3 max-w-[760px] transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <p className="font-['Libre_Caslon_Text'] text-white text-[clamp(22px,2.4vw,32px)] font-light leading-[1.25] line-clamp-3">
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
