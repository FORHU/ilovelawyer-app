/** Shared motion constants for the landing redesign (ilovelawyer-app-redesign-handoff).
 * Mirrors the CSS `--ease-landing` custom property in globals.css, in the array form
 * Framer Motion/GSAP expect. Keep the two in sync if the easing ever changes. */
export const EASE_EXPO_OUT = [0.16, 1, 0.3, 1] as const;

export const LANDING_DURATIONS = {
  heroLineInTransform: 1,
  heroLineInOpacity: 0.7,
  heroLineOutTransform: 0.8,
  heroLineOutOpacity: 0.5,
  heroBgCrossfade: 0.9,
  reveal: 0.9,
  cardExpand: 0.42,
  magneticPush: 0.26,
  iconChipHover: 0.22,
  headerInversion: 0.3,
} as const;

export const LANDING_STAGGERS = {
  heroLineIn: 0.11,
  heroLineOut: 0.08,
  /** Reveal stagger caps at the 6th sibling — later items reveal with the same delay
   * as the 6th, not progressively later. */
  revealPerItem: 0.09,
  revealMaxIndex: 6,
} as const;
