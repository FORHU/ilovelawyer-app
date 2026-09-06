import { describe, it, expect } from "vitest"
import { findClaimMatches, type Claim } from "../attributed-text-match"

describe("findClaimMatches", () => {
  it("returns nothing when there are no claims", () => {
    expect(findClaimMatches("plain sentence", [])).toEqual([])
  })

  it("finds a single matching claim at its exact position", () => {
    const claims: Claim[] = [{ text: "the contract lacks a signature", category: "GROUNDED", sourceLabel: "No signed contract" }]
    const input = "Note: the contract lacks a signature per the file."
    const matches = findClaimMatches(input, claims)
    expect(matches).toHaveLength(1)
    expect(matches[0].start).toBe(input.indexOf("the contract lacks a signature"))
    expect(matches[0].claim).toEqual(claims[0])
  })

  it("silently skips a claim that does not match verbatim — no wrong attribution", () => {
    const claims: Claim[] = [{ text: "this text does not appear anywhere", category: "INFERENCE" }]
    expect(findClaimMatches("A completely unrelated sentence.", claims)).toEqual([])
  })

  it("does not let a shorter claim fragment a longer overlapping one", () => {
    const claims: Claim[] = [
      { text: "the witness statement contradicts the timeline", category: "GROUNDED" },
      { text: "contradicts the timeline", category: "INFERENCE" },
    ]
    const matches = findClaimMatches("Clearly, the witness statement contradicts the timeline given.", claims)
    expect(matches).toHaveLength(1)
    expect(matches[0].claim.category).toBe("GROUNDED")
  })

  it("finds multiple non-overlapping claims, sorted in reading order", () => {
    const claims: Claim[] = [
      { text: "second claim", category: "UNSUPPORTED" },
      { text: "first claim", category: "GROUNDED" },
    ]
    const input = "Here is the first claim, and here is the second claim."
    const matches = findClaimMatches(input, claims)
    expect(matches).toHaveLength(2)
    expect(matches[0].claim.category).toBe("GROUNDED")
    expect(matches[1].claim.category).toBe("UNSUPPORTED")
    expect(matches[0].start).toBeLessThan(matches[1].start)
  })

  it("ignores claims with blank text", () => {
    const claims: Claim[] = [{ text: "   ", category: "INFERENCE" }]
    expect(findClaimMatches("Some sentence.", claims)).toEqual([])
  })
})
