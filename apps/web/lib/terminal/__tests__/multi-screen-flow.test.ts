import { describe, it, expect } from "vitest"
import { hidePanelInLayout, movePanelToScreen, nextScreenIndex, screenIndicesInUse } from "../multi-screen"
import { applyScreenPreset } from "../screen-presets"
import type { PanelId, PanelLayout, WorkspaceLayout } from "../types"

const p = (id: string): PanelLayout => ({ id: id as PanelId, visible: false, order: 0, width: 1, height: 1 })
const base = (): WorkspaceLayout => ({ preset: "x", arrangement: "free", panels: ["command", "evidence", "law"].map(p) } as WorkspaceLayout)
const twoScreens = {
  id: "t",
  screens: [
    { arrangement: "free", panelIds: ["command"] },
    { arrangement: "free", panelIds: ["evidence", "law"] },
  ],
} as never

const find = (l: WorkspaceLayout, id: string) => l.panels.find((x) => x.id === id)!

describe("multi-screen pop-out flow", () => {
  it("preset -> close all -> re-add -> pop out lands on the open canvas", () => {
    let layout = applyScreenPreset(base(), twoScreens)
    expect(find(layout, "evidence").screen).toBe(1)

    for (const id of ["command", "evidence", "law"]) layout = hidePanelInLayout(layout, id as PanelId)
    expect(layout.panels.every((x) => !x.visible && x.screen === undefined)).toBe(true)
    expect(screenIndicesInUse(layout.panels)).toEqual([])

    // Re-added on the primary (visible, no screen), then popped out one screen onward.
    layout = { ...layout, panels: layout.panels.map((x) => (x.id === "law" ? { ...x, visible: true } : x)) }
    layout = movePanelToScreen(layout, "law" as PanelId, nextScreenIndex(0, 1))
    const law = find(layout, "law")
    expect(law.screen).toBe(1)
    expect(law.visible).toBe(true)
    expect(law.width).toBe(1) // tiled to fill the empty canvas
  })

  it("applying a second preset leaves no stale screens", () => {
    const once = applyScreenPreset(base(), twoScreens)
    const again = applyScreenPreset(once, { id: "u", screens: [{ arrangement: "free", panelIds: ["law"] }] } as never)
    expect(screenIndicesInUse(again.panels)).toEqual([])
    expect(find(again, "evidence").visible).toBe(false)
  })
})
