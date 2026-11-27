import { describe, expect, it } from "vitest"
import enAuth from "@/locales/en/auth.json"
import koAuth from "@/locales/ko/auth.json"
import tlAuth from "@/locales/tl/auth.json"

// unified-auth.tsx renders caseInvite.valid through <Trans components={{ bold }}> with `name` and
// `caseName` values — a locale missing either placeholder or the <bold> tags silently drops them.
const LOCALES = [
  ["en", enAuth.caseInvite],
  ["ko", koAuth.caseInvite],
  ["tl", tlAuth.caseInvite],
] as const

describe.each(LOCALES)("caseInvite copy (%s)", (lang, copy) => {
  it("has the same keys as en", () => {
    expect(Object.keys(copy).sort()).toEqual(Object.keys(enAuth.caseInvite).sort())
  })

  it("interpolates both the inviter's name and the case name, each in <bold>", () => {
    expect(copy.valid).toContain("<bold>{{name}}</bold>")
    expect(copy.valid).toContain("<bold>{{caseName}}</bold>")
  })

  it.runIf(lang !== "en")("is actually translated, not the English placeholder", () => {
    for (const key of Object.keys(enAuth.caseInvite) as (keyof typeof enAuth.caseInvite)[]) {
      expect(copy[key]).not.toBe(enAuth.caseInvite[key])
    }
  })
})
