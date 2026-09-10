import { create } from "zustand"

/** Open/closed state for GlobalHeader's mobile nav drawer, lifted out of GlobalHeader itself so
 * a page can render its own hamburger trigger (e.g. inline with a page-specific title row) that
 * still opens the exact same drawer, rather than each trigger owning a separate closed state. */
interface MobileNavState {
  isOpen: boolean
  toggle: () => void
  close: () => void
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}))
