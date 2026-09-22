import { describe, it, expect } from "vitest"
import { shouldHoldAnswer, ANSWER_HOLD_CAP_MS } from "../composer-action"

describe("shouldHoldAnswer", () => {
  it("holds the text of a reply that is still in flight, so answer, confidence and explanation appear together", () => {
    expect(shouldHoldAnswer({ isStreaming: true, revealed: false })).toBe(true)
  })

  it("shows the text once the hold cap has passed, so a slow extra can never hide a finished answer", () => {
    expect(shouldHoldAnswer({ isStreaming: true, revealed: true })).toBe(false)
  })

  it("never holds a reply that is not in flight (saved history)", () => {
    expect(shouldHoldAnswer({ isStreaming: false, revealed: false })).toBe(false)
  })

  it("has a finite cap that stays at/above the API's own structured-data wait budget, so the cap can never fire before the API could have finished (see ANSWER_HOLD_CAP_MS's doc comment / ilovelawyer-api's STRUCTURED_DATA_WAIT_MS)", () => {
    const API_STRUCTURED_DATA_WAIT_MS = 60_000
    expect(ANSWER_HOLD_CAP_MS).toBeGreaterThanOrEqual(API_STRUCTURED_DATA_WAIT_MS)
  })
})
