import { describe, it, expect } from "vitest"
import { isSameSource } from "../linked-todos"
import type { SnapshotProcedureItem } from "../types"

const todo = (extra: Partial<SnapshotProcedureItem>): SnapshotProcedureItem => ({
  id: "t1",
  kind: "TODO",
  label: "Get the payroll certification",
  done: false,
  notes: null,
  sourceLabel: null,
  ...extra,
})

describe("isSameSource", () => {
  it("matches a to-do to the item it was sent from", () => {
    expect(isSameSource(todo({ sourceKind: "DAMAGE", sourceId: "d1" }), { kind: "DAMAGE", id: "d1" })).toBe(true)
    expect(isSameSource(todo({ sourceKind: "DAMAGE", sourceId: "d1" }), { kind: "DAMAGE", id: "d2" })).toBe(false)
    expect(isSameSource(todo({ sourceKind: "FINDING", sourceId: "d1" }), { kind: "DAMAGE", id: "d1" })).toBe(false)
  })

  it("tells a witness's needs apart by key", () => {
    const statement = todo({ sourceKind: "WITNESS_NEED", sourceId: "w1", sourceKey: "STATEMENT" })
    expect(isSameSource(statement, { kind: "WITNESS_NEED", id: "w1", key: "STATEMENT" })).toBe(true)
    expect(isSameSource(statement, { kind: "WITNESS_NEED", id: "w1", key: "DOCUMENT" })).toBe(false)
  })

  it("never matches a to-do with no source, or one from an API that predates the link", () => {
    expect(isSameSource(todo({ sourceKind: null, sourceId: null }), { kind: "DAMAGE", id: "d1" })).toBe(false)
    expect(isSameSource(todo({}), { kind: "FINDING", id: "f1" })).toBe(false)
  })
})
