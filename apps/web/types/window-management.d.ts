// Minimal ambient types for the Window Management API (`getScreenDetails`/`ScreenDetailed`/
// `isExtended`) — no @types package or existing declaration for this exists anywhere in the
// repo (confirmed before adding this). Chrome/Edge-only today; every field is optional so
// Firefox/Safari (where `window.screen.isExtended` and `window.getScreenDetails` are simply
// undefined) type-check the same as everywhere else — callers gate on `isExtended` before ever
// touching `getScreenDetails()`, see legal-terminal.tsx's round-robin action.
export {}

declare global {
  interface ScreenDetailed {
    left: number
    top: number
    width: number
    height: number
    isPrimary: boolean
  }

  interface Screen {
    /** True when the user has granted multi-screen placement and more than one screen is
     * attached — cheap, permission-free to read. */
    isExtended?: boolean
  }

  interface Window {
    /** Triggers the browser's multi-screen permission prompt the first time it's called — only
     * ever call this from inside a real click handler, never on mount/effect. */
    getScreenDetails?(): Promise<{ screens: ScreenDetailed[] }>
  }
}
