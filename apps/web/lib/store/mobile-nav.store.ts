import { create } from "zustand"

/** Open/closed state for GlobalHeader's mobile nav drawer, lifted out of GlobalHeader itself so
 * a page can render its own hamburger trigger (e.g. inline with a page-specific title row) that
 * still opens the exact same drawer, rather than each trigger owning a separate closed state.
 *
 * `headerMerged` lives here too because GlobalHeader is mounted once in the homepage layout,
 * not per page — a page that renders its own trigger flips it on (via PageShell's
 * mobileHeaderMerged) for as long as it's mounted, instead of passing a prop to a header it
 * no longer owns. */
interface MobileNavState {
  isOpen: boolean
  headerMerged: boolean
  toggle: () => void
  close: () => void
  setHeaderMerged: (merged: boolean) => void
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  isOpen: false,
  headerMerged: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
  setHeaderMerged: (merged) => set({ headerMerged: merged }),
}))
