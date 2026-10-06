import { PANEL_IDS, type PanelId, type PanelLayout, type WorkspaceLayout } from "./types"

const KNOWN_PANEL_IDS = new Set<string>(PANEL_IDS)

const isKnown = (id: string | undefined): id is PanelId => id !== undefined && KNOWN_PANEL_IDS.has(id)

/** The panes the app can render. TerminalCanvas applies this to whatever it is given, so an id the app does not know
 * (a stored layout, a broadcast from another window, an API newer than the app) is skipped and never reaches
 * PaneCode. Returns the same array when every pane is known. */
export function onlyKnownPanels(panels: PanelLayout[]): PanelLayout[] {
  return panels.every((panel) => isKnown(panel.id)) ? panels : panels.filter((panel) => isKnown(panel.id))
}

/**
 * A stored layout, minus any pane the Terminal no longer has.
 *
 * ADR 0016 retired Contradictions, Citation Map, Team & Audit and Verification, and says a saved workspace that still
 * lists one "loses it on load". The API only normalises a layout when it is saved, so a workspace saved before then comes
 * back with the old ids, and every pane in the layout is rendered through `PANE_CODES[panelId]`, which is undefined for
 * them ("undefined is not iterable" in PaneCode). Applying this wherever a stored layout is read does what the ADR says.
 *
 * Mirrors the API's `normalizeLayout`: unknown ids are dropped, and if
 * nothing visible is left the Command pane is shown. Returns the same object when there is nothing to drop.
 */
export function dropUnknownPanels(layout: WorkspaceLayout): WorkspaceLayout {
  const known = layout.panels.filter((panel) => isKnown(panel.id))
  if (known.length === layout.panels.length) return layout
  const dropped = layout.panels.filter((panel) => !isKnown(panel.id)).map((panel) => `${panel.id}${panel.visible ? " (visible)" : ""}`)
  console.warn(`Dropped Terminal panes this version no longer has from a saved layout: ${dropped.join(", ")}`)

  let panels: PanelLayout[] = known
  if (!panels.some((panel) => panel.visible)) {
    panels = panels.map((panel) => (panel.id === "command" ? { ...panel, visible: true, order: 0, width: 1, height: 1 } : panel))
  }

  return { ...layout, panels }
}
