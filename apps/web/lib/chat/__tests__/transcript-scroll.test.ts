import { describe, it, expect } from "vitest"
import { shouldScrollTranscriptToBottom } from "../transcript-scroll"

describe("shouldScrollTranscriptToBottom", () => {
  it("does NOT jump to the bottom when a reply arrives or finishes - the screen stays where it is", () => {
    expect(shouldScrollTranscriptToBottom({ follow: true, contextChanged: false, lastIsReply: true })).toBe(false)
  })

  it("does not jump on an unrelated refresh of an already shown reply (e.g. a query refetch)", () => {
    expect(shouldScrollTranscriptToBottom({ follow: true, contextChanged: false, lastIsReply: true })).toBe(false)
  })

  it("follows the user's own new prompt so it and the thinking indicator are in view", () => {
    expect(shouldScrollTranscriptToBottom({ follow: true, contextChanged: true, lastIsReply: false })).toBe(true)
  })

  it("follows the thinking indicator / research steps growing while the reply is still being prepared", () => {
    expect(shouldScrollTranscriptToBottom({ follow: true, contextChanged: false, lastIsReply: false })).toBe(true)
  })

  it("lands at the bottom when a consultation is opened, even though its last message is a reply", () => {
    expect(shouldScrollTranscriptToBottom({ follow: true, contextChanged: true, lastIsReply: true })).toBe(true)
  })

  it("never moves a user who has scrolled up to read", () => {
    expect(shouldScrollTranscriptToBottom({ follow: false, contextChanged: true, lastIsReply: false })).toBe(false)
    expect(shouldScrollTranscriptToBottom({ follow: false, contextChanged: false, lastIsReply: false })).toBe(false)
  })
})
