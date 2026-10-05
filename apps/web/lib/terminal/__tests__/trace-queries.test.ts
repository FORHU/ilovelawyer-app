import { describe, expect, it } from "vitest"
import { isTurnLive } from "@/lib/terminal/trace-queries"
import { PANEL_IDS } from "@/lib/terminal/types"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import { PANEL_CATEGORY } from "@/components/terminal/terminal-pane-categories"

const NOW = Date.parse("2026-10-03T12:00:00Z")

describe("isTurnLive", () => {
  it("is live just after the turn started", () => {
    expect(isTurnLive({ startedAt: "2026-10-03T11:59:30Z" }, NOW)).toBe(true)
  })

  it("is live just inside the five-minute window", () => {
    expect(isTurnLive({ startedAt: "2026-10-03T11:55:01Z" }, NOW)).toBe(true)
  })

  it("stops being live once the window has passed", () => {
    expect(isTurnLive({ startedAt: "2026-10-03T11:54:59Z" }, NOW)).toBe(false)
  })
})

describe("trace pane registration", () => {
  it("is a known pane id with a title", () => {
    expect(PANEL_IDS).toContain("trace")
    expect(PANEL_TITLES.trace).toBe("AI Reasoning")
  })

  // The pane library only lists a pane that has a category — an uncategorised one silently never
  // appears, which is how this pane went missing from the menu the first time.
  it("is listed in the pane library under a category", () => {
    expect(PANEL_CATEGORY.trace).toBeDefined()
  })

  it("has a category for every pane the library is meant to offer", () => {
    const uncategorised = PANEL_IDS.filter((id) => id !== "dates" && !PANEL_CATEGORY[id])
    expect(uncategorised).toEqual([])
  })
})
