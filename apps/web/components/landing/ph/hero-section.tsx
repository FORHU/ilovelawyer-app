"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { getTenantCodeConfig } from "@/config/tenant-codes";

const SLIDE_KEYS = ["slideOne", "slideTwo", "slideThree"] as const;
const heroVideos = getTenantCodeConfig("PH").landingAssets.heroVideos;

export function HeroSection() {
  const { t } = useTranslation("landing");
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    if (reduce) return;
    const active = videoRefs.current[index];
    if (!active) return;
    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) v.pause();
    });
    active.currentTime = 0;
    void active.play();
  }, [index, reduce]);

  return (
    <section id="hero" className="relative h-[92vh] min-h-[620px] flex items-end overflow-hidden bg-brand-navy-950">
      {heroVideos.map((src, i) => (
        <motion.div
          key={src}
          className="absolute inset-0"
          animate={{ opacity: index === i ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: "easeInOut" }}
        >
          <video
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            src={src}
            muted
            playsInline
            preload="auto"
            onEnded={reduce ? undefined : () => setIndex((i) => (i + 1) % SLIDE_KEYS.length)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </motion.div>
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
                {t(`hero.${SLIDE_KEYS[index]}.subtext`)}
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
          </div>
        </div>
      </div>
    </section>
  );
}
