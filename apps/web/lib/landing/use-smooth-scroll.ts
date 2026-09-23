"use client";

import { useEffect, useRef } from "react";

const LERP = 0.09;
const SNAP_THRESHOLD = 0.4;
const LINE_MODE_MULTIPLIER = 18;
const RESYNC_THRESHOLD = 60;

/** Lerped wheel-hijack smooth scroll, per the handoff's spec (§F Smooth scroll).
 * Hand-rolled rather than pulling in Lenis (the handoff's suggested off-the-shelf
 * option) because the full algorithm — including the self-disabling fallback — is
 * fully specified and small; swap for Lenis later if this needs to grow.
 *
 * The self-disabling probe matters: some hosts (embedded iframes, scroll-managed
 * containers) silently refuse programmatic scrollTo writes. Without detecting that
 * and bailing out, the page would intercept every wheel event and go dead. */
export function useSmoothScroll(enabled: boolean) {
  const stateRef = useRef({ current: 0, target: 0, raf: 0, probed: false, active: false });

  useEffect(() => {
    if (!enabled) return;

    const state = stateRef.current;
    state.current = window.scrollY;
    state.target = window.scrollY;
    state.probed = false;
    state.active = true;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom passthrough
      if (!state.active) return;
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * LINE_MODE_MULTIPLIER : e.deltaY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      state.target = Math.min(Math.max(state.target + delta, 0), max);
    };

    const onExternalScroll = () => {
      if (Math.abs(window.scrollY - state.current) > RESYNC_THRESHOLD) {
        state.current = window.scrollY;
        state.target = window.scrollY;
      }
    };

    const tick = () => {
      if (!state.active) return;
      const delta = state.target - state.current;
      if (Math.abs(delta) < SNAP_THRESHOLD) {
        state.current = state.target;
      } else {
        state.current += delta * LERP;
      }
      window.scrollTo(0, state.current);

      if (!state.probed && state.current > 1) {
        state.probed = true;
        // If the write above didn't move the real scroll position, this host owns
        // scrolling itself — stop hijacking and fall back to native scroll.
        if (Math.abs(window.scrollY - state.current) > 1) {
          state.active = false;
          window.removeEventListener("wheel", onWheel);
          window.removeEventListener("scroll", onExternalScroll);
          return;
        }
      }
      state.raf = requestAnimationFrame(tick);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onExternalScroll, { passive: true });
    state.raf = requestAnimationFrame(tick);

    return () => {
      state.active = false;
      cancelAnimationFrame(state.raf);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onExternalScroll);
    };
  }, [enabled]);
}
