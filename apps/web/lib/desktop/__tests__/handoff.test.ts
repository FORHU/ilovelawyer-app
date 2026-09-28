import { describe, it, expect } from "vitest"
import { safeNextPath } from "../handoff"

// The handoff page signs the user in and then goes to `next`. If `next` could be another
// website, a crafted link would sign someone in and immediately hand them to an attacker's page.
describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/homepage/case-portfolio/abc?tab=overview")).toBe("/homepage/case-portfolio/abc?tab=overview")
  })

  it("never leaves the site", () => {
    for (const hostile of [
      "https://evil.example/",
      "//evil.example/",
      "/\\evil.example", // browsers read /\ as //
      "/\t/evil.example", // …and drop tabs, making this //evil.example
      "/\n/evil.example",
      "evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(hostile)).toBe("/homepage")
    }
  })

  it("falls back to the dashboard when there's nothing", () => {
    expect(safeNextPath(null)).toBe("/homepage")
    expect(safeNextPath("")).toBe("/homepage")
  })
})
