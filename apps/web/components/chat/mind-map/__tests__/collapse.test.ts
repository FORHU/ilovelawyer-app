import { describe, it, expect } from "vitest"
import { collectIds, reconcileCollapsedIds, countDescendants } from "../collapse"

const tree = {
  id: "root",
  label: "Root",
  children: [
    { id: "a", label: "A", children: [{ id: "a1", label: "A1", children: [] }] },
    { id: "b", label: "B", children: [] },
  ],
}

describe("collectIds", () => {
  it("collects every id in the tree, root included", () => {
    expect(collectIds(tree)).toEqual(new Set(["root", "a", "a1", "b"]))
  })

  it("returns an empty set for a nullish root", () => {
    expect(collectIds(null)).toEqual(new Set())
  })

  it("supports the alternate children-key aliases used by the AI output", () => {
    const aliased = { id: "root", items: [{ id: "x", nodes: [{ id: "y" }] }] }
    expect(collectIds(aliased)).toEqual(new Set(["root", "x", "y"]))
  })
})

describe("countDescendants", () => {
  it("counts every node below the given item, not including itself", () => {
    expect(countDescendants(tree)).toBe(3)
    expect(countDescendants(tree.children[0])).toBe(1)
    expect(countDescendants(tree.children[1])).toBe(0)
  })
})

describe("reconcileCollapsedIds", () => {
  it("keeps collapsed ids that still exist in the new tree", () => {
    const prev = new Set(["a", "b"])
    expect(reconcileCollapsedIds(prev, tree)).toEqual(new Set(["a", "b"]))
  })

  it("drops collapsed ids that no longer exist in a regenerated tree", () => {
    const prev = new Set(["a", "gone"])
    expect(reconcileCollapsedIds(prev, tree)).toEqual(new Set(["a"]))
  })

  it("never introduces new ids — brand-new nodes default to expanded", () => {
    const prev = new Set<string>()
    expect(reconcileCollapsedIds(prev, tree)).toEqual(new Set())
  })
})
