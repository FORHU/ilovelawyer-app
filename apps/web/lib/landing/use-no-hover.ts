"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: hover)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return !window.matchMedia(QUERY).matches;
}

/** True on touch devices with no real hover capability — the handoff's blanket "disable
 * magnetic hover, scroll hijack, and scroll-drift on touch" requirement (§ responsive
 * breakpoints), applied consistently via one shared check instead of a per-component
 * matchMedia call. Mirrors use-reduced-motion.ts's useSyncExternalStore pattern. */
export function useNoHover(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
