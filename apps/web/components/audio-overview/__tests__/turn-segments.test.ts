import { describe, it, expect } from "vitest"
import { turnSegments } from "../audio-overview-sync"

const TEXT = '"Well said," she replied.'
// Polly word marks exclude punctuation: Well, said, she, replied
const WORDS = [
  { time: 10, start: 1, end: 5 },
  { time: 10.4, start: 6, end: 10 },
  { time: 11, start: 13, end: 16 },
  { time: 11.3, start: 17, end: 24 },
]

const joined = (segments: { text: string }[]) => segments.map((s) => s.text).join("")
const stateOf = (segments: { text: string; state: string }[], text: string) => segments.find((s) => s.text === text)?.state

describe("turnSegments", () => {
  describe("with word timings", () => {
    it("covers every character of the turn exactly once", () => {
      expect(joined(turnSegments(TEXT, 10, 12, 10.5, WORDS))).toBe(TEXT)
    })

    it("marks words before, at and after playback", () => {
      const segments = turnSegments(TEXT, 10, 12, 10.5, WORDS)
      expect(stateOf(segments, "Well")).toBe("spoken")
      expect(stateOf(segments, "said")).toBe("speaking")
      expect(stateOf(segments, "she")).toBe("upcoming")
    })

    it("leaves the whole turn upcoming before the first word starts", () => {
      const segments = turnSegments(TEXT, 9.5, 12, 9.8, WORDS)
      expect(segments.every((s) => s.state === "upcoming")).toBe(true)
    })

    it("reads punctuation as spoken once the word before it has started, never underlined", () => {
      const segments = turnSegments(TEXT, 10, 12, 10.05, WORDS)
      expect(stateOf(segments, '"')).toBe("spoken")
      expect(segments.some((s) => s.state === "speaking" && /^[\s",.]+$/.test(s.text))).toBe(false)
    })

    it("reads the trailing period as spoken once the last word starts", () => {
      expect(turnSegments(TEXT, 10, 12, 11.5, WORDS).at(-1)).toEqual({ text: ".", state: "spoken" })
    })
  })

  describe("with only sentence timings", () => {
    const text = "First one here. Second one."
    const sentences = [
      { time: 0, start: 0, end: 15 },
      { time: 5, start: 16, end: 27 },
    ]

    it("covers the whole turn", () => {
      expect(joined(turnSegments(text, 0, 8, 6, null, sentences)).replace(/\s+/g, " ").trim()).toBe(text)
    })

    it("treats an earlier sentence as fully spoken and a later one as upcoming", () => {
      const midFirst = turnSegments(text, 0, 8, 1, null, sentences)
      expect(midFirst.filter((s) => s.text.includes("Second")).every((s) => s.state === "upcoming")).toBe(true)
      const inSecond = turnSegments(text, 0, 8, 5.5, null, sentences)
      expect(inSecond.filter((s) => /First|one|here/.test(s.text) && !s.text.includes("Second")).slice(0, 3).every((s) => s.state === "spoken")).toBe(true)
    })
  })

  it("falls back to estimating across the whole turn without marks", () => {
    const segments = turnSegments("alpha beta gamma delta", 0, 4, 2)
    expect(segments.map((s) => s.state)).toContain("spoken")
    expect(segments.map((s) => s.state)).toContain("upcoming")
  })
})
