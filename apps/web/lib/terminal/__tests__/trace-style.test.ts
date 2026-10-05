import { describe, expect, it } from "vitest"
import {
  countSources,
  countTraceTypes,
  filterEvents,
  filterTurns,
  memberInitial,
  TRACE_SOURCE_ORDER,
  TRACE_TYPE_ORDER,
  traceStyle,
} from "@/lib/terminal/trace-style"

describe("traceStyle", () => {
  it("gives every kind the API sends its own color", () => {
    const bars = TRACE_TYPE_ORDER.map((type) => traceStyle(type).bar)
    expect(new Set(bars).size).toBe(TRACE_TYPE_ORDER.length)
  })

  it("keeps the Terminal's semantic colors for reasoning, research and checks", () => {
    expect(traceStyle("cognition").text).toBe("text-warn")
    expect(traceStyle("retrieval").text).toBe("text-ok")
    expect(traceStyle("control").text).toBe("text-riskmed")
  })

  it("never uses red, which would read as an error", () => {
    for (const type of TRACE_TYPE_ORDER) expect(Object.values(traceStyle(type)).join(" ")).not.toMatch(/danger|red-/)
  })

  it("gives the hued kinds a dark-theme shade as well as a light one", () => {
    for (const type of ["request", "action", "memory"]) expect(traceStyle(type).text).toMatch(/dark:/)
  })

  it("falls back to gray for a kind the API adds later", () => {
    expect(traceStyle("something-new").bar).toBe(traceStyle("another-new").bar)
    expect(traceStyle("something-new").text).toBe("text-muted-foreground")
  })
})

describe("countTraceTypes", () => {
  it("counts each kind, in the order the AI works in", () => {
    const events = [{ type: "cognition" }, { type: "retrieval" }, { type: "cognition" }, { type: "request" }]
    expect(countTraceTypes(events)).toEqual([
      { type: "request", count: 1 },
      { type: "retrieval", count: 1 },
      { type: "cognition", count: 2 },
    ])
  })

  it("leaves out kinds with no steps and puts unknown kinds last", () => {
    expect(countTraceTypes([{ type: "zzz" }, { type: "action" }])).toEqual([
      { type: "action", count: 1 },
      { type: "zzz", count: 1 },
    ])
  })

  it("is empty for no events", () => {
    expect(countTraceTypes([])).toEqual([])
  })
})

describe("memberInitial", () => {
  it("is the first letter, uppercased", () => {
    expect(memberInitial("  ana cruz")).toBe("A")
  })

  it("is a question mark for a removed or unnamed member", () => {
    expect(memberInitial(null)).toBe("?")
    expect(memberInitial("   ")).toBe("?")
  })
})

describe("countSources", () => {
  it("counts each source, chat first, in the order the pane lists them", () => {
    const turns = [{ source: "witnessScoring" }, { source: "chat" }, { source: "witnessScoring" }, { source: "redTeam" }]
    expect(countSources(turns)).toEqual([
      { source: "chat", count: 1 },
      { source: "witnessScoring", count: 2 },
      { source: "redTeam", count: 1 },
    ])
  })

  it("puts a source it has not heard of last, and leaves out sources with no runs", () => {
    expect(countSources([{ source: "zzz" }, { source: "claimExtract" }])).toEqual([
      { source: "claimExtract", count: 1 },
      { source: "zzz", count: 1 },
    ])
  })

  it("lists chat before every pane's generation", () => {
    expect(TRACE_SOURCE_ORDER[0]).toBe("chat")
  })
})

describe("filterTurns", () => {
  const turns = [
    { userId: "ana", source: "chat" },
    { userId: "bo", source: "chat" },
    { userId: "ana", source: "witnessScoring" },
    { userId: null, source: "claimExtract" },
  ]

  it("keeps everything when nothing is chosen", () => {
    expect(filterTurns(turns, { memberId: "", source: "" })).toHaveLength(4)
  })

  it("narrows by source", () => {
    expect(filterTurns(turns, { memberId: "", source: "chat" })).toHaveLength(2)
  })

  it("narrows by member", () => {
    expect(filterTurns(turns, { memberId: "ana", source: "" })).toHaveLength(2)
  })

  it("applies both together", () => {
    expect(filterTurns(turns, { memberId: "ana", source: "witnessScoring" })).toEqual([{ userId: "ana", source: "witnessScoring" }])
  })
})

describe("filterEvents", () => {
  const events = [{ type: "cognition" }, { type: "action" }, { type: "cognition" }]

  it("shows every entry when no type is chosen", () => {
    expect(filterEvents(events, "")).toHaveLength(3)
  })

  it("shows only the chosen type", () => {
    expect(filterEvents(events, "cognition")).toHaveLength(2)
  })

  it("shows nothing for a type the run has none of", () => {
    expect(filterEvents(events, "note")).toEqual([])
  })
})
