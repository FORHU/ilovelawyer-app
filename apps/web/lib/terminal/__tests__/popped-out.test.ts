import { describe, it, expect } from "vitest"
import { layoutToPersist } from "../popped-out"
import type { WorkspaceLayout } from "../types"

const layout: WorkspaceLayout = {
  preset: "PANE_4",
  arrangement: "free",
  panels: [
    // "chat" is popped out: hidden on the grid while its own window is open.
    { id: "chat", visible: false, order: 1, width: 0.5, height: 1, x: 0, y: 0 },
    { id: "dates", visible: true, order: 2, width: 0.5, height: 1, x: 0.5, y: 0 },
    // "evidence" was hidden by the user — nothing to do with popping out.
    { id: "evidence", visible: false, order: 3, width: 1, height: 1 },
  ],
}

describe("layoutToPersist", () => {
  it("saves a popped-out pane as shown, so a restart can't lose it", () => {
    const saved = layoutToPersist(layout, new Set(["chat"] as const))
    expect(saved.panels.find((p) => p.id === "chat")).toEqual({
      id: "chat",
      visible: true,
      order: 1,
      width: 0.5,
      height: 1,
      x: 0,
      y: 0,
    })
  })

  it("leaves panes the user hid on purpose hidden", () => {
    const saved = layoutToPersist(layout, new Set(["chat"] as const))
    expect(saved.panels.find((p) => p.id === "evidence")?.visible).toBe(false)
  })

  it("doesn't touch the layout on screen", () => {
    layoutToPersist(layout, new Set(["chat"] as const))
    expect(layout.panels.find((p) => p.id === "chat")?.visible).toBe(false)
  })

  // Returning the same object keeps the autosave's "unchanged since last save" check cheap and
  // exact — popping a pane out must not look like an edit that needs saving.
  it("returns the same layout when nothing is popped out", () => {
    expect(layoutToPersist(layout, new Set())).toBe(layout)
  })
})
