import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { toast } from "sonner"
import type { QueryClient } from "@tanstack/react-query"
import { clientRequestKeys } from "@/lib/query-keys"
import { onClientRequestDeleted } from "../socket"

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/i18n/i18n", () => ({ default: { t: (key: string) => key } }))

describe("onClientRequestDeleted", () => {
  const invalidateQueries = vi.fn()
  const queryClient = { invalidateQueries } as unknown as QueryClient
  const viewing = (pathname: string) => vi.stubGlobal("window", { location: { pathname } })

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("refetches client requests so the deleted one leaves the lists and its page", () => {
    viewing("/homepage/client-requests")
    onClientRequestDeleted(queryClient, { requestId: "req-1" })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: clientRequestKeys.all })
  })

  it("tells a lawyer who has that request open that the client deleted the case", () => {
    viewing("/homepage/client-requests/req-1")
    onClientRequestDeleted(queryClient, { requestId: "req-1" })
    expect(toast.info).toHaveBeenCalledWith("detail.deletedToast")
  })

  it("does not interrupt a lawyer looking at a different request, or the list", () => {
    viewing("/homepage/client-requests/req-2")
    onClientRequestDeleted(queryClient, { requestId: "req-1" })
    viewing("/homepage/client-requests")
    onClientRequestDeleted(queryClient, { requestId: "req-1" })
    expect(toast.info).not.toHaveBeenCalled()
  })

  it("still works with a trailing slash on the address", () => {
    viewing("/homepage/client-requests/req-1/")
    onClientRequestDeleted(queryClient, { requestId: "req-1" })
    expect(toast.info).toHaveBeenCalledTimes(1)
  })
})
