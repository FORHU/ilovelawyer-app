import { describe, it, expect } from "vitest"
import { parseStreamingReply } from "../mind-map-parser"

const trace = (frame: object) => `[TRACE]${JSON.stringify(frame)}[/TRACE]`

describe("parseStreamingReply", () => {
  it("reads a checkpoint holding only research frames as no answer text yet, so the thinking indicator stays", () => {
    const raw =
      trace({ id: "t1", phase: "start", tool: "search_jurisprudence", label: "Searching jurisprudence" }) +
      trace({ id: "t1", phase: "result", count: 4 })

    const reply = parseStreamingReply(raw)

    expect(reply.content).toBe("")
    expect(reply.researchSteps).toEqual([
      { id: "t1", tool: "search_jurisprudence", label: "Searching jurisprudence", count: 4, status: "done" },
    ])
  })

  it("keeps a frame cut off mid-checkpoint out of the answer text", () => {
    const raw = trace({ id: "t1", phase: "start", tool: "search", label: "Searching" }) + '[TRACE]{"id":"t2","pha'

    expect(parseStreamingReply(raw).content).toBe("")
  })

  it("returns the answer text once it follows the research frames", () => {
    const raw = trace({ id: "t1", phase: "start", tool: "search", label: "Searching" }) + "Under Article 1156, an obligation is"

    expect(parseStreamingReply(raw).content).toBe("Under Article 1156, an obligation is")
  })

  it("treats an empty checkpoint as no answer text", () => {
    expect(parseStreamingReply("")).toEqual({ content: "", mindMap: undefined, researchSteps: [] })
  })
})
