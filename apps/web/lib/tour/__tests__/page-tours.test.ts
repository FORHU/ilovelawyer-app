import { describe, expect, it } from "vitest"
import en from "@/locales/en/tour.json"
import { PAGE_TOURS, pageGuideFor } from "@/lib/tour/page-tours"
import { CALENDAR_PATH, CASES_PATH, CONSULTATION_PATH, LIBRARY_PATH, TOUR_TARGETS } from "@/lib/tour/steps"

describe("pageGuideFor", () => {
  it("tours the page's own controls on the main pages, each under its own track", () => {
    const expected = { [CONSULTATION_PATH]: "consultation", [CASES_PATH]: "cases", [LIBRARY_PATH]: "library", [CALENDAR_PATH]: "calendar" }
    for (const [path, track] of Object.entries(expected)) {
      const guide = pageGuideFor(path)
      expect(guide?.kind, path).toBe("page")
      expect(guide?.kind === "page" && guide.track, path).toBe(track)
    }
  })

  it("sends a case's Workspace and Terminal to the matching sample-case tour", () => {
    expect(pageGuideFor("/homepage/case-portfolio/c1")).toEqual({ kind: "sample", track: "studio" })
    expect(pageGuideFor("/homepage/terminal/c1")).toEqual({ kind: "sample", track: "terminal" })
  })

  it("runs the tour in place on the sample case itself", () => {
    expect(pageGuideFor("/homepage/sample-case")).toEqual({ kind: "sample-here" })
  })

  it("offers nothing on pages without a tour, or on a terminal pop-out window", () => {
    expect(pageGuideFor("/homepage/profile")).toBeNull()
    expect(pageGuideFor("/homepage/terminal/c1/canvas/2")).toBeNull()
    expect(pageGuideFor("/homepage/case-portfolio")).not.toEqual({ kind: "sample", track: "studio" })
  })
})

describe("page tours", () => {
  it("each have their own saved track, and a name for the step label", () => {
    const tracks = Object.values(PAGE_TOURS).map((p) => p.track)
    expect(new Set(tracks).size).toBe(tracks.length)
    for (const track of tracks) expect(en.pageTour.names).toHaveProperty(track)
  })

  it("only stop at known controls, each with a title and its own description", () => {
    for (const [path, { steps }] of Object.entries(PAGE_TOURS)) {
      expect(steps.length, path).toBeGreaterThan(0)
      for (const step of steps) {
        expect(TOUR_TARGETS, `${path} → ${step.target}`).toHaveProperty(step.target)
        expect(en.targets, step.target).toHaveProperty(step.target)
        expect(en.pageTour.steps, step.target).toHaveProperty(step.target)
      }
    }
  })

  it("don't visit the same control twice on one page", () => {
    for (const [path, { steps }] of Object.entries(PAGE_TOURS)) {
      const targets = steps.map((s) => s.target)
      expect(new Set(targets).size, path).toBe(targets.length)
    }
  })
})
