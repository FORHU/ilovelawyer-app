import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

// useQuery is a real React hook (useSyncExternalStore under the hood) and throws when called
// outside render — this repo's vitest setup has no component/E2E harness (see vitest.config.ts's
// top comment), so we verify the *options* useCaseLawyerInviteLookupQuery builds instead of
// rendering it.
const useQueryMock = vi.fn()
vi.mock("@tanstack/react-query", () => ({ useQuery: (options: unknown) => useQueryMock(options) }))

import { useCaseLawyerInviteLookupQuery, fetchCaseLawyerInvite } from "../case-lawyer-invite"
import { useAuthStore } from "@/lib/store/auth.store"

beforeEach(() => {
  useQueryMock.mockReset()
})

describe("useCaseLawyerInviteLookupQuery", () => {
  it("does not fire when token is undefined", () => {
    useCaseLawyerInviteLookupQuery(undefined)
    expect(useQueryMock).toHaveBeenCalledTimes(1)
    expect(useQueryMock.mock.calls[0][0]).toMatchObject({ enabled: false })
  })

  it("is enabled when a token is given", () => {
    useCaseLawyerInviteLookupQuery("tok-1")
    expect(useQueryMock.mock.calls[0][0]).toMatchObject({ enabled: true })
  })
})

describe("fetchCaseLawyerInvite", () => {
  const realFetch = global.fetch

  afterEach(() => {
    global.fetch = realFetch
    useAuthStore.getState().clearAuth()
  })

  it("GETs /api/case-lawyer-invites/:token without an auth header", async () => {
    useAuthStore.getState().clearAuth() // no session — this is a public, pre-auth lookup
    const response = { status: "valid", clientFirstName: "Jamie", caseName: "Doe v. Roe", email: null }
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchCaseLawyerInvite("abc-token")

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain("/api/case-lawyer-invites/abc-token")
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
    expect(result).toEqual(response)
  })
})
