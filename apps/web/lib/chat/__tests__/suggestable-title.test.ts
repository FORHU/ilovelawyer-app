import { describe, it, expect } from "vitest"
import { isSuggestableTitle } from "../suggestable-title"

describe("isSuggestableTitle", () => {
  it("accepts Legal Area: Issue titles", () => {
    expect(isSuggestableTitle("Health Law: Abortion Regulations in the UK")).toBe(true)
    expect(isSuggestableTitle("UK Law: General Overview")).toBe(true)
  })

  it("rejects upstream error text saved as a title", () => {
    expect(isSuggestableTitle("[Error] Error code: 429 - {'error': {'message': 'You have no")).toBe(false)
    expect(isSuggestableTitle("Error: something failed")).toBe(false)
  })

  it("rejects off-format, non-legal titles", () => {
    expect(isSuggestableTitle("Rene bituin ng mindanao")).toBe(false)
    expect(isSuggestableTitle("hello")).toBe(false)
    expect(isSuggestableTitle("")).toBe(false)
  })
})
