import { describe, it, expect } from "vitest"
import { describeEditLines, mergeHistory, pickHistoryItem, sessionAuthor, type EditSession, type ManualEdit } from "../manual-edits"
import type { CaseChangeSummary } from "../change-summary"

const run = (id: string, createdAt: string): CaseChangeSummary => ({
  id,
  caseId: "case-1",
  reason: "manual",
  documentsAdded: [],
  documentsRemoved: [],
  totalChanges: 3,
  perPaneDeltas: {},
  createdAt,
})

const edit = (id: string, pane: ManualEdit["pane"], label = id): ManualEdit => ({
  id,
  pane,
  kind: "finding",
  itemId: id,
  action: "added",
  label,
  changes: null,
  createdAt: "2026-10-08T01:00:00Z",
})

const session = (id: string, endedAt: string, edits: ManualEdit[] = [], actorId: string | null = "ana"): EditSession => ({
  id,
  actorId,
  actorName: "Ana Cruz",
  startedAt: endedAt,
  endedAt,
  editCount: edits.length,
  edits,
})

describe("mergeHistory", () => {
  const runs = [run("r1", "2026-10-08T02:00:00Z"), run("r2", "2026-10-08T00:00:00Z")]
  const sessions = [session("s1", "2026-10-08T01:00:00Z")]

  it("lists runs and editing sessions together, newest first (a session by when it ended)", () => {
    expect(mergeHistory(runs, sessions, "all").map((i) => i.key)).toEqual(["run:r1", "edits:s1", "run:r2"])
  })

  it("narrows to Analysis or Edits", () => {
    expect(mergeHistory(runs, sessions, "analysis").map((i) => i.key)).toEqual(["run:r1", "run:r2"])
    expect(mergeHistory(runs, sessions, "edits").map((i) => i.key)).toEqual(["edits:s1"])
  })

  it("selects the newest entry unless another is asked for and still listed", () => {
    const items = mergeHistory(runs, sessions, "all")
    expect(pickHistoryItem(items, null)?.key).toBe("run:r1")
    expect(pickHistoryItem(items, "edits:s1")?.key).toBe("edits:s1")
    expect(pickHistoryItem(items, "edits:gone")?.key).toBe("run:r1")
  })
})

describe("describeEditLines", () => {
  it("groups a session's edits by pane in Terminal order, naming up to four and counting the rest", () => {
    const lines = describeEditLines(
      session("s1", "2026-10-08T01:00:00Z", [
        edit("w1", "weaknesses"),
        edit("e1", "evidence"),
        edit("w2", "weaknesses"),
        edit("w3", "weaknesses"),
        edit("w4", "weaknesses"),
        edit("w5", "weaknesses"),
      ]),
    )
    expect(lines.map((l) => l.pane)).toEqual(["evidence", "weaknesses"])
    expect(lines[1]!.edits.map((e) => e.id)).toEqual(["w1", "w2", "w3", "w4"])
    expect(lines[1]!.more).toBe(1)
  })
})

describe("sessionAuthor", () => {
  it("says you for the viewer's own session, else the person's name", () => {
    expect(sessionAuthor({ actorId: "ana", actorName: "Ana Cruz" }, "ana")).toBe("you")
    expect(sessionAuthor({ actorId: "ana", actorName: "Ana Cruz" }, "ben")).toBe("Ana Cruz")
    expect(sessionAuthor({ actorId: null, actorName: null }, "ben")).toBe(null)
  })
})
