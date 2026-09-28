import { describe, it, expect } from "vitest"
import { caseMindMapStaleDetail, refreshWillReplaceCaseMap } from "../case-mind-map-status"

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

describe("refreshWillReplaceCaseMap", () => {
  const map = (over: object = {}) => ({ expandedCount: 0, retiredAt: null, ...over })

  it("is false when no Analysis Refresh is running", () => {
    expect(refreshWillReplaceCaseMap({ isRefreshing: false, map: map(), hasIndexedDocuments: true })).toBe(false)
  })

  it("is true for a map the lawyer hasn't touched", () => {
    expect(refreshWillReplaceCaseMap({ isRefreshing: true, map: map(), hasIndexedDocuments: true })).toBe(true)
  })

  it("is false for a map the lawyer expanded or edited, which the refresh leaves alone", () => {
    expect(refreshWillReplaceCaseMap({ isRefreshing: true, map: map({ expandedCount: 2 }), hasIndexedDocuments: true })).toBe(false)
  })

  it("with no map, or a retired one, only when there are indexed documents to build from", () => {
    expect(refreshWillReplaceCaseMap({ isRefreshing: true, map: null, hasIndexedDocuments: true })).toBe(true)
    expect(refreshWillReplaceCaseMap({ isRefreshing: true, map: null, hasIndexedDocuments: false })).toBe(false)
    const retired = map({ retiredAt: "2026-09-25T00:00:00Z", expandedCount: 3 })
    expect(refreshWillReplaceCaseMap({ isRefreshing: true, map: retired, hasIndexedDocuments: true })).toBe(true)
  })
})
