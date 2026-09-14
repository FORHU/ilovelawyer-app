import { create } from "zustand"

const STORAGE_KEY = "terminalDisplayPreferences"

interface StoredPrefs {
  highDensity: boolean
  panelLabels: boolean
}

const DEFAULTS: StoredPrefs = {
  highDensity: false, // matches today's spacing
  panelLabels: true, // matches today's always-visible pane headers
}

interface TerminalDisplayState extends StoredPrefs {
  setHighDensity: (value: boolean) => void
  setPanelLabels: (value: boolean) => void
}

function persist(next: StoredPrefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

// Starts at DEFAULTS (not read from localStorage) so the server-rendered markup
// and the client's first render always agree; TerminalDisplayProvider reconciles
// against the persisted Display Preferences after mount. Mirrors language.store.ts.
export const useTerminalDisplayStore = create<TerminalDisplayState>()((set, get) => ({
  ...DEFAULTS,
  setHighDensity: (highDensity) => {
    const next = { ...toStoredPrefs(get()), highDensity }
    persist(next)
    set(next)
  },
  setPanelLabels: (panelLabels) => {
    const next = { ...toStoredPrefs(get()), panelLabels }
    persist(next)
    set(next)
  },
}))

function toStoredPrefs(state: StoredPrefs): StoredPrefs {
  return { highDensity: state.highDensity, panelLabels: state.panelLabels }
}

export function getStoredTerminalDisplayPrefs(): StoredPrefs | null {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      highDensity: typeof parsed.highDensity === "boolean" ? parsed.highDensity : DEFAULTS.highDensity,
      panelLabels: typeof parsed.panelLabels === "boolean" ? parsed.panelLabels : DEFAULTS.panelLabels,
    }
  } catch {
    return null
  }
}
