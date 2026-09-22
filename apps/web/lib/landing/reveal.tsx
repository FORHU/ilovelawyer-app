"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_EXPO_OUT, LANDING_DURATIONS, LANDING_STAGGERS } from "./motion-tokens";

/** Fade + rise reveal-on-scroll, matching the handoff's IntersectionObserver spec
 * (translateY(26px)->0, 900ms expo-out, staggered min(index,6)*90ms, fires once).
 * Framer Motion's `whileInView` + `viewport.once` covers the IntersectionObserver
 * plumbing natively, so this is a thin wrapper rather than a hand-rolled observer.
 *
 * `index` is the sibling position within its group, used for the capped stagger.
 * `driftOnly` matches data-drift elements in the handoff, which fade without a
 * Y transform because drift owns their transform instead. */
export function Reveal({
  children,
  index = 0,
  driftOnly = false,
  as: Component = motion.div,
  className,
}: {
  children: ReactNode;
  index?: number;
  driftOnly?: boolean;
  as?: typeof motion.div | typeof motion.h2 | typeof motion.p | typeof motion.blockquote;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const delay = Math.min(index, LANDING_STAGGERS.revealMaxIndex) * LANDING_STAGGERS.revealPerItem;

  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y: driftOnly ? 0 : 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px", amount: 0.08 }}
      transition={{ duration: reduce ? 0 : LANDING_DURATIONS.reveal, delay: reduce ? 0 : delay, ease: EASE_EXPO_OUT }}
    >
      {children}
    </Component>
  );
}
