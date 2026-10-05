import { describe, it, expect } from "vitest"
import { mergeRenderedRows } from "../row-merge"

const row = (key: string) => ({ key })
const keys = (rows: { key: string }[]) => rows.map((r) => r.key)

describe("mergeRenderedRows", () => {
  it("shows the new rows of a swap straight away, not only the survivors", () => {
    // Regenerated findings: the kept lawyer row stays, old AI rows go, new AI rows arrive.
    const prev = [row("kept"), row("old1"), row("old2")]
    const live = [row("new1"), row("new2"), row("kept")]
    const merged = mergeRenderedRows(prev, live, new Set(["old1", "old2"]))
    expect(keys(merged)).toEqual(expect.arrayContaining(["new1", "new2", "kept"]))
    expect(merged).toHaveLength(5)
  })

  it("keeps a removed row at its old place until it has faded out", () => {
    const prev = [row("a"), row("b"), row("c")]
    const live = [row("a"), row("c")]
    expect(keys(mergeRenderedRows(prev, live, new Set(["b"])))).toEqual(["a", "b", "c"])
  })

  it("is the live list when nothing is being removed", () => {
    const live = [row("a"), row("b")]
    expect(keys(mergeRenderedRows([row("a")], live, new Set()))).toEqual(["a", "b"])
  })
})
