import { describe, it, expect } from "vitest"
import { slotForGroup } from "../slot-for-group"
import type { PanelId, PanelLayout } from "../types"

const p = (id: string): PanelLayout => ({ id: id as PanelId, visible: true, order: 0, width: 1, height: 1 })

describe("slotForGroup", () => {
  it("joins the slot holding a group-mate", () => {
    expect(slotForGroup([[p("command")], [p("strengths")], []], "weaknesses" as PanelId)).toBe(1)
  })

  it("skips a full slot, then falls back to the least-full one", () => {
    const slots = [[p("strengths"), p("redTeam")], [p("command")]]
    expect(slotForGroup(slots, "weaknesses" as PanelId, 2)).toBe(1)
  })

  it("uses the least-full slot when nothing in the group is on the board", () => {
    expect(slotForGroup([[p("command"), p("evidence")], [p("law")]], "chat" as PanelId)).toBe(1)
  })
})
