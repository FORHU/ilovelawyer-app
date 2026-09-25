import { describe, it, expect } from "vitest"
import { caseMindMapStaleDetail } from "../case-mind-map-status"

// A stand-in `t` that shows which key and values were asked for.
const t = ((key: string, opts?: Record<string, unknown>) => `${key}:${JSON.stringify(opts ?? {})}`) as any
const status = (over: object) => ({ version: 1, generatedAt: "", documentCount: 2, isStale: true, ...over })

describe("caseMindMapStaleDetail", () => {
  it("says what changed", () => {
    expect(caseMindMapStaleDetail(t, status({ documentsAdded: 2, documentsRemoved: 0 }))).toBe('caseMindMap.staleAdded:{"count":2}')
    expect(caseMindMapStaleDetail(t, status({ documentsAdded: 0, documentsRemoved: 1 }))).toBe('caseMindMap.staleRemoved:{"count":1}')
    expect(caseMindMapStaleDetail(t, status({ documentsAdded: 2, documentsRemoved: 1 }))).toBe(
      'caseMindMap.staleAddedRemoved:{"added":2,"removed":1,"count":2}',
    )
  })

  it("says nothing when the map isn't stale, or the change isn't known", () => {
    expect(caseMindMapStaleDetail(t, status({ isStale: false, documentsAdded: 3 }))).toBeUndefined()
    expect(caseMindMapStaleDetail(t, status({ documentsAdded: 0, documentsRemoved: 0 }))).toBeUndefined()
    expect(caseMindMapStaleDetail(t, null)).toBeUndefined()
  })
})
