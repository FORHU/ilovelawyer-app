import { HIDDEN_PANELS } from "@/components/terminal/terminal-canvas"
import { arrangementForScreen, autoTileLayout } from "@/lib/terminal/multi-screen"
import { PANEL_IDS } from "@/lib/terminal/types"
import type { ArrangementValue, PanelId, ScreenPresetRow, WorkspaceLayout } from "@/lib/terminal/types"

// One named multi-screen workspace template. `screens[0]` is always the primary window;
// screens[1+] are secondary canvas windows, matching PanelLayout.screen's numbering.
//
// `userId` mirrors the DB row this came from: null for a system preset (seeded, global — see
// ilovelawyer-api's prisma/seeders/screen-preset-grouped.seeder.ts) or the generated "Spread Evenly"
// preset below (never a DB row, but conceptually global too); a real id for the caller's own
// saved preset. `labelKey`/`descriptionKey` are set only for system/generated presets, resolved
// through terminal.json — presetLabel/presetDescription below fall back to the plain `name`/
// `description` text a user's own preset actually has.
export interface ScreenPresetDef {
  id: string
  userId: string | null
  labelKey?: string
  descriptionKey?: string
  name: string
  description?: string
  screens: { arrangement: ArrangementValue; panelIds: PanelId[] }[]
}

// Panel ids this build knows. A stored preset can still list a retired pane (a lawyer's own saved
// preset, or an API that hasn't dropped it yet — see ilovelawyer-api's dropUnknownPanelIds), and
// every consumer here looks its title up in PANEL_TITLES.
const KNOWN_PANEL_IDS = new Set<string>(PANEL_IDS)

export function fromRow(row: ScreenPresetRow): ScreenPresetDef {
  return {
    id: row.id,
    userId: row.userId,
    labelKey: row.labelKey ?? undefined,
    descriptionKey: row.descriptionKey ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    // Unknown ids dropped; every screen kept, even one left empty, so screen indices still line up.
    screens: row.screens.map((screen) => ({ ...screen, panelIds: screen.panelIds.filter((id) => KNOWN_PANEL_IDS.has(id)) })),
  }
}

export function presetLabel(preset: ScreenPresetDef, t: (key: string) => string): string {
  return preset.labelKey ? t(preset.labelKey) : preset.name
}

export function presetDescription(preset: ScreenPresetDef, t: (key: string) => string): string | undefined {
  return preset.descriptionKey ? t(preset.descriptionKey) : preset.description
}

// 4-6 screens: no hand-curated content, just evenly round-robin every real panel (every PanelId
// minus HIDDEN_PANELS) across however many screens are actually connected. Purely
// client-side/algorithmic (depends on live screen count) — never a DB row.
export function generateSpreadPreset(totalScreens: number): ScreenPresetDef {
  const allIds = PANEL_IDS.filter((id) => !HIDDEN_PANELS.has(id))
  const screens: { arrangement: ArrangementValue; panelIds: PanelId[] }[] = Array.from({ length: totalScreens }, () => ({
    arrangement: "free",
    panelIds: [],
  }))
  allIds.forEach((id, index) => {
    screens[index % totalScreens]!.panelIds.push(id)
  })
  return {
    id: "spread-evenly",
    userId: null,
    labelKey: "presetSpreadEvenly",
    descriptionKey: "presetSpreadEvenlyDesc",
    name: "Spread Evenly",
    screens,
  }
}

// 2-letter chip code for a panel's card in the modal's per-display preview — initials of the
// title's first two words ("Case Strategy" -> "CS"), falling back to the first 2 letters of the
// id for a one-word title ("Witnesses" -> "WI").
export function panelShortCode(title: string): string {
  const words = title.split(/\s+/).filter(Boolean)
  return words.length >= 2 ? (words[0]![0]! + words[1]![0]!).toUpperCase() : title.slice(0, 2).toUpperCase()
}

// `preset` with the panels of every screen in `screenIndices` moved onto screen 0 (appended after
// its own), those screens left empty but in place so every other screen keeps its index. Used
// when a display's window couldn't be opened (popup blocked, monitor gone): its panels still show,
// in the primary window, instead of waiting on a window that doesn't exist.
export function foldScreensIntoPrimary(preset: ScreenPresetDef, screenIndices: number[]): ScreenPresetDef {
  if (screenIndices.length === 0) return preset
  const folded = new Set(screenIndices)
  const moved = preset.screens.flatMap((screen, index) => (folded.has(index) ? screen.panelIds : []))
  return {
    ...preset,
    screens: preset.screens.map((screen, index) =>
      index === 0 ? { ...screen, panelIds: [...screen.panelIds, ...moved] } : folded.has(index) ? { ...screen, panelIds: [] } : screen,
    ),
  }
}

// Currently-visible panels a preset would hide (assigned to no screen in it) — drives the
// presets modal's confirm-before-apply gate.
export function panelsHiddenByPreset(layout: WorkspaceLayout, preset: ScreenPresetDef): PanelId[] {
  const included = new Set(preset.screens.flatMap((s) => s.panelIds))
  return layout.panels.filter((p) => p.visible && !included.has(p.id)).map((p) => p.id)
}

// Snapshot of the live layout's own screens (visible panels grouped by which screen they're on,
// each screen's current arrangement) — the "Save as preset" action's source data. Only screens
// 0..screenCount-1 that actually have a visible panel are included; an in-between empty screen
// (e.g. screen 1 has nothing, screen 2 does — the reaper hasn't caught up yet) is skipped rather
// than saved as a dead entry a future apply would just hide everything on.
export function captureCurrentScreens(layout: WorkspaceLayout, screenCount: number): { arrangement: ArrangementValue; panelIds: PanelId[] }[] {
  const screens: { arrangement: ArrangementValue; panelIds: PanelId[] }[] = []
  for (let screen = 0; screen < screenCount; screen++) {
    const panelIds = layout.panels
      .filter((p) => p.visible && (p.screen ?? 0) === screen && !HIDDEN_PANELS.has(p.id))
      .sort((a, b) => a.order - b.order)
      .map((p) => p.id)
    if (panelIds.length > 0) screens.push({ arrangement: arrangementForScreen(layout, screen), panelIds })
  }
  return screens
}

// Columns mode auto-balances any panel with no (or an out-of-range) columnIndex across however
// many columns exist (see columnsOf in terminal-canvas.tsx) — but it still needs an explicit
// columnCount. Leaving it unset is worse than just cosmetic: legal-terminal.tsx's own legacy-save
// migration (asLayout) reads "arrangement is columns with no columnCount" as a pre-rework save and
// silently reinterprets the whole screen as Free, rendering it with whatever stale x/y those
// panels happened to carry from before — exactly the overlapping-panels bug this avoids.
function columnCountFor(panelCount: number): number {
  return Math.min(3, Math.max(2, panelCount))
}

// Applies a preset: every panel the preset lists becomes visible on its screen; every other
// panel is hidden and moved back to screen 0, so a display the preset doesn't use isn't still
// counted as "in use" (and offered for reopening) because of a hidden panel. Each screen's arrangement is written (screen 0 -> top-level fields, 1+ ->
// screenLayouts[n]); a Columns screen also gets a columnCount (see columnCountFor above), and a
// Free screen gets its rects seeded by autoTileLayout. Tabs/Focus need neither — Tabs
// auto-balances into its 2 groups the same way Columns does, Focus just needs an active pane.
export function applyScreenPreset(layout: WorkspaceLayout, preset: ScreenPresetDef): WorkspaceLayout {
  const placement = new Map<PanelId, { screen: number; order: number }>()
  preset.screens.forEach((screen, screenIndex) => {
    screen.panelIds.forEach((id, order) => placement.set(id, { screen: screenIndex, order }))
  })

  const primary = preset.screens[0]!
  let next: WorkspaceLayout = {
    ...layout,
    arrangement: primary.arrangement,
    columnCount: primary.arrangement === "columns" ? columnCountFor(primary.panelIds.length) : layout.columnCount,
    screenLayouts: {
      ...layout.screenLayouts,
      ...Object.fromEntries(
        preset.screens.slice(1).map((screen, index) => [
          index + 1,
          {
            ...layout.screenLayouts?.[index + 1],
            arrangement: screen.arrangement,
            columnCount: screen.arrangement === "columns" ? columnCountFor(screen.panelIds.length) : layout.screenLayouts?.[index + 1]?.columnCount,
          },
        ]),
      ),
    },
    panels: layout.panels.map((panel) => {
      const spot = placement.get(panel.id)
      return spot
        ? { ...panel, visible: true, screen: spot.screen || undefined, order: spot.order }
        : { ...panel, visible: false, screen: undefined }
    }),
  }

  preset.screens.forEach((screen, screenIndex) => {
    if (screen.arrangement === "free") next = autoTileLayout(next, undefined, screenIndex)
  })

  return next
}
