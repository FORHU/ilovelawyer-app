"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getTenantCodeConfig } from "@/config/tenant-codes";

// UK-only design: rendered exclusively when the request resolved to the UK tenant (see
// app/page.tsx), so the i18next `context` is hardcoded rather than read from the hint —
// this component has no PH code path to fall back to.
const tCtx = { context: "UK" };

const SLIDE_KEYS = ["slideOne", "slideTwo", "slideThree"] as const;
const AUTOPLAY_MS = 6200;
const slideImages = getTenantCodeConfig("UK").landingAssets.heroSlides;

export function UkHeroSection() {
  const { t } = useTranslation("landing");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDE_KEYS.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <section id="hero" className="relative h-[92vh] min-h-[620px] flex items-end overflow-hidden bg-brand-navy-950">
      {slideImages.map((src, i) => (
        <motion.div
          key={src}
          className="absolute inset-0 bg-center bg-cover"
          style={{ backgroundImage: `url('${src}')` }}
          animate={{ opacity: index === i ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: "easeInOut" }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-brand-navy-950 via-brand-navy-950/20 to-black/30" />

      <div className="relative z-10 max-w-360 mx-auto w-full px-6 md:px-16 pb-16 pt-24 grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -16 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-5"
            >
              <h1
                className="font-['Libre_Caslon_Text'] text-white text-[clamp(44px,7vw,104px)] font-normal leading-[0.95] tracking-[-0.02em]"
              >
                {t(`hero.${SLIDE_KEYS[index]}.line1`)}
                <br />
                {t(`hero.${SLIDE_KEYS[index]}.line2`)}
              </h1>
              <p className="text-white/75 text-base leading-[1.6] max-w-[540px]">
                {t(`hero.${SLIDE_KEYS[index]}.subtext`, tCtx)}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex flex-wrap items-center gap-6 pt-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/signup"
                  className="bg-brand-gold text-brand-navy-950 text-xs tracking-[1.2px] uppercase font-semibold px-8 py-4 rounded-full flex items-center gap-3 hover:bg-brand-gold/85 transition-colors duration-200"
                >
                  {t("hero.ctaPrimary")}
                  <ArrowUpRight size={14} />
                </Link>
              </TooltipTrigger>
              <TooltipContent>Create your free ilovelawyer account</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href="#capabilities"
                  className="text-white border border-white/40 text-xs tracking-[1.2px] uppercase px-8 py-4 rounded-full hover:border-white transition-colors duration-200 inline-flex items-center"
                >
                  {t("hero.ctaExplore")}
                </a>
              </TooltipTrigger>
              <TooltipContent>Jump down to see what the platform can do</TooltipContent>
            </Tooltip>

            <div className="flex items-center gap-2 ml-auto">
              {SLIDE_KEYS.map((key, i) => (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setIndex(i)}
                      aria-label={t("hero.slideLabel", { number: i + 1 })}
                      className="size-5 flex items-center justify-center cursor-pointer bg-transparent border-0"
                    >
                      <span
                        className={`rounded-full transition-all duration-300 ${
                          i === index ? "size-2.5 bg-brand-gold" : "size-2 bg-white/30 hover:bg-white/60"
                        }`}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("hero.slideLabel", { number: i + 1 })}</TooltipContent>
                </Tooltip>
              ))}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIndex((i) => (i + 1) % SLIDE_KEYS.length)}
                    aria-label={t("hero.nextSlide")}
                    className="ml-1 size-8 flex items-center justify-center rounded-full border border-white/30 text-white hover:border-white transition-colors duration-200 cursor-pointer bg-transparent"
                  >
                    <ChevronRight size={16} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("hero.nextSlide")}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
