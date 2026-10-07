import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useTourStore } from "@/lib/store/tour.store"

describe("tour store", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useTourStore.getState().reset()
  })
  afterEach(() => {
    useTourStore.getState().reset()
    vi.useRealTimers()
  })

  it("adds the next step as a guide message nobody asked for, streamed in", () => {
    useTourStore.getState().ask("How do I open the Terminal?", { text: "Create a case first." })
    useTourStore.getState().follow({ text: "Your case is ready.", path: [{ key: "createCase", state: "done" }] })
    vi.runAllTimers()
    const messages = useTourStore.getState().messages
    expect(messages.map((m) => m.role)).toEqual(["user", "guide", "guide"])
    expect(messages.at(-1)).toMatchObject({ text: "Your case is ready.", done: true, path: [{ key: "createCase", state: "done" }] })
    // The earlier answer finished rather than being cut off.
    expect(messages[1]).toMatchObject({ done: true, shown: "Create a case first.".length })
  })

  it("forgets a waiting next step when the guide starts over or the user signs out", () => {
    const { setPendingGoal, setGuideNudge, clearGuide, reset } = useTourStore.getState()
    setPendingGoal({ answerId: "workspace" })
    setGuideNudge(true)
    clearGuide()
    expect(useTourStore.getState()).toMatchObject({ pendingGoal: null, guideNudge: false })

    setPendingGoal({ answerId: "terminal" })
    reset()
    expect(useTourStore.getState().pendingGoal).toBeNull()
  })
})
