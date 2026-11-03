import { describe, expect, it } from "vitest"
import { QueryClient } from "@tanstack/react-query"
import { registerWalletSocketHandlers, WALLET_UPDATED } from "@/lib/organizations/wallet-socket"
import { clientRequestKeys, walletKeys } from "@/lib/query-keys"
import { OWN_WORKSPACE_ID } from "@/lib/store/auth.store"

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
  queryClient.setQueryData(walletKeys.wallet("org-1"), { id: "w1" })
  queryClient.setQueryData(walletKeys.earnings("org-1", 1), { total: 0, data: [] })
  queryClient.setQueryData(walletKeys.withdrawals("org-1", 1), { total: 0, data: [] })
  queryClient.setQueryData(walletKeys.wallet(OWN_WORKSPACE_ID), { id: "w2" })
  queryClient.setQueryData(clientRequestKeys.all, [])
  queryClient.setQueryData(clientRequestKeys.invoice("req-1"), { invoice: null })
  return queryClient
}

const stale = (queryClient: QueryClient, key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated

describe("registerWalletSocketHandlers", () => {
  it("refetches the balances, earnings and withdrawals of every cached wallet on wallet:updated", () => {
    const socket = fakeSocket()
    const queryClient = seeded()
    registerWalletSocketHandlers(socket as never, queryClient)
    socket.fire(WALLET_UPDATED, { walletId: "w1" })
    expect(stale(queryClient, walletKeys.wallet("org-1"))).toBe(true)
    expect(stale(queryClient, walletKeys.earnings("org-1", 1))).toBe(true)
    expect(stale(queryClient, walletKeys.withdrawals("org-1", 1))).toBe(true)
    expect(stale(queryClient, walletKeys.wallet(OWN_WORKSPACE_ID))).toBe(true)
    // A refund or dispute shows on the engagement's invoice too.
    expect(stale(queryClient, clientRequestKeys.invoice("req-1"))).toBe(true)
    expect(stale(queryClient, clientRequestKeys.all)).toBe(false)
  })

  it("catches up on reconnect, and unregisters cleanly", () => {
    const socket = fakeSocket()
    const queryClient = seeded()
    const unregister = registerWalletSocketHandlers(socket as never, queryClient)
    socket.fire("connect")
    expect(stale(queryClient, walletKeys.wallet("org-1"))).toBe(true)
    unregister()
    expect(socket.handlers.size).toBe(0)
  })
})
