import { describe, expect, it } from "vitest"
import en from "@/locales/en/tour.json"
import { placeTip, TIP_WIDTH } from "@/lib/tour/placement"
import {
  CASES_PATH,
  CONSULTATION_PATH,
  GUIDE_ANSWERS,
  GUIDE_SUGGESTIONS,
  GUIDE_SUGGESTIONS_BY_ROUTE,
  guidePath,
  matchGuideAnswer,
  missingPrerequisite,
  PREREQUISITES,
  routeMatches,
  TOUR_TARGETS,
  type Prerequisite,
} from "@/lib/tour/steps"

describe("copy", () => {
  it("has a label for every target and an answer for every guide entry", () => {
    for (const target of Object.keys(TOUR_TARGETS)) expect(en.targets).toHaveProperty(target)
    for (const a of GUIDE_ANSWERS) {
      expect(en.answers).toHaveProperty(a.id)
      expect(en.helpTopics).toHaveProperty(a.topic)
      expect(TOUR_TARGETS).toHaveProperty(a.target)
    }
  })

  it("has every suggested question", () => {
    const keys = [...GUIDE_SUGGESTIONS, ...Object.values(GUIDE_SUGGESTIONS_BY_ROUTE).flat()]
    for (const k of keys) expect(en.suggestions).toHaveProperty(k)
  })

  it("answers every suggested question with a how-to answer, not the fallback", () => {
    for (const q of Object.values(en.suggestions)) expect(matchGuideAnswer(q).kind, q).toBe("answer")
  })
})

describe("prerequisite copy", () => {
  it("explains every prerequisite and labels the suggestions that need it", () => {
    for (const id of Object.keys(PREREQUISITES) as Prerequisite[]) {
      expect(en.prerequisites).toHaveProperty(id)
      expect(en.prerequisites[id]).toHaveProperty("body")
      expect(en.prerequisites[id]).toHaveProperty("missing")
      expect(en.guide.needs).toHaveProperty(id)
      expect(en.targets).toHaveProperty(PREREQUISITES[id].target)
    }
  })

  it("gives every answer behind a prerequisite a blocked answer, a next step and its path", () => {
    for (const a of GUIDE_ANSWERS) {
      if (!missingPrerequisite(a.target, { case: false })) continue
      expect(en.answers, a.id).toHaveProperty(`${a.id}_blocked`)
      expect(en.answers, a.id).toHaveProperty(`${a.id}_next`)
      expect(a.path?.length, a.id).toBeGreaterThan(1)
      for (const step of a.path ?? []) expect(en.prerequisites.steps, `${a.id} → ${step}`).toHaveProperty(step)
    }
  })
})

describe("prerequisites", () => {
  it("never meet a prerequisite with a control that needs it", () => {
    for (const p of Object.values(PREREQUISITES)) expect(p.unlocks).not.toContain(p.target)
  })

  it("only block when the prerequisite is known to be missing", () => {
    expect(missingPrerequisite("case-row-workspace", { case: false })).toBe("case")
    expect(missingPrerequisite("case-row-workspace", { case: true })).toBeNull()
    // Still loading: don't send anyone off to create a case on a guess.
    expect(missingPrerequisite("case-row-workspace", {})).toBeNull()
    expect(missingPrerequisite("cases-new", { case: false })).toBeNull()
  })

  it("mark the path off: the prerequisite first, then the step after it", () => {
    const workspace = GUIDE_ANSWERS.find((a) => a.id === "workspace")!
    expect(guidePath(workspace, false)?.map((s) => s.state)).toEqual(["now", "later", "later"])
    expect(guidePath(workspace, true)?.map((s) => s.state)).toEqual(["done", "now", "later"])
  })
})

describe("matchGuideAnswer", () => {
  const answerFor = (q: string) => {
    const m = matchGuideAnswer(q)
    return m.kind === "answer" ? m.answer.id : m.kind
  }

  it("matches how-to questions regardless of case", () => {
    expect(answerFor("How do I open a case in the Legal TERMINAL?")).toBe("terminal")
    expect(answerFor("Where do I upload documents?")).toBe("upload")
    expect(answerFor("Can I set a reminder?")).toBe("reminder")
  })

  it("sends legal questions to Consultation", () => {
    expect(answerFor("Can my client be held liable for estafa?")).toBe("legal")
  })

  it("prefers a how-to answer when a question sounds legal but is about the app", () => {
    expect(answerFor("Where do I upload a file for estafa?")).toBe("upload")
  })

  it("sends a user with no case to create one before Workspace or Terminal", () => {
    const noCase = { case: false }
    for (const q of ["How do I make a case brief or audio overview?", "How do I open a case in the Legal Terminal?"]) {
      const m = matchGuideAnswer(q, noCase)
      expect(m.kind, q).toBe("blocked")
      expect(m.kind === "blocked" && m.missing, q).toBe("case")
    }
    expect(matchGuideAnswer("How do I make a case brief or audio overview?", { case: true }).kind).toBe("answer")
  })

  it("doesn't block features a user with no case can already use", () => {
    const noCase = { case: false }
    for (const q of ["How do I find a case?", "Where are my archived cases?", "How do I add a hearing?", "Where do I upload documents?"]) {
      expect(matchGuideAnswer(q, noCase).kind, q).toBe("answer")
    }
  })

  it("admits when it has no answer", () => {
    expect(answerFor("What's the weather like?")).toBe("none")
  })
})

describe("routeMatches", () => {
  it("matches whole pages only — Consultation is not every page under /homepage", () => {
    expect(routeMatches(CONSULTATION_PATH, "/homepage")).toBe(true)
    expect(routeMatches(CONSULTATION_PATH, CASES_PATH)).toBe(false)
  })

  it("treats a step with no route as on every page", () => {
    expect(routeMatches(null, CASES_PATH)).toBe(true)
  })
})

describe("placeTip", () => {
  const W = 1440
  const H = 900
  const tipH = 190

  it("puts the tip on the preferred side when it fits", () => {
    const r = { x: 600, y: 400, w: 200, h: 40, radius: 8 }
    expect(placeTip(r, tipH, "bottom", W, H)).toEqual({ left: 600 + 100 - TIP_WIDTH / 2, top: 400 + 40 + 14 })
  })

  it("flips to another side when the preferred one doesn't fit", () => {
    // Too close to the bottom edge for a tip below it.
    const r = { x: 600, y: 800, w: 200, h: 40, radius: 8 }
    const { top } = placeTip(r, tipH, "bottom", W, H)
    expect(top + tipH).toBeLessThanOrEqual(r.y)
  })

  it("keeps the tip on screen and below the header", () => {
    const r = { x: 4, y: 10, w: 40, h: 40, radius: 8 }
    const { left, top } = placeTip(r, tipH, "top", W, H)
    expect(left).toBeGreaterThanOrEqual(12)
    expect(top).toBeGreaterThanOrEqual(76)
  })
})
