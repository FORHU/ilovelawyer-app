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
 * Anything `position: fixed` (the navbar) must render OUTSIDE this provider — GSAP applies
 * a transform to the wrapper element to drive the smoothing, and a transformed ancestor
 * becomes a new containing block for `position: fixed` descendants (CSS spec), which would
 * silently break the navbar's fixed-to-viewport behavior. `position: sticky` (the footer
 * reveal) is unaffected and is fine inside.
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
      });
      return () => smoother.kill();
    },
    { dependencies: [reducedMotion], scope: wrapperRef },
  );

  return (
    <div id="smooth-wrapper" ref={wrapperRef} className="flex-1 flex flex-col">
      <div id="smooth-content" ref={contentRef} className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}
