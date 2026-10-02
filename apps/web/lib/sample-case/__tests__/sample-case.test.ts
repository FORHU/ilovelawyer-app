import { describe, expect, it } from "vitest"
import en from "@/locales/en/tour.json"
import { PANEL_CATEGORY } from "@/components/terminal/terminal-pane-categories"
import type { PanelId } from "@/lib/terminal/types"
import { PANE_INFO, SAMPLE_GRID, sampleCaseFor } from "@/lib/sample-case/data"
import { safeReturnPath, SAMPLE_TILES, SAMPLE_TOURS, sampleCaseHref } from "@/lib/sample-case/tours"

describe("sample-case tours", () => {
  it("have copy for every step", () => {
    for (const track of ["studio", "terminal"] as const) {
      for (const step of SAMPLE_TOURS[track]) expect(en.sampleCase.tour[track].steps, `${track}.${step.id}`).toHaveProperty(step.id)
    }
  })

  it("open each Studio tile once, in order", () => {
    expect(SAMPLE_TOURS.studio.filter((s) => s.tile).map((s) => s.tile)).toEqual(SAMPLE_TILES)
    for (const tile of SAMPLE_TILES) expect(en.sampleCase.tiles).toHaveProperty(tile)
  })

  it("use step ids the API will save", () => {
    // Mirrors saveProductTourSchema in ilovelawyer-api (users.validation.ts): letters, digits and
    // hyphens, at most 40 characters. A step id it rejects makes every later save fail.
    for (const track of ["studio", "terminal"] as const) {
      for (const step of SAMPLE_TOURS[track]) expect(step.id, `${track}.${step.id}`).toMatch(/^[A-Za-z0-9-]{1,40}$/)
    }
  })

  it("only point Terminal steps at panes that are on the sample grid", () => {
    for (const step of SAMPLE_TOURS.terminal) {
      if (!step.target.startsWith("pane-")) continue
      expect(SAMPLE_GRID).toContain(step.target.slice("pane-".length))
    }
  })
})

describe("sample panes", () => {
  it("describe every pane Add pane lists, under the same group", () => {
    for (const [id, category] of Object.entries(PANEL_CATEGORY) as [PanelId, string][]) {
      expect(PANE_INFO[id]?.description, id).toBeTruthy()
      expect(PANE_INFO[id]?.category, id).toBe(category)
    }
  })

  it("fill in every pane on the sample grid, in both jurisdictions", () => {
    for (const tenant of ["PH", "UK"] as const) {
      for (const id of SAMPLE_GRID) expect(sampleCaseFor(tenant).panes[id]?.length, `${tenant} ${id}`).toBeGreaterThan(0)
    }
  })
})

describe("sample case per jurisdiction", () => {
  // Terms, courts and currency that only belong to one jurisdiction's sample.
  const PH_ONLY = /₱|estafa|Revised Penal|RPC|Art\. 315|RA 10951|Republic Act|G\.R\.|RTC|Quezon|Viber|pre-trial|Information\.pdf/i
  const UK_ONLY = /£|Misrepresentation Act|County Court|CPR|CCMC|Precedent [HR]|Derry v Peek|WhatsApp|Particulars of Claim|Particulars-of-Claim|defence/i

  it("keeps PH's sample to PH law, courts and currency", () => {
    const ph = JSON.stringify(sampleCaseFor("PH"))
    expect(ph).toMatch(/₱/)
    expect(ph).not.toMatch(UK_ONLY)
  })

  it("keeps UK's sample to UK law, courts and currency", () => {
    const uk = JSON.stringify(sampleCaseFor("UK"))
    expect(uk).toMatch(/£/)
    expect(uk).not.toMatch(PH_ONLY)
  })

  it("defaults to PH when the jurisdiction isn't known yet", () => {
    expect(sampleCaseFor(null)).toBe(sampleCaseFor("PH"))
  })

  it("only adds UK copy for strings that have a shared version", () => {
    const walk = (o: Record<string, unknown>, path: string[] = []): string[][] =>
      Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? walk(v as Record<string, unknown>, [...path, k]) : [[...path, k]]))
    const keys = new Set(walk(en).map((p) => p.join(".")))
    for (const key of keys) if (key.endsWith("_UK")) expect(keys, key).toContain(key.slice(0, -"_UK".length))
  })
})

describe("sampleCaseHref", () => {
  it("opens the right tab and tour, remembering where the user came from", () => {
    const href = new URL(sampleCaseHref("terminal", "/homepage/terminal/c1"), "http://x")
    expect(href.pathname).toBe("/homepage/sample-case")
    expect(Object.fromEntries(href.searchParams)).toEqual({ view: "terminal", tour: "terminal", from: "/homepage/terminal/c1" })
    expect(new URL(sampleCaseHref("studio"), "http://x").searchParams.get("view")).toBe("workspace")
  })
})

describe("safeReturnPath", () => {
  it("keeps paths inside the signed-in app", () => {
    expect(safeReturnPath("/homepage/case-portfolio/c1?tab=overview")).toBe("/homepage/case-portfolio/c1?tab=overview")
  })

  it("drops anything that could leave the app", () => {
    for (const bad of [null, "", "https://evil.example", "//evil.example", "/homepage//evil.example", "/login", "/homepage\\\\evil"]) {
      expect(safeReturnPath(bad), String(bad)).toBeNull()
    }
  })
})
