"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollSmoother } from "gsap/ScrollSmoother";

gsap.registerPlugin(ScrollToPlugin);

// Clears the fixed header before the target's own top edge.
const HEADER_OFFSET = 80;

/** Eased scroll-to for the navbar's anchor links and the hero's scroll-cue arrow (handoff's
 * "animate scroll position" demo). When a ScrollSmoother instance is active, scrolling must
 * go through its own `.scrollTo()` — plain `gsap.to(window, {scrollTo})` doesn't coordinate
 * with ScrollSmoother's virtualized scroll position. `ScrollSmoother.get()` is a static
 * lookup, so this works from components (like the navbar) that render outside the
 * ScrollSmoother wrapper. */
export function smoothScrollToHash(hash: string) {
  const target = document.querySelector<HTMLElement>(hash);
  if (!target) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smoother = ScrollSmoother.get();

  if (smoother) {
    smoother.scrollTo(target, !reduce, `top ${HEADER_OFFSET}px`);
    return;
  }

  gsap.to(window, {
    duration: reduce ? 0 : 1,
    scrollTo: { y: target, offsetY: HEADER_OFFSET },
    ease: "power2.inOut",
  });
}
