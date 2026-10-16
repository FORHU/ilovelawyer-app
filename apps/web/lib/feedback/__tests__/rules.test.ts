import { describe, expect, it } from "vitest"
import { caseIdFromPath, FEEDBACK_COMMENT_MAX_CHARS, isFeedbackSendable, viewportOf } from "../rules"

describe("isFeedbackSendable", () => {
  it("needs only a comment for a general submission; the category is optional", () => {
    expect(isFeedbackSendable({ source: "GENERAL", category: "BUG", comment: "The date is wrong" })).toBe(true)
    expect(isFeedbackSendable({ source: "GENERAL", category: null, comment: "The date is wrong" })).toBe(true)
    expect(isFeedbackSendable({ source: "GENERAL", comment: "The date is wrong" })).toBe(true)
    expect(isFeedbackSendable({ source: "GENERAL", category: "BUG", comment: "   " })).toBe(false)
  })

  it("lets a thumbs-up go without a comment but not a thumbs-down", () => {
    expect(isFeedbackSendable({ source: "CHAT_ANSWER", rating: "UP", comment: "" })).toBe(true)
    expect(isFeedbackSendable({ source: "CHAT_ANSWER", rating: "DOWN", comment: "" })).toBe(false)
    expect(isFeedbackSendable({ source: "CHAT_ANSWER", rating: "DOWN", comment: "Wrong section cited" })).toBe(true)
  })

  it("needs a comment on a pane flag", () => {
    expect(isFeedbackSendable({ source: "TERMINAL_PANE", comment: "" })).toBe(false)
    expect(isFeedbackSendable({ source: "TERMINAL_PANE", comment: "Missing the second respondent" })).toBe(true)
  })

  it("refuses a comment over the limit", () => {
    expect(isFeedbackSendable({ source: "TERMINAL_PANE", comment: "x".repeat(FEEDBACK_COMMENT_MAX_CHARS) })).toBe(true)
    expect(isFeedbackSendable({ source: "TERMINAL_PANE", comment: "x".repeat(FEEDBACK_COMMENT_MAX_CHARS + 1) })).toBe(false)
  })
})

describe("caseIdFromPath", () => {
  const id = "e56011b3-fd2c-4d04-93d1-d07713e32c58"

  it("reads the case from the Terminal and case pages", () => {
    expect(caseIdFromPath(`/homepage/terminal/${id}`)).toBe(id)
    expect(caseIdFromPath(`/homepage/terminal/${id}/canvas/1`)).toBe(id)
    expect(caseIdFromPath(`/homepage/case-portfolio/${id}`)).toBe(id)
    expect(caseIdFromPath(`/homepage/v2/case-portfolio/${id}`)).toBe(id)
  })

  it("returns nothing off a case page", () => {
    expect(caseIdFromPath("/homepage")).toBeUndefined()
    expect(caseIdFromPath("/homepage/case-portfolio")).toBeUndefined()
    expect(caseIdFromPath("/homepage/terminal/not-a-case")).toBeUndefined()
  })
})

describe("viewportOf", () => {
  it("formats width and height", () => {
    expect(viewportOf(1440, 900)).toBe("1440x900")
    expect(viewportOf(1439.6, 900.2)).toBe("1440x900")
  })
})
