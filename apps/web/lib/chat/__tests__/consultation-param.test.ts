import { describe, it, expect } from "vitest"
import {
  DRAFT_CONSULTATION_PARAM,
  consultationIdFromParam,
  isDraftConsultationParam,
  isForeignConsultation,
} from "../consultation-param"

describe("consultationIdFromParam", () => {
  it("passes a real id through", () => {
    expect(consultationIdFromParam("c-1")).toBe("c-1")
  })

  it("treats no param and the draft as no consultation — `new` is never sent as an id", () => {
    expect(consultationIdFromParam(null)).toBeNull()
    expect(consultationIdFromParam(undefined)).toBeNull()
    expect(consultationIdFromParam("")).toBeNull()
    expect(consultationIdFromParam(DRAFT_CONSULTATION_PARAM)).toBeNull()
  })
})

describe("isDraftConsultationParam", () => {
  it("is true only for the draft param", () => {
    expect(isDraftConsultationParam(DRAFT_CONSULTATION_PARAM)).toBe(true)
    expect(isDraftConsultationParam("c-1")).toBe(false)
    expect(isDraftConsultationParam(null)).toBe(false)
  })
})

describe("isForeignConsultation", () => {
  const list = [{ id: "a" }, { id: "b" }]

  it("flags an id the Case's list doesn't contain (another Case's, or a deleted one)", () => {
    expect(isForeignConsultation("other-case", list)).toBe(true)
  })

  it("accepts the Case's own consultations", () => {
    expect(isForeignConsultation("b", list)).toBe(false)
  })

  it("never judges before the list has loaded, or with nothing selected", () => {
    expect(isForeignConsultation("other-case", undefined)).toBe(false)
    expect(isForeignConsultation(null, list)).toBe(false)
  })

  it("accepts a consultation created a moment ago that the list hasn't caught up with", () => {
    expect(isForeignConsultation("just-made", list, [null, "just-made"])).toBe(false)
  })

  it("flags anything once the Case has no consultations left", () => {
    expect(isForeignConsultation("a", [])).toBe(true)
  })
})
