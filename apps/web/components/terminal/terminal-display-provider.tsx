"use client"

import { useEffect } from "react"
import { getStoredTerminalDisplayPrefs, useTerminalDisplayStore } from "@/lib/store/terminal-display.store"

export function TerminalDisplayProvider({ children }: { children: React.ReactNode }) {
  const setHighDensity = useTerminalDisplayStore((state) => state.setHighDensity)
  const setGridSnapping = useTerminalDisplayStore((state) => state.setGridSnapping)
  const setPanelLabels = useTerminalDisplayStore((state) => state.setPanelLabels)

  // Reconciles against the persisted Display Preferences once, client-only, after
  // the first render — keeps the server-rendered defaults and the client's first
  // render in agreement, then switches if the user had picked something else.
  // Mirrors I18nProvider's reconciliation of Language Preference.
  useEffect(() => {
    const stored = getStoredTerminalDisplayPrefs()
    if (!stored) return
    setHighDensity(stored.highDensity)
    setGridSnapping(stored.gridSnapping)
    setPanelLabels(stored.panelLabels)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
