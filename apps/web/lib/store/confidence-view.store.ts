import { create } from "zustand"

const STORAGE_KEY = "confidenceView"

interface ConfidenceViewState {
  /** Confidence view on/off — one switch for every chat surface (Consultation, Case Workspace,
   * Legal Terminal). Off by default. */
  on: boolean
  /** True once the persisted choice has been read (after mount). */
  hydrated: boolean
  setOn: (on: boolean) => void
  toggle: () => void
  hydrate: () => void
}

function save(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "1" : "0")
  } catch {
    // private mode / storage disabled: the switch still works for this page view
  }
}

// Starts off (not read from localStorage) so server-rendered markup and the client's first render
// agree; ConfidenceViewToggle calls hydrate() after mount. Same idea as terminal-display.store.ts.
export const useConfidenceViewStore = create<ConfidenceViewState>()((set, get) => ({
  on: false,
  hydrated: false,
  setOn: (on) => {
    save(on)
    set({ on })
  },
  toggle: () => get().setOn(!get().on),
  hydrate: () => {
    if (get().hydrated) return
    let on = false
    try {
      on = localStorage.getItem(STORAGE_KEY) === "1"
    } catch {
      on = false
    }
    set({ on, hydrated: true })
  },
}))
