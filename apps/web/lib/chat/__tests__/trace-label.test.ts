import { describe, it, expect } from "vitest"
import { leadingSentences } from "../trace-label"

describe("leadingSentences", () => {
  it("returns a label with no sentence break whole, however long", () => {
    const long =
      "Looking up UK law: England and Wales: correcting or amending a name discrepancy on a birth certificate, including the legal and administrative process for correcting a registration error versus changing a name after registration"
    expect(long.length).toBeGreaterThan(200)
    expect(leadingSentences(long)).toBe(long)
  })

  it("keeps only the first sentence when it is long enough to stand alone", () => {
    expect(
      leadingSentences(
        "Looking up UK law: how to correct a birth certificate. Also covers deed polls and the register office.",
      ),
    ).toBe("Looking up UK law: how to correct a birth certificate.")
  })

  it("never returns more than two sentences", () => {
    expect(leadingSentences("Hi. There. You. Again.")).toBe("Hi. There.")
  })

  it("adds the second sentence when the first is a short fragment", () => {
    expect(leadingSentences("Researching. Correcting a name on a birth certificate in England. More.")).toBe(
      "Researching. Correcting a name on a birth certificate in England.",
    )
  })

  it("does not split on legal abbreviations, initials or numbered references", () => {
    expect(leadingSentences("Reading Smith v. Jones [2020] UKSC 5 on s. 5 of the Act. Then the rest.")).toBe(
      "Reading Smith v. Jones [2020] UKSC 5 on s. 5 of the Act.",
    )
    expect(leadingSentences("Checking Acme Ltd. v. J. Brown, para. 12 and No. 3 of the schedule. Next steps.")).toBe(
      "Checking Acme Ltd. v. J. Brown, para. 12 and No. 3 of the schedule.",
    )
    expect(leadingSentences("Looking up grounds, e.g. fraud or error in the register, for amendment. Done.")).toBe(
      "Looking up grounds, e.g. fraud or error in the register, for amendment.",
    )
  })

  it("splits on question and exclamation marks too", () => {
    expect(leadingSentences("Is the registrar allowed to amend an entry on request? Possibly, with evidence.")).toBe(
      "Is the registrar allowed to amend an entry on request?",
    )
  })

  it("collapses stray whitespace and handles empty input", () => {
    expect(leadingSentences("  Fetching   case\n  A v B.  ")).toBe("Fetching case A v B.")
    expect(leadingSentences("")).toBe("")
  })
})
