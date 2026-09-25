import { describe, it, expect } from "vitest"
import { buildMindMapGraph, estimateNodeSize, radialRingRadii, MIND_MAP_PERF_THRESHOLD } from "../layout"
import { MIND_MAP_HEX_COLORS } from "../constants"

const map = {
  id: "root",
  label: "Case Analysis",
  isRoot: true,
  children: [
    { id: "legalBasis", label: "Legal Basis", children: [{ id: "legalBasis.1", label: "Art. 1170", children: [{ id: "legalBasis.1.1", label: "Due date passed", children: [] }] }] },
    { id: "keyFacts", label: "Key Facts", children: [{ id: "keyFacts.1", label: "Loan", children: [] }] },
  ],
}

const byId = (nodes: { id: string }[]) => new Map(nodes.map((n) => [n.id, n as any]))

describe("buildMindMapGraph", () => {
  it("colours a whole branch the same, whatever the depth", () => {
    const nodes = byId(buildMindMapGraph(map, "horizontal", new Set(), "Cruz v. Reyes").nodes)
    expect(nodes.get("legalBasis").data.color).toBe(MIND_MAP_HEX_COLORS[0])
    expect(nodes.get("legalBasis.1.1").data.color).toBe(MIND_MAP_HEX_COLORS[0])
    expect(nodes.get("keyFacts.1").data.color).toBe(MIND_MAP_HEX_COLORS[1])
  })

  it("uses the case title on a generic root and skips collapsed subtrees", () => {
    const { nodes, edges } = buildMindMapGraph(map, "horizontal", new Set(["legalBasis.1"]), "Cruz v. Reyes")
    const ids = byId(nodes)
    expect(ids.get("root").data.label).toBe("Cruz v. Reyes")
    expect(ids.has("legalBasis.1.1")).toBe(false)
    expect(ids.get("legalBasis.1").data.isCollapsed).toBe(true)
    expect(edges).toHaveLength(nodes.length - 1)
  })

  it("gives a long label more room so it doesn't overlap its sibling", () => {
    const short = { id: "root", label: "R", children: [{ id: "a", label: "A" }, { id: "b", label: "B" }] }
    const long = { id: "root", label: "R", children: [{ id: "a", label: "A".repeat(120) }, { id: "b", label: "B" }] }
    const gap = (tree: any) => {
      const nodes = byId(buildMindMapGraph(tree, "horizontal", new Set(), "").nodes)
      return nodes.get("b").position.y - nodes.get("a").position.y
    }
    expect(gap(long)).toBeGreaterThan(gap(short))
    expect(gap(long)).toBeGreaterThanOrEqual(estimateNodeSize({ label: "A".repeat(120) }).height)
  })

  it("stops animating edges on big maps", () => {
    const small = buildMindMapGraph(map, "horizontal", new Set(), "")
    expect(small.edges.every((e) => e.animated)).toBe(true)
    const big = { id: "root", label: "R", children: Array.from({ length: MIND_MAP_PERF_THRESHOLD + 5 }, (_, i) => ({ id: `n${i}`, label: `Node ${i}` })) }
    expect(buildMindMapGraph(big, "horizontal", new Set(), "").edges.every((e) => !e.animated)).toBe(true)
  })

  it("spreads a crowded radial ring further out", () => {
    const [, sparse] = radialRingRadii([1, 5])
    const [, crowded] = radialRingRadii([1, 40])
    expect(sparse).toBe(600)
    expect(crowded).toBeGreaterThan(sparse)
    const radii = radialRingRadii([1, 5, 3])
    expect(radii[2]! - radii[1]!).toBeGreaterThanOrEqual(600)
  })

  it("marks only the verdicts that need a look (Stage 6)", () => {
    const check = (verdict: string) => ({ verdict, confidence: 0.9, evidenceKind: "SHOWN_BY_DOCUMENT", documentId: "d", located: true, checkedAt: "" })
    const checked = {
      id: "root",
      label: "R",
      children: [
        { id: "a", label: "A", check: check("SUPPORTED") },
        { id: "b", label: "B", check: check("UNSUPPORTED") },
        { id: "c", label: "C", check: check("CONTRADICTED") },
        { id: "d", label: "D" },
        { id: "e", label: "E", sourceRemoved: true },
      ],
    }
    const nodes = byId(buildMindMapGraph(checked, "horizontal", new Set(), "").nodes)
    expect(["a", "b", "c", "d", "e"].map((id) => nodes.get(id).data.reviewVerdict)).toEqual([null, "UNSUPPORTED", "CONTRADICTED", null, "SOURCE_REMOVED"])
  })

  it("says whether a verdict was reached on the case data or on a cited page", () => {
    const tree = {
      id: "root",
      label: "R",
      children: [
        { id: "a", label: "A", check: { verdict: "UNSUPPORTED", confidence: 0.9, basis: "caseData", checkedAt: "" } },
        { id: "b", label: "B", check: { verdict: "UNSUPPORTED", confidence: 0.9, basis: "document", documentId: "d", located: true, checkedAt: "" } },
      ],
    }
    const nodes = byId(buildMindMapGraph(tree, "horizontal", new Set(), "").nodes)
    expect(nodes.get("a").data.reviewByCase).toBe(true)
    expect(nodes.get("b").data.reviewByCase).toBe(false)
  })
})
