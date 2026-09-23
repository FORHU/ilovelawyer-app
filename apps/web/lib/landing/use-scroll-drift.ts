"use client";

import { useRef } from "react";
import type { RefObject } from "react";
import { useMotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";
import { useNoHover } from "./use-no-hover";

/** Ties an element's scroll-into-view progress to a drifting output value (px offset,
 * percentage position, etc.) over the "start end"/"end start" window — the parallax
 * accent shared by the hero quote, consultation, and firms sections.
 *
 * Handoff §J/responsive: drift is disabled under prefers-reduced-motion and on touch
 * devices, so in either case this returns a static value pinned to the range's resting
 * position instead of the scroll-linked transform (all hooks are still called
 * unconditionally, satisfying rules-of-hooks). */
export function useScrollDrift<T extends HTMLElement = HTMLDivElement, O extends number | string = number>(
  range: [O, O],
): [RefObject<T | null>, MotionValue<O>] {
  const ref = useRef<T>(null);
  const reduce = useReducedMotion();
  const noHover = useNoHover();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const driftValue = useTransform(scrollYProgress, [0, 1], range);
  const staticValue = useMotionValue(range[0]);
  return [ref, reduce || noHover ? staticValue : driftValue];
}
