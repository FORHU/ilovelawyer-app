import { describe, it, expect } from "vitest"
import { dropUnknownPanels, onlyKnownPanels } from "../drop-unknown-panels"
import type { PanelId, PanelLayout, WorkspaceLayout } from "../types"

// ADR 0016 retired these four panes. A workspace saved before then still lists them, and the API returns a saved
// layout exactly as stored (it only normalises on save), so the Terminal used to crash in PaneCode on
// `const [code, tone] = PANE_CODES[panelId]` ("undefined is not iterable").
const RETIRED = ["contradictions", "citationMap", "teamAudit", "verification"] as unknown as PanelId[]

function panel(id: string, visible = true, order = 0): PanelLayout {
  return { id: id as PanelId, visible, order, width: 1, height: 1 }
}

function layout(panels: PanelLayout[], extra: Partial<WorkspaceLayout> = {}): WorkspaceLayout {
  return { preset: "PANE_4", arrangement: "columns", panels, ...extra }
}

describe("dropUnknownPanels", () => {
  it("drops panes the catalog no longer has and keeps the rest in order", () => {
    const input = layout([panel("command", true, 0), panel("contradictions", true, 1), panel("evidence", true, 2), panel("verification", false, 3)])
    const out = dropUnknownPanels(input)
    expect(out.panels.map((p) => p.id)).toEqual(["command", "evidence"])
  })

  it("covers all four retired panes", () => {
    const input = layout([panel("command"), ...RETIRED.map((id, i) => panel(id, true, i + 1))])
    expect(dropUnknownPanels(input).panels.map((p) => p.id)).toEqual(["command"])
  })

  it("returns the same layout object when nothing needs dropping", () => {
    const input = layout([panel("command"), panel("evidence")])
    expect(dropUnknownPanels(input)).toBe(input)
  })

  it("clears a tab that points at a dropped pane, at the top level and per screen", () => {
    const input = layout([panel("command"), panel("evidence")], {
      tabsActiveA: "contradictions" as PanelId,
      tabsActiveB: "evidence",
      screenLayouts: { 1: { tabsActiveA: "verification" as PanelId, tabsActiveB: "command" } },
    })
    const out = dropUnknownPanels(input)
    expect(out.tabsActiveA).toBeUndefined()
    expect(out.tabsActiveB).toBe("evidence")
    expect(out.screenLayouts?.[1]?.tabsActiveA).toBeUndefined()
    expect(out.screenLayouts?.[1]?.tabsActiveB).toBe("command")
  })

  it("shows the Command pane when dropping leaves nothing visible", () => {
    const input = layout([panel("command", false, 5), panel("contradictions", true, 0), panel("citationMap", true, 1)])
    const out = dropUnknownPanels(input)
    const command = out.panels.find((p) => p.id === "command")
    expect(command).toMatchObject({ visible: true, order: 0, width: 1, height: 1 })
  })

  it("does not touch visibility when a visible pane survives", () => {
    const input = layout([panel("command", false, 0), panel("evidence", true, 1), panel("teamAudit", true, 2)])
    const out = dropUnknownPanels(input)
    expect(out.panels.find((p) => p.id === "command")?.visible).toBe(false)
  })

  it("leaves an empty result alone when there is no Command pane to fall back on", () => {
    const out = dropUnknownPanels(layout([panel("contradictions")]))
    expect(out.panels).toEqual([])
  })

  it("does not mutate its input", () => {
    const input = layout([panel("command"), panel("contradictions")])
    const before = JSON.stringify(input)
    dropUnknownPanels(input)
    expect(JSON.stringify(input)).toBe(before)
  })
})

// The last line of defence: TerminalCanvas filters what it is asked to render, so an unknown id that reached it by any route
// (a stored layout, a broadcast from another window, an API newer than the app) is skipped instead of crashing PaneCode.
describe("onlyKnownPanels", () => {
  it("filters out panes the app does not know", () => {
    const panels = [panel("command"), panel("contradictions"), panel("evidence"), panel("somethingNew")]
    expect(onlyKnownPanels(panels).map((p) => p.id)).toEqual(["command", "evidence"])
  })

  it("returns the same array when every pane is known, so memoised callers do not re-render", () => {
    const panels = [panel("command"), panel("evidence")]
    expect(onlyKnownPanels(panels)).toBe(panels)
  })

  it("does not mutate its input", () => {
    const panels = [panel("command"), panel("verification")]
    onlyKnownPanels(panels)
    expect(panels.map((p) => p.id)).toEqual(["command", "verification"])
  })
})
