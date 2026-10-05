"use client";

import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollToPlugin, ScrollTrigger);

// Clears the fixed header before the target's own top edge.
const HEADER_OFFSET = 80;

/** The navbar's "Resources" link. The footer is `position: fixed` under the page and only fully
 * shows once the page is scrolled all the way down (footer-reveal-portal.tsx) — scrolling the
 * #footer-spacer's top edge to the header instead stopped on an empty band above the footer. */
export const FOOTER_HASH = "#footer";

/** Eased scroll-to for the navbar's anchor links and the hero's scroll-cue arrow (handoff's
 * "animate scroll position" demo). When a ScrollSmoother instance is active, scrolling must
 * go through its own `.scrollTo()` — plain `gsap.to(window, {scrollTo})` doesn't coordinate
 * with ScrollSmoother's virtualized scroll position. `ScrollSmoother.get()` is a static
 * lookup, so this works from components (like the navbar) that render outside the
 * ScrollSmoother wrapper. */
export function smoothScrollToHash(hash: string) {
  const toEnd = hash === FOOTER_HASH;
  const target = toEnd ? null : document.querySelector<HTMLElement>(hash);
  if (!toEnd && !target) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const smoother = ScrollSmoother.get();

  if (smoother) {
    if (toEnd) smoother.scrollTo(ScrollTrigger.maxScroll(window), !reduce);
    else smoother.scrollTo(target, !reduce, `top ${HEADER_OFFSET}px`);
    return;
  }

  gsap.to(window, {
    duration: reduce ? 0 : 1,
    scrollTo: toEnd ? { y: "max" } : { y: target!, offsetY: HEADER_OFFSET },
    ease: "power2.inOut",
  });
}
