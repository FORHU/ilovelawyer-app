import { describe, it, expect } from "vitest"
import { findAnchorMatches, type DecisionAnchor } from "../decision-anchor-match"

describe("findAnchorMatches", () => {
  it("returns nothing when there are no anchors", () => {
    expect(findAnchorMatches("plain sentence", [])).toEqual([])
  })

  it("finds a single matching anchor at its exact position", () => {
    const anchors: DecisionAnchor[] = [{ id: "d1", anchor: "the missing ties caused the collapse" }]
    const input = "Overall, the missing ties caused the collapse of the east span."
    const matches = findAnchorMatches(input, anchors)
    expect(matches).toHaveLength(1)
    expect(matches[0].start).toBe(input.indexOf("the missing ties caused the collapse"))
    expect(matches[0].decisionId).toBe("d1")
  })

  it("matches across a whitespace difference (newline vs space) the same way chat-wonder's server-side audit tolerates", () => {
    const anchors: DecisionAnchor[] = [{ id: "d1", anchor: "the missing ties\ncaused the collapse" }]
    const input = "Overall, the missing ties caused the collapse of the east span."
    const matches = findAnchorMatches(input, anchors)
    expect(matches).toHaveLength(1)
    expect(input.slice(matches[0].start, matches[0].end)).toBe("the missing ties caused the collapse")
  })

  it("matches across a double-space difference", () => {
    const anchors: DecisionAnchor[] = [{ id: "d1", anchor: "the missing ties  caused the collapse" }]
    const input = "Overall, the missing ties caused the collapse of the east span."
    const matches = findAnchorMatches(input, anchors)
    expect(matches).toHaveLength(1)
  })

  it("silently skips an anchor that does not match verbatim — no wrong attribution", () => {
    const anchors: DecisionAnchor[] = [{ id: "d1", anchor: "this text does not appear anywhere" }]
    expect(findAnchorMatches("A completely unrelated sentence.", anchors)).toEqual([])
  })

  it("does not let a shorter anchor fragment a longer overlapping one", () => {
    const anchors: DecisionAnchor[] = [
      { id: "long", anchor: "the witness statement contradicts the timeline" },
      { id: "short", anchor: "contradicts the timeline" },
    ]
    const matches = findAnchorMatches("Clearly, the witness statement contradicts the timeline given.", anchors)
    expect(matches).toHaveLength(1)
    expect(matches[0].decisionId).toBe("long")
  })

  it("finds multiple non-overlapping anchors, sorted in reading order", () => {
    const anchors: DecisionAnchor[] = [
      { id: "second", anchor: "second conclusion" },
      { id: "first", anchor: "first conclusion" },
    ]
    const input = "Here is the first conclusion, and here is the second conclusion."
    const matches = findAnchorMatches(input, anchors)
    expect(matches).toHaveLength(2)
    expect(matches[0].decisionId).toBe("first")
    expect(matches[1].decisionId).toBe("second")
    expect(matches[0].start).toBeLessThan(matches[1].start)
  })

  it("ignores anchors with blank text", () => {
    const anchors: DecisionAnchor[] = [{ id: "d1", anchor: "   " }]
    expect(findAnchorMatches("Some sentence.", anchors)).toEqual([])
  })
})
