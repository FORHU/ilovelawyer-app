"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { getTenantCodeConfig } from "@/config/tenant-codes";
import { EASE_EXPO_OUT, LANDING_DURATIONS, LANDING_STAGGERS } from "@/lib/landing/motion-tokens";
import { smoothScrollToHash } from "@/lib/landing/smooth-scroll-to";
import type { TenantCode } from "@/lib/tenant-code/resolve-host";

// PH and UK render identical hero markup/motion, differing only in tenant asset paths and
// the i18next context suffix on copy keys — kept as one component (per redesign handoff
// §2 Hero) rather than duplicated across ph/ and uk/, since the kinetic-type animation and
// slide-progression logic below is exactly the kind of thing that drifts out of sync between
// two hand-copied files.

const SLIDE_KEYS = ["slideOne", "slideTwo", "slideThree"] as const;
const FOCUS_RING = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#221f1a]";

const lineVariants = {
  hidden: { y: "110%", opacity: 0 },
  visible: (i: number) => ({
    y: 0,
    opacity: 1,
    transition: {
      y: { duration: LANDING_DURATIONS.heroLineInTransform, ease: EASE_EXPO_OUT, delay: i * LANDING_STAGGERS.heroLineIn },
      opacity: { duration: LANDING_DURATIONS.heroLineInOpacity, delay: i * LANDING_STAGGERS.heroLineIn },
    },
  }),
  exit: (i: number) => ({
    y: "-110%",
    opacity: 0,
    transition: {
      y: { duration: LANDING_DURATIONS.heroLineOutTransform, ease: EASE_EXPO_OUT, delay: i * LANDING_STAGGERS.heroLineOut },
      opacity: { duration: LANDING_DURATIONS.heroLineOutOpacity, delay: i * LANDING_STAGGERS.heroLineOut },
    },
  }),
};

export function HeroSectionBase({ tenantCode }: { tenantCode: TenantCode }) {
  const { t } = useTranslation("landing");
  const tCtx = tenantCode === "UK" ? { context: "UK" } : undefined;
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const { heroVideos, heroPosters } = getTenantCodeConfig(tenantCode).landingAssets;

  // Loads/restarts the active slide's video. With reduced motion on, nothing autoplays.
  useEffect(() => {
    const active = videoRefs.current[index];
    if (!active) return;
    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) v.pause();
    });
    if (active.preload !== "auto") active.preload = "auto";
    active.currentTime = 0;
    if (!reduce) void active.play();
  }, [index, reduce]);

  const advance = () => setIndex((i) => (i + 1) % SLIDE_KEYS.length);

  return (
    <section id="hero" className="relative h-[92dvh] min-h-[620px] flex items-end overflow-hidden bg-[#221f1a]">
      {heroVideos.map((src, i) => (
        <motion.div
          key={src}
          className="absolute inset-0"
          animate={{ opacity: index === i ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : LANDING_DURATIONS.heroBgCrossfade, ease: "easeInOut" }}
        >
          <video
            ref={(el) => {
              videoRefs.current[i] = el;
            }}
            src={src}
            poster={heroPosters[i]}
            muted
            playsInline
            preload={i === 0 ? "auto" : "metadata"}
            onEnded={reduce ? undefined : advance}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </motion.div>
      ))}

      {/* Two scrims (handoff §2): a full-bleed gradient for text legibility, plus a bottom
          fade that melts the hero into the black section below with no visible seam. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/32 via-black/5 to-black/42" />
      <div className="absolute inset-x-0 bottom-0 h-[180px] bg-gradient-to-t from-[#0b0b0b] to-transparent" />

      <div className="relative z-10 w-full px-6 pb-16 pt-24">
        <div className="flex flex-col">
          {reduce ? (
            <div className="flex flex-col">
              {(["line1", "line2"] as const).map((lineKey, i) => (
                <h1
                  key={lineKey}
                  className={`font-display text-white text-[clamp(72px,13.5vw,200px)] font-light leading-[0.95] tracking-[-0.03em] ${
                    i === 0 ? "text-left" : "text-right"
                  }`}
                >
                  {t(`hero.${SLIDE_KEYS[index]}.${lineKey}`, tCtx)}
                </h1>
              ))}
            </div>
          ) : (
            // The line mask's em-based padding must resolve against the headline's own font size (set on
            // the mask too), otherwise it's computed from the 16px body size and clips descenders (g, y).
            <AnimatePresence mode="popLayout">
              <div key={index} className="flex flex-col">
                {(["line1", "line2"] as const).map((lineKey, i) => (
                  <div key={lineKey} className="overflow-hidden pt-[0.2em] pb-[0.6em] -mt-[0.2em] -mb-[0.6em] text-[clamp(72px,13.5vw,200px)]">
                    <motion.h1
                      custom={i}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={lineVariants}
                      className={`font-display text-white text-[clamp(72px,13.5vw,200px)] font-light leading-[0.95] tracking-[-0.03em] ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {t(`hero.${SLIDE_KEYS[index]}.${lineKey}`, tCtx)}
                    </motion.h1>
                  </div>
                ))}
              </div>
            </AnimatePresence>
          )}

          <AnimatePresence mode="wait">
            <motion.p
              key={index}
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: LANDING_DURATIONS.captionCrossfade }}
              className={`absolute z-10 text-white text-sm leading-[1.35] ${
                index === 1
                  ? "left-[84px] bottom-[26px] w-[380px] max-w-[calc(100%-108px)]"
                  : "right-6 bottom-[calc(64px+clamp(130px,18vw,250px))] w-[380px] max-w-[calc(100%-3rem)] text-right"
              }`}
            >
              {t(`hero.${SLIDE_KEYS[index]}.subtext`, tCtx)}
              <span aria-hidden className="ml-2">→</span>
            </motion.p>
          </AnimatePresence>

        </div>
      </div>

      <button
        type="button"
        aria-label={t("hero.nextSlide")}
        onClick={advance}
        className="absolute right-6 md:right-16 top-[18%] z-10 text-white text-3xl font-thin opacity-90 hover:opacity-60 transition-opacity duration-200 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      >
        &rsaquo;
      </button>

      <motion.button
        type="button"
        aria-label={t("hero.scrollDown")}
        onClick={() => smoothScrollToHash("#capabilities")}
        className={`absolute left-8 bottom-7 z-10 text-white text-3xl font-thin rounded-full ${FOCUS_RING}`}
        animate={reduce ? {} : { y: [0, -6, 0] }}
        transition={reduce ? {} : { duration: 3.9, repeat: Infinity, ease: "easeInOut" }}
      >
        &darr;
      </motion.button>
    </section>
  );
}
