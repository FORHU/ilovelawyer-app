"use client";

import { useRef } from "react";
import type { RefObject } from "react";
import { useMotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

/** Ties an element's scroll-into-view progress to a drifting output value (px offset,
 * percentage position, etc.) over the "start end"/"end start" window — the parallax
 * accent shared by the hero quote, consultation, and firms sections.
 *
 * Handoff §J: drift is disabled under prefers-reduced-motion, so under reduced motion this
 * returns a static value pinned to the range's resting position instead of the scroll-linked
 * transform (both hooks are still called unconditionally, satisfying rules-of-hooks). */
export function useScrollDrift<T extends HTMLElement = HTMLDivElement, O extends number | string = number>(
  range: [O, O],
): [RefObject<T | null>, MotionValue<O>] {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const driftValue = useTransform(scrollYProgress, [0, 1], range);
  const staticValue = useMotionValue(range[0]);
  return [ref, reduce ? staticValue : driftValue];
}
