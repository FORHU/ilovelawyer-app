import { describe, expect, it } from "vitest"
import { flattenNotes } from "@/lib/cases/notes"

describe("flattenNotes", () => {
  it("collapses newlines and repeated spaces", () => {
    expect(flattenNotes("  Client called\n\nre: filing   deadline ")).toBe("Client called re: filing deadline")
  })
  it("returns empty for null, undefined and whitespace", () => {
    expect(flattenNotes(null)).toBe("")
    expect(flattenNotes(undefined)).toBe("")
    expect(flattenNotes(" \n ")).toBe("")
  })
})
