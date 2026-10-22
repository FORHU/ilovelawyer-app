import { describe, it, expect } from "vitest"
import { addTags } from "../tag-list"

const limits = { max: 3, maxLength: 10 }

describe("addTags", () => {
  it("adds a typed tag, trimmed", () => {
    expect(addTags([], "  English ", limits)).toEqual(["English"])
  })

  it("splits a pasted, comma-separated list", () => {
    expect(addTags([], "English, Welsh,,Urdu", limits)).toEqual(["English", "Welsh", "Urdu"])
  })

  it("skips a tag that's already there, whatever its case", () => {
    const list = ["English"]
    expect(addTags(list, "english", limits)).toBe(list)
    expect(addTags([], "Welsh, WELSH", limits)).toEqual(["Welsh"])
  })

  it("stops at the most tags allowed and cuts long ones", () => {
    expect(addTags(["A", "B"], "C, D", limits)).toEqual(["A", "B", "C"])
    expect(addTags([], "Portuguese (Brazil)", limits)).toEqual(["Portuguese"])
  })

  it("leaves the list alone for blank input", () => {
    const list = ["English"]
    expect(addTags(list, " , ", limits)).toBe(list)
  })
})
