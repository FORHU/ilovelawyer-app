import { describe, it, expect, beforeEach, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"

// A tiny stand-in for the shared notification socket: just on/off/emit.
const listeners = new Map<string, Set<(payload: unknown) => void>>()
const fakeSocket = {
  on: (event: string, fn: (payload: unknown) => void) => {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(fn)
  },
  off: (event: string, fn: (payload: unknown) => void) => listeners.get(event)?.delete(fn),
}
const emit = (event: string, payload: unknown) => listeners.get(event)?.forEach((fn) => fn(payload))
const listenerCount = () => [...listeners.values()].reduce((n, set) => n + set.size, 0)

const apiFetch = vi.fn()

vi.mock("@/lib/fetch", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))
vi.mock("@/lib/notifications/socket", () => ({ getNotificationSocket: () => fakeSocket }))

import { subscribeChatGeneration, sendChatMessageAndWait } from "../mutations"

const MESSAGE = "m-user-1"
const sendArgs = { consultationId: "c-1", sessionId: "s-1", message: "hello" }
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  listeners.clear()
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ messageId: MESSAGE, sessionId: "s-1", replyStatus: "PENDING" })
})

describe("chat:answer-complete", () => {
  it("subscribeChatGeneration calls onAnswerComplete for its own turn only", () => {
    const onAnswerComplete = vi.fn()
    const unsubscribe = subscribeChatGeneration(MESSAGE, { onAnswerComplete })

    emit("chat:answer-complete", { messageId: "some-other-turn" })
    expect(onAnswerComplete).not.toHaveBeenCalled()

    emit("chat:answer-complete", { messageId: MESSAGE })
    expect(onAnswerComplete).toHaveBeenCalledTimes(1)

    unsubscribe()
    expect(listenerCount()).toBe(0)
  })

  it("sendChatMessageAndWait reports it, and the turn keeps waiting until chat:done", async () => {
    const queryClient = new QueryClient()
    const onAnswerComplete = vi.fn()
    let settled = false
    const pending = sendChatMessageAndWait(queryClient, sendArgs, { onAnswerComplete }).then((r) => {
      settled = true
      return r
    })
    await settle()

    emit("chat:answer-complete", { messageId: MESSAGE })
    await settle()

    // The text is done, but the extras and saving are not: the promise must still be pending.
    expect(onAnswerComplete).toHaveBeenCalledTimes(1)
    expect(settled).toBe(false)

    emit("chat:done", { messageId: MESSAGE, assistantMessageId: "m-a-1" })
    await expect(pending).resolves.toEqual({ messageId: MESSAGE, sessionId: "s-1" })
  })
})
