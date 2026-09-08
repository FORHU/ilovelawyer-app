"use client";

import { useRef } from "react";
import type { RefObject } from "react";
import { useScroll, useTransform } from "framer-motion";
import type { MotionValue } from "framer-motion";

/** Ties an element's scroll-into-view progress to a drifting output value (px offset,
 * percentage position, etc.) over the "start end"/"end start" window — the parallax
 * accent shared by the hero quote, consultation, and firms sections. */
export function useScrollDrift<T extends HTMLElement = HTMLDivElement, O extends number | string = number>(
  range: [O, O],
): [RefObject<T | null>, MotionValue<O>] {
  const ref = useRef<T>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const value = useTransform(scrollYProgress, [0, 1], range);
  return [ref, value];
}
