import { describe, expect, it } from "vitest"
import { britishCatalogs, britishSpelling, toBritish, withOverrides } from "@/lib/i18n/british"
import { I18N_RESOURCES } from "@/lib/i18n/resources"

describe("britishSpelling", () => {
  it("rewrites the -ize family, whatever the prefix or suffix", () => {
    expect(britishSpelling("Organization")).toBe("Organisation")
    expect(britishSpelling("organizations")).toBe("organisations")
    expect(britishSpelling("Unauthorized access")).toBe("Unauthorised access")
    expect(britishSpelling("Analyzing “{{query}}”…")).toBe("Analysing “{{query}}”…")
    expect(britishSpelling("Uncategorized")).toBe("Uncategorised")
  })

  it("rewrites the other spelling families", () => {
    expect(britishSpelling("Support Center")).toBe("Support Centre")
    expect(britishSpelling("Add a defense strategy")).toBe("Add a defence strategy")
    expect(britishSpelling("canceled")).toBe("cancelled")
  })

  it("keeps the case of what it matched", () => {
    expect(britishSpelling("ORGANIZATION")).toBe("ORGANISATION")
    expect(britishSpelling("Create an Organization")).toBe("Create an Organisation")
  })

  it("leaves interpolation and punctuation untouched", () => {
    expect(britishSpelling("Remove {{name}} from this organization")).toBe("Remove {{name}} from this organisation")
  })

  // A placeholder is a variable name, not prose: respelling it makes i18next render it literally.
  it("never respells inside an interpolation or a nested key", () => {
    expect(britishSpelling("Welcome to {{organizationName}}, organization admin")).toBe(
      "Welcome to {{organizationName}}, organisation admin",
    )
    expect(britishSpelling("See $t(common.colorSettings) for color")).toBe("See $t(common.colorSettings) for colour")
  })

  // The rules are stems matched anywhere in a word, so the risk is corrupting a word that merely
  // contains one. These are the cases that would break first.
  it("does not touch Philippine proper nouns, or words that merely contain a stem", () => {
    for (const untouched of [
      "Labor Code",
      "Labor Code of the Philippines",
      "Department of Labor and Employment",
      "Abbott Laboratories v. Alcaraz",
      "NLRC complaint docketed.",
      "e.g. Labor Code, Art. 297",
      "Your legal practice",
      "Built for Philippine practice",
      "judgment",
      "parameter",
      "obliterate",
      "Analysis",
      "size",
      "prize",
    ]) {
      expect(britishSpelling(untouched)).toBe(untouched)
    }
  })
})

describe("toBritish", () => {
  it("walks objects and arrays without changing the shape", () => {
    const american = {
      title: "Organization",
      nested: { body: "this organization" },
      list: ["Support Center", { author: "Managing Partner" }],
      count: 3,
      flag: true,
      empty: null,
    }
    expect(toBritish(american)).toEqual({
      title: "Organisation",
      nested: { body: "this organisation" },
      list: ["Support Centre", { author: "Managing Partner" }],
      count: 3,
      flag: true,
      empty: null,
    })
  })
})

describe("withOverrides", () => {
  it("merges objects key by key and leaves the rest of the catalog alone", () => {
    const merged = withOverrides(
      { a: "Organisation", nested: { keep: "kept", replace: "old" } },
      { nested: { replace: "new" } },
    )
    expect(merged).toEqual({ a: "Organisation", nested: { keep: "kept", replace: "new" } })
  })

  it("replaces an array outright rather than merging by index", () => {
    expect(withOverrides({ items: ["a", "b", "c"] }, { items: ["x"] })).toEqual({ items: ["x"] })
  })
})

describe("britishCatalogs", () => {
  it("applies overrides over the respelled catalog", () => {
    const built = britishCatalogs(
      { one: { title: "Organization", term: "Petitioner" }, two: { title: "Support Center" } },
      { one: { term: "Claimant" } },
    )
    expect(built).toEqual({
      one: { title: "Organisation", term: "Claimant" },
      two: { title: "Support Centre" },
    })
  })
})

describe("the wired-up en-GB catalogs", () => {
  const en = I18N_RESOURCES.en
  const enGB = I18N_RESOURCES["en-GB"]

  it("covers every namespace en does, so nothing falls back by accident", () => {
    expect(Object.keys(enGB).sort()).toEqual(Object.keys(en).sort())
  })

  it("respells shipped copy", () => {
    expect(enGB.organization.title).toBe("Organisation")
    expect(enGB.common.siteFooter.connect.supportCenter).toBe("Support Centre")
    expect(enGB.terminal.uncategorizedFolder).toBe("Uncategorised")
  })

  it("carries the hand-written UK legal terms", () => {
    expect(enGB["create-case"].designations.petitionerPlaintiff).toBe("Claimant")
    expect(enGB.terminal.privilegeAttorneyClient).toBe("Legal advice privilege")
    expect(enGB.terminal.damageAttorneysFees).toBe("Legal costs")
  })

  it("leaves Philippine statute names as they are", () => {
    expect(enGB.library.categories.codals.laborCode).toBe("Labor Code")
  })

  // Guards every shipped string at once, including ones added after this test was written.
  it("keeps every placeholder exactly as en has it", () => {
    const placeholders = (s: string) => (s.match(/\{\{.*?\}\}|\$t\(.*?\)/g) ?? []).sort()
    const walk = (american: unknown, british: unknown, path: string) => {
      if (typeof american === "string" && typeof british === "string") {
        expect(placeholders(british), path).toEqual(placeholders(american))
      } else if (american && typeof american === "object" && british && typeof british === "object") {
        for (const key of Object.keys(american)) {
          walk((american as Record<string, unknown>)[key], (british as Record<string, unknown>)[key], `${path}.${key}`)
        }
      }
    }
    for (const ns of Object.keys(en) as (keyof typeof en)[]) walk(en[ns], enGB[ns], ns)
  })

  it("does not fork the American catalogs — en is untouched", () => {
    expect(en.organization.title).toBe("Organization")
  })
})
