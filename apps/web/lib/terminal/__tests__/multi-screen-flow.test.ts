import { describe, it, expect } from "vitest"
import { hidePanelInLayout, movePanelToScreen, nextScreenIndex, screenIndicesInUse } from "../multi-screen"
import { applyScreenPreset, captureCurrentScreens } from "../screen-presets"
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

describe("preset columns", () => {
  const cols = (columns: string[][], extra: string[] = []) =>
    ({ id: "c", screens: [{ arrangement: "columns", panelIds: [...columns.flat(), ...extra], columns }] }) as never

  it("writes each pane's column and keeps top-to-bottom order", () => {
    const layout = applyScreenPreset(base(), cols([["command", "evidence"], ["law"]]))
    expect(find(layout, "command")).toMatchObject({ columnIndex: 0, order: 0 })
    expect(find(layout, "evidence")).toMatchObject({ columnIndex: 0, order: 1 })
    expect(find(layout, "law")).toMatchObject({ columnIndex: 1, order: 2 })
    expect(layout.columnCount).toBe(3)
  })

  it("folds authored columns past the column count into the last one", () => {
    const four = ["command", "evidence", "law", "x1"] as string[]
    const layout = applyScreenPreset({ ...base(), panels: [...base().panels, p("x1")] }, cols(four.map((id) => [id])))
    expect(layout.panels.filter((x) => x.visible).map((x) => x.columnIndex)).toEqual([0, 1, 2, 2])
  })

  it("a pane folded in from a closed display auto-joins (no columnIndex)", () => {
    const layout = applyScreenPreset(base(), cols([["command"], ["evidence"]], ["law"]))
    expect(find(layout, "law").columnIndex).toBeUndefined()
  })

  it("flat presets clear stale column indexes", () => {
    const stale = { ...base(), panels: base().panels.map((x) => ({ ...x, columnIndex: 2 })) }
    const layout = applyScreenPreset(stale, { id: "f", screens: [{ arrangement: "columns", panelIds: ["command", "evidence"] }] } as never)
    expect(find(layout, "command").columnIndex).toBeUndefined()
  })

  it("capture records the live columns and round-trips", () => {
    const applied = applyScreenPreset(base(), cols([["command"], ["evidence", "law"]]))
    const [screen] = captureCurrentScreens(applied, 1)
    expect(screen!.columns).toEqual([["command"], ["evidence", "law"]])
    expect(screen!.panelIds).toEqual(["command", "evidence", "law"])
  })
})
