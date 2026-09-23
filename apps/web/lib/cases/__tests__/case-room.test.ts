import { describe, expect, it, vi } from "vitest"
import { joinCaseRoom, isCaseRoomSubscribed } from "@/lib/cases/case-room"

function fakeSocket(connected: boolean) {
  const handlers = new Map<string, () => void>()
  return {
    connected,
    emit: vi.fn((event: string, _payload: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      if (event === "case:subscribe") ack?.({ ok: true })
    }),
    on: vi.fn((event: string, fn: () => void) => handlers.set(event, fn)),
    off: vi.fn((event: string) => handlers.delete(event)),
    fireConnect: () => handlers.get("connect")?.(),
  }
}

describe("joinCaseRoom / isCaseRoomSubscribed", () => {
  it("subscribes immediately when already connected, and marks the case subscribed once the ack resolves ok", () => {
    const socket = fakeSocket(true)

    expect(isCaseRoomSubscribed("case1")).toBe(false)
    joinCaseRoom(socket, "case1")

    expect(socket.emit).toHaveBeenCalledWith("case:subscribe", { caseId: "case1" }, expect.any(Function))
    expect(isCaseRoomSubscribed("case1")).toBe(true)
  })

  it("does not mark subscribed when the server denies the join", () => {
    const socket = fakeSocket(true)
    socket.emit.mockImplementation((event: string, _payload: unknown, ack?: (res: { ok: boolean; error?: string }) => void) => {
      if (event === "case:subscribe") ack?.({ ok: false, error: "Not authorized for this case" })
    })

    joinCaseRoom(socket, "case2")

    expect(isCaseRoomSubscribed("case2")).toBe(false)
  })

  it("waits for connect before subscribing when the socket starts disconnected", () => {
    const socket = fakeSocket(false)

    joinCaseRoom(socket, "case3")
    expect(socket.emit).not.toHaveBeenCalled()
    expect(socket.on).toHaveBeenCalledWith("connect", expect.any(Function))

    socket.fireConnect()
    expect(socket.emit).toHaveBeenCalledWith("case:subscribe", { caseId: "case3" }, expect.any(Function))
    expect(isCaseRoomSubscribed("case3")).toBe(true)
  })

  it("re-subscribes on every reconnect, not just the first connect", () => {
    const socket = fakeSocket(false)
    joinCaseRoom(socket, "case4")

    socket.fireConnect()
    socket.emit.mockClear()

    // A second reconnect (e.g. after a dropped connection) must re-join — server-side room
    // membership doesn't survive it even though this client Socket object does.
    socket.fireConnect()
    expect(socket.emit).toHaveBeenCalledWith("case:subscribe", { caseId: "case4" }, expect.any(Function))
  })

  it("cleanup stops future reconnects, tells the server to leave, and clears the subscribed flag", () => {
    const socket = fakeSocket(true)
    const cleanup = joinCaseRoom(socket, "case5")
    expect(isCaseRoomSubscribed("case5")).toBe(true)

    cleanup()

    expect(socket.off).toHaveBeenCalledWith("connect", expect.any(Function))
    expect(socket.emit).toHaveBeenCalledWith("case:unsubscribe", { caseId: "case5" })
    expect(isCaseRoomSubscribed("case5")).toBe(false)

    // The connect handler was deregistered — a later reconnect must not re-subscribe.
    socket.emit.mockClear()
    socket.fireConnect()
    expect(socket.emit).not.toHaveBeenCalled()
  })

  it("tracks each caseId's subscription independently", () => {
    const socket = fakeSocket(true)
    joinCaseRoom(socket, "caseA")

    expect(isCaseRoomSubscribed("caseA")).toBe(true)
    expect(isCaseRoomSubscribed("caseB")).toBe(false)
  })

  it("returns false for an undefined caseId without throwing", () => {
    expect(isCaseRoomSubscribed(undefined)).toBe(false)
  })
})
