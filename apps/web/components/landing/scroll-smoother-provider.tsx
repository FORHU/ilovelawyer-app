"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { useGSAP } from "@gsap/react";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

/**
 * Handoff §F smooth scroll ("prefer Lenis or equivalent... keep the fallback behavior") —
 * implemented with GSAP's ScrollSmoother (already an app dependency, used elsewhere for
 * the terminal's pane animations) instead of a hand-rolled wheel-hijack rAF loop.
 * `smoothTouch` is left at its default (disabled), which is exactly the handoff's "disable
 * scroll hijack on touch" requirement — ScrollSmoother only applies the lerped feel to
 * non-touch (wheel/trackpad) input; touch scrolling stays native.
 *
 * IMPORTANT: everything that should scroll with the page goes inside `children` here.
 * Anything `position: fixed` (the navbar, and the footer — see footer-reveal-portal.tsx)
 * must render OUTSIDE this provider — GSAP applies a transform to the content element and
 * `overflow: hidden` + `position: fixed` to the wrapper to drive the smoothing, and both
 * break `position: fixed`/`sticky` descendants (confirmed against the ScrollSmoother docs
 * and the library's own source after the first attempt at this broke the sticky footer).
 */
export function ScrollSmootherProvider({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reducedMotion || !wrapperRef.current || !contentRef.current) return;
      const smoother = ScrollSmoother.create({
        wrapper: wrapperRef.current,
        content: contentRef.current,
        // ponytail: 0.6 is a judgment call, not a literal port of the handoff's 0.09
        // per-frame lerp constant (ScrollSmoother's `smooth` is a smoothing duration in
        // seconds, a different unit) — tune after a visual check if it reads too heavy/light.
        smooth: 0.6,
        // Explicit, though it's ScrollSmoother's own default — the handoff's "disable
        // scroll hijack on touch" requirement, spelled out rather than left implicit.
        smoothTouch: false,
      });
      return () => smoother.kill();
    },
    { dependencies: [reducedMotion], scope: wrapperRef },
  );

  return (
    <div id="smooth-wrapper" ref={wrapperRef} className="flex-1 flex flex-col">
      <div id="smooth-content" ref={contentRef} className="relative z-10 flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
