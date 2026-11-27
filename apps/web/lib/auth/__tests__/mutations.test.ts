import { describe, it, expect, vi, beforeEach } from "vitest"

// useMutation/useQueryClient and the zustand auth store hooks are real React hooks and throw
// when called outside render — this repo's vitest setup has no component/E2E harness (see
// vitest.config.ts's top comment). We mock them to capture the mutation config instead, and call
// `mutationFn` directly, matching the pattern this repo already uses for testing mutation logic
// (e.g. lib/chat/__tests__/cancel-generation.test.ts mocks @/lib/fetch and tests the exported
// function directly).
const apiFetch = vi.fn()
vi.mock("@/lib/fetch", () => ({ apiFetch: (...args: unknown[]) => apiFetch(...args) }))

const useMutationMock = vi.fn((config: unknown) => config)
vi.mock("@tanstack/react-query", () => ({
  useMutation: (config: unknown) => useMutationMock(config),
  useQuery: vi.fn(),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}))

const authState = { setAuth: vi.fn(), setOrganization: vi.fn() }
vi.mock("@/lib/store/auth.store", () => ({
  useAuthStore: (selector: (s: typeof authState) => unknown) => selector(authState),
  ownWorkspace: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => ({ get: () => null }),
}))

vi.mock("@/lib/organizations/mutations", () => ({ useEnterSharedWorkspace: () => vi.fn() }))

import { useVerifyOtpMutation, useLoginMutation, useGoogleAuthMutation } from "../mutations"

type MutationConfig = { mutationFn: (args: unknown) => Promise<unknown> }

/** hydrateActiveOrganization's own follow-up calls (GET /api/organizations, etc.) are
 * irrelevant to these tests and swallowed by its try/catch — resolving them to a rejection
 * keeps every mutation's result at `organizationStatus: "unknown"` without extra setup. */
function mockPrimaryResponseThenOrgLookupFailure(primary: unknown) {
  apiFetch.mockReset()
  apiFetch.mockResolvedValueOnce(primary)
  apiFetch.mockRejectedValue(new Error("not relevant to this test"))
}

beforeEach(() => {
  apiFetch.mockReset()
  authState.setAuth.mockReset()
  authState.setOrganization.mockReset()
})

describe("useVerifyOtpMutation", () => {
  it("includes caseInviteToken in the request body when provided", async () => {
    mockPrimaryResponseThenOrgLookupFailure({
      accessToken: "token",
      user: { id: "u1" },
      caseLawyerInvite: { requestId: "req-1", caseId: "case-1" },
    })

    const { mutationFn } = useVerifyOtpMutation() as MutationConfig
    const result = await mutationFn({ email: "a@b.com", code: "123456", caseInviteToken: "invite-tok" })

    const [path, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(path).toBe("/api/auth/verify-otp")
    expect(JSON.parse(options.body)).toEqual({ email: "a@b.com", code: "123456", caseInviteToken: "invite-tok" })
    expect((result as { caseLawyerInvite: unknown }).caseLawyerInvite).toEqual({ requestId: "req-1", caseId: "case-1" })
  })

  it("omits caseInviteToken from the request body when not provided", async () => {
    mockPrimaryResponseThenOrgLookupFailure({ accessToken: "token", user: { id: "u1" }, caseLawyerInvite: null })

    const { mutationFn } = useVerifyOtpMutation() as MutationConfig
    await mutationFn({ email: "a@b.com", code: "123456" })

    const [, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(options.body)).not.toHaveProperty("caseInviteToken")
  })
})

describe("useLoginMutation", () => {
  it("includes caseInviteToken in the request body when provided, and threads caseLawyerInvite through", async () => {
    mockPrimaryResponseThenOrgLookupFailure({
      accessToken: "token",
      user: { id: "u1" },
      caseLawyerInvite: { error: "INVITE_NOT_FOUND" },
    })

    const { mutationFn } = useLoginMutation() as MutationConfig
    const result = await mutationFn({ email: "a@b.com", password: "pw", remember: true, caseInviteToken: "invite-tok" })

    const [path, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(path).toBe("/api/auth/login")
    expect(JSON.parse(options.body)).toEqual({ email: "a@b.com", password: "pw", remember: true, caseInviteToken: "invite-tok" })
    expect((result as { caseLawyerInvite: unknown }).caseLawyerInvite).toEqual({ error: "INVITE_NOT_FOUND" })
  })

  it("omits caseInviteToken from the request body when not provided", async () => {
    mockPrimaryResponseThenOrgLookupFailure({ accessToken: "token", user: { id: "u1" }, caseLawyerInvite: null })

    const { mutationFn } = useLoginMutation() as MutationConfig
    await mutationFn({ email: "a@b.com", password: "pw", remember: false })

    const [, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(options.body)).not.toHaveProperty("caseInviteToken")
  })
})

describe("useGoogleAuthMutation", () => {
  it("includes caseInviteToken in the request body when provided, and threads caseLawyerInvite through", async () => {
    mockPrimaryResponseThenOrgLookupFailure({
      accessToken: "token",
      user: { id: "u1" },
      caseLawyerInvite: { requestId: "req-2", caseId: "case-2" },
    })

    const { mutationFn } = useGoogleAuthMutation() as MutationConfig
    const result = await mutationFn({ idToken: "id-tok", remember: true, caseInviteToken: "invite-tok" })

    const [path, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(path).toBe("/api/auth/google")
    expect(JSON.parse(options.body)).toEqual({ idToken: "id-tok", remember: true, caseInviteToken: "invite-tok" })
    expect((result as { caseLawyerInvite: unknown }).caseLawyerInvite).toEqual({ requestId: "req-2", caseId: "case-2" })
  })

  it("omits caseInviteToken from the request body when not provided", async () => {
    mockPrimaryResponseThenOrgLookupFailure({ accessToken: "token", user: { id: "u1" }, caseLawyerInvite: null })

    const { mutationFn } = useGoogleAuthMutation() as MutationConfig
    await mutationFn({ idToken: "id-tok", remember: false })

    const [, options] = apiFetch.mock.calls[0] as [string, { body: string }]
    expect(JSON.parse(options.body)).not.toHaveProperty("caseInviteToken")
  })
})
