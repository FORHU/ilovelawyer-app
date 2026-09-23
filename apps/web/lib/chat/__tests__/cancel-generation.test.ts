import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { chatKeys } from "@/lib/query-keys"

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

import {
  cancelChatGeneration,
  sendChatMessageAndWait,
  ChatGenerationCancelledError,
  type ChatMessage,
} from "../mutations"

const CONSULTATION = "c-1"
const MESSAGE = "m-user-1"

const sendArgs = { consultationId: CONSULTATION, sessionId: "s-1", message: "hello" }

const userMessage = (replyStatus: ChatMessage["replyStatus"]): ChatMessage => ({
  id: MESSAGE,
  consultationId: CONSULTATION,
  role: "user",
  content: "hello",
  createdAt: "2026-01-01T00:00:00.000Z",
  replyStatus,
})

/** Lets the awaited POST inside sendChatMessageAndWait settle so it has subscribed. */
const settle = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  listeners.clear()
  apiFetch.mockReset()
  apiFetch.mockResolvedValue({ messageId: MESSAGE, sessionId: "s-1", replyStatus: "PENDING" })
})

afterEach(() => {
  vi.useRealTimers()
})

describe("cancelChatGeneration", () => {
  it("POSTs to the message's cancel endpoint and returns the API's answer", async () => {
    apiFetch.mockResolvedValueOnce({ messageId: MESSAGE, replyStatus: "CANCELLED", assistantMessageId: "m-a-1" })
    const result = await cancelChatGeneration(CONSULTATION, MESSAGE)
    expect(apiFetch).toHaveBeenCalledWith(`/api/chat/consultations/${CONSULTATION}/messages/${MESSAGE}/cancel`, {
      method: "POST",
    })
    expect(result).toEqual({ messageId: MESSAGE, replyStatus: "CANCELLED", assistantMessageId: "m-a-1" })
  })
})

describe("sendChatMessageAndWait — stopping", () => {
  it("rejects with ChatGenerationCancelledError on this turn's chat:cancelled, and unsubscribes", async () => {
    const queryClient = new QueryClient()
    const pending = sendChatMessageAndWait(queryClient, sendArgs)
    await settle()
    expect(listenerCount()).toBeGreaterThan(0)

    emit("chat:cancelled", { messageId: MESSAGE })

    await expect(pending).rejects.toBeInstanceOf(ChatGenerationCancelledError)
    expect(listenerCount()).toBe(0)
  })

  it("ignores a chat:cancelled for a different turn", async () => {
    const queryClient = new QueryClient()
    const pending = sendChatMessageAndWait(queryClient, sendArgs)
    await settle()

    emit("chat:cancelled", { messageId: "some-other-turn" })
    emit("chat:done", { messageId: MESSAGE, assistantMessageId: "m-a-1" })

    await expect(pending).resolves.toEqual({ messageId: MESSAGE, sessionId: "s-1" })
  })

  it("rejects with ChatGenerationCancelledError when its signal aborts mid-wait", async () => {
    const queryClient = new QueryClient()
    const abort = new AbortController()
    const pending = sendChatMessageAndWait(queryClient, sendArgs, { signal: abort.signal })
    await settle()

    abort.abort()

    await expect(pending).rejects.toBeInstanceOf(ChatGenerationCancelledError)
    expect(listenerCount()).toBe(0)
  })

  it("Stop pressed before the POST returns: still enqueues, reports the id, then rejects at once", async () => {
    const queryClient = new QueryClient()
    const abort = new AbortController()
    const onEnqueued = vi.fn()
    let resolvePost!: (v: unknown) => void
    apiFetch.mockReturnValueOnce(new Promise((r) => (resolvePost = r)))

    const pending = sendChatMessageAndWait(queryClient, sendArgs, { signal: abort.signal, onEnqueued })
    abort.abort() // before the POST has come back
    resolvePost({ messageId: MESSAGE, sessionId: "s-1", replyStatus: "PENDING" })

    await expect(pending).rejects.toBeInstanceOf(ChatGenerationCancelledError)
    // The caller needs the real id to ask the API to stop the turn it just created.
    expect(onEnqueued).toHaveBeenCalledWith(MESSAGE)
  })

  it("notices a missed chat:cancelled from the polled history, even when a partial reply grew it by two", async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION), [userMessage("PENDING")])
    const pending = sendChatMessageAndWait(queryClient, sendArgs, { messagesBefore: 0 })
    const assertion = expect(pending).rejects.toBeInstanceOf(ChatGenerationCancelledError)
    await vi.advanceTimersByTimeAsync(0)

    // Stopped elsewhere: user message CANCELLED plus the saved partial reply (history +2).
    queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION), [
      userMessage("CANCELLED"),
      { ...userMessage(null), id: "m-a-1", role: "assistant", content: "partial" },
    ])
    await vi.advanceTimersByTimeAsync(1600)

    await assertion
  })

  it("a normal completion is unchanged: chat:done resolves, and the poll still resolves on a DONE turn", async () => {
    vi.useFakeTimers()
    const queryClient = new QueryClient()
    const pending = sendChatMessageAndWait(queryClient, sendArgs, { messagesBefore: 0 })
    await vi.advanceTimersByTimeAsync(0)

    queryClient.setQueryData<ChatMessage[]>(chatKeys.messages(CONSULTATION), [
      userMessage("DONE"),
      { ...userMessage(null), id: "m-a-1", role: "assistant", content: "full answer" },
    ])
    await vi.advanceTimersByTimeAsync(1600)

    await expect(pending).resolves.toEqual({ messageId: MESSAGE, sessionId: "s-1" })
  })
})
