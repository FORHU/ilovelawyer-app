import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { registerShareSocketHandlers, SHARED_CASES_CHANGED } from "@/lib/cases/shared"
import { caseKeys, sharedCaseKeys } from "@/lib/query-keys"

function fakeSocket() {
  const handlers = new Map<string, (payload?: unknown) => void>()
  return {
    on: (event: string, handler: (payload?: unknown) => void) => void handlers.set(event, handler),
    off: (event: string) => void handlers.delete(event),
    fire: (event: string, payload?: unknown) => handlers.get(event)?.(payload),
    handlers,
  }
}

function seeded() {
  const queryClient = new QueryClient()
  queryClient.setQueryData(sharedCaseKeys.list(), [])
  queryClient.setQueryData(caseKeys.detail("c1"), { id: "c1" })
  queryClient.setQueryData(caseKeys.access("c1"), { canContribute: false })
  queryClient.setQueryData(caseKeys.detail("c2"), { id: "c2" })
  return queryClient
}

const stale = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated

describe("registerShareSocketHandlers", () => {
  it("refreshes Shared with me when a case is shared, and leaves the case alone", () => {
    const socket = fakeSocket()
    const queryClient = seeded()
    registerShareSocketHandlers(socket as never, queryClient)
    socket.fire(SHARED_CASES_CHANGED, { caseId: "c1", shared: true })
    expect(stale(queryClient, sharedCaseKeys.list())).toBe(true)
    expect(stale(queryClient, caseKeys.detail("c1"))).toBe(false)
  })

  it("refetches the case when its share ends, so an open page shows it's no longer shared", () => {
    const socket = fakeSocket()
    const queryClient = seeded()
    registerShareSocketHandlers(socket as never, queryClient)
    socket.fire(SHARED_CASES_CHANGED, { caseId: "c1", shared: false })
    expect(stale(queryClient, sharedCaseKeys.list())).toBe(true)
    expect(stale(queryClient, caseKeys.detail("c1"))).toBe(true)
    expect(stale(queryClient, caseKeys.access("c1"))).toBe(true)
    expect(stale(queryClient, caseKeys.detail("c2"))).toBe(false)
  })

  it("catches up on reconnect, and unregisters cleanly", () => {
    const socket = fakeSocket()
    const queryClient = seeded()
    const unregister = registerShareSocketHandlers(socket as never, queryClient)
    socket.fire("connect")
    expect(stale(queryClient, sharedCaseKeys.list())).toBe(true)
    unregister()
    expect(socket.handlers.size).toBe(0)
  })
})
