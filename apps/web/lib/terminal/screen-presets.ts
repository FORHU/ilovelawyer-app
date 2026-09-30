import { HIDDEN_PANELS } from "@/components/terminal/terminal-canvas"
import { autoTileLayout } from "@/lib/terminal/multi-screen"
import { PANEL_IDS } from "@/lib/terminal/types"
import type { ArrangementValue, PanelId, WorkspaceLayout } from "@/lib/terminal/types"

// One named multi-screen workspace template. `screens[0]` is always the primary window;
// screens[1+] are secondary canvas windows, matching PanelLayout.screen's numbering.
export interface ScreenPresetDef {
  id: string
  labelKey: string
  descriptionKey: string
  screens: { arrangement: ArrangementValue; panelIds: PanelId[] }[]
}

// Hand-authored, one per real day-to-day litigation workflow. Panels not listed by a preset are
// hidden when it's applied; verification/HIDDEN_PANELS are never included, same as everywhere
// else panels are listed for a user-facing picker.
export const TWO_SCREEN_PRESETS: ScreenPresetDef[] = [
  {
    id: "trial-prep",
    labelKey: "presetTrialPrep",
    descriptionKey: "presetTrialPrepDesc",
    screens: [
      { arrangement: "columns", panelIds: ["command", "chat", "evidence", "procedure"] },
      { arrangement: "free", panelIds: ["law", "mindMap", "redTeam", "citationMap"] },
    ],
  },
  {
    id: "document-review",
    labelKey: "presetDocumentReview",
    descriptionKey: "presetDocumentReviewDesc",
    screens: [
      { arrangement: "free", panelIds: ["evidence", "contradictions", "command"] },
      { arrangement: "tabs", panelIds: ["witnesses", "damages", "procedure", "teamAudit"] },
    ],
  },
  {
    id: "research-deep-dive",
    labelKey: "presetResearchDeepDive",
    descriptionKey: "presetResearchDeepDiveDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat", "law"] },
      {
        arrangement: "tabs",
        panelIds: ["citationMap", "redTeam", "legalIssues", "weaknesses", "strengths", "attackStrategy", "defenseStrategy", "theories"],
      },
    ],
  },
  {
    id: "client-intake",
    labelKey: "presetClientIntake",
    descriptionKey: "presetClientIntakeDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat"] },
      { arrangement: "free", panelIds: ["evidence", "procedure"] },
    ],
  },
  {
    id: "witness-prep",
    labelKey: "presetWitnessPrep",
    descriptionKey: "presetWitnessPrepDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat", "witnesses"] },
      { arrangement: "tabs", panelIds: ["contradictions", "redTeam", "teamAudit"] },
    ],
  },
  {
    id: "client-reporting",
    labelKey: "presetClientReporting",
    descriptionKey: "presetClientReportingDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat"] },
      { arrangement: "free", panelIds: ["decisions", "mindMap"] },
    ],
  },
]

export const THREE_SCREEN_PRESETS: ScreenPresetDef[] = [
  {
    id: "full-workspace",
    labelKey: "presetFullWorkspace",
    descriptionKey: "presetFullWorkspaceDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat"] },
      { arrangement: "columns", panelIds: ["evidence", "contradictions", "witnesses"] },
      { arrangement: "tabs", panelIds: ["law", "procedure", "mindMap", "damages", "caseReconstruction", "theories", "decisions"] },
    ],
  },
  {
    id: "trial-day",
    labelKey: "presetTrialDay",
    descriptionKey: "presetTrialDayDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat"] },
      { arrangement: "columns", panelIds: ["evidence", "witnesses", "contradictions"] },
      { arrangement: "tabs", panelIds: ["law", "redTeam", "attackStrategy", "defenseStrategy", "legalIssues", "weaknesses", "strengths"] },
    ],
  },
  {
    id: "strategy-session",
    labelKey: "presetStrategySession",
    descriptionKey: "presetStrategySessionDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat", "procedure"] },
      { arrangement: "columns", panelIds: ["mindMap", "redTeam", "theories", "decisions"] },
      { arrangement: "tabs", panelIds: ["law", "citationMap", "damages", "witnesses", "caseReconstruction", "audioOverview", "teamAudit"] },
    ],
  },
  {
    id: "motion-drafting",
    labelKey: "presetMotionDrafting",
    descriptionKey: "presetMotionDraftingDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat", "procedure"] },
      { arrangement: "free", panelIds: ["law", "citationMap"] },
      { arrangement: "tabs", panelIds: ["decisions", "legalIssues", "theories"] },
    ],
  },
  {
    id: "settlement-prep",
    labelKey: "presetSettlementPrep",
    descriptionKey: "presetSettlementPrepDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat", "damages"] },
      { arrangement: "free", panelIds: ["witnesses", "theories"] },
      { arrangement: "tabs", panelIds: ["decisions", "procedure", "teamAudit"] },
    ],
  },
  {
    id: "cross-exam-prep",
    labelKey: "presetCrossExamPrep",
    descriptionKey: "presetCrossExamPrepDesc",
    screens: [
      { arrangement: "free", panelIds: ["command", "chat"] },
      { arrangement: "columns", panelIds: ["witnesses", "contradictions"] },
      { arrangement: "tabs", panelIds: ["attackStrategy", "defenseStrategy", "redTeam"] },
    ],
  },
]

// 4-6 screens: no hand-curated content, just evenly round-robin every real panel (every PanelId
// minus verification/HIDDEN_PANELS) across however many screens are actually connected.
export function generateSpreadPreset(totalScreens: number): ScreenPresetDef {
  const allIds = PANEL_IDS.filter((id) => !HIDDEN_PANELS.has(id) && id !== "verification")
  const screens: { arrangement: ArrangementValue; panelIds: PanelId[] }[] = Array.from({ length: totalScreens }, () => ({
    arrangement: "free",
    panelIds: [],
  }))
  allIds.forEach((id, index) => {
    screens[index % totalScreens]!.panelIds.push(id)
  })
  return { id: "spread-evenly", labelKey: "presetSpreadEvenly", descriptionKey: "presetSpreadEvenlyDesc", screens }
}

// 2-letter chip code for a panel's card in the modal's per-display preview — initials of the
// title's first two words ("Case Strategy" -> "CS"), falling back to the first 2 letters of the
// id for a one-word title ("Witnesses" -> "WI").
export function panelShortCode(title: string): string {
  const words = title.split(/\s+/).filter(Boolean)
  return words.length >= 2 ? (words[0]![0]! + words[1]![0]!).toUpperCase() : title.slice(0, 2).toUpperCase()
}

// totalScreens = 1 (primary) + however many secondary screens getScreenDetails() found, matching
// sortedSecondaryScreens' count. 1 (no secondary screens) is never called — the presets button is
// only rendered when isExtendedScreen is true.
export function presetsForScreenCount(totalScreens: number): ScreenPresetDef[] {
  if (totalScreens <= 2) return TWO_SCREEN_PRESETS
  if (totalScreens === 3) return THREE_SCREEN_PRESETS
  return [generateSpreadPreset(totalScreens)]
}

// Currently-visible panels a preset would hide (assigned to no screen in it) — drives the
// presets modal's confirm-before-apply gate.
export function panelsHiddenByPreset(layout: WorkspaceLayout, preset: ScreenPresetDef): PanelId[] {
  const included = new Set(preset.screens.flatMap((s) => s.panelIds))
  return layout.panels.filter((p) => p.visible && !included.has(p.id)).map((p) => p.id)
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
// panel is hidden. Each screen's arrangement is written (screen 0 -> top-level fields, 1+ ->
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
        : { ...panel, visible: false }
    }),
  }

  preset.screens.forEach((screen, screenIndex) => {
    if (screen.arrangement === "free") next = autoTileLayout(next, undefined, screenIndex)
  })

  return next
}
