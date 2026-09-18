import { useSyncExternalStore } from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

// Every GSAP tween in the app (terminal's panel-kit row enter/exit, ModalOverlay's open/close,
// the async-arrival stagger, damage/RiskMeter tweening, MobileDrawer's slide) must check this and
// jump straight to its end state instead — GSAP has no built-in opinion on prefers-reduced-motion,
// unlike the CSS transitions already in globals.css.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
