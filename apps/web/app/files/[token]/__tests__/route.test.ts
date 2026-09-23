// Tests the exported GET function directly (no server, no DOM, no component render — just
// calling an async function with a mocked global fetch), consistent with this repo's
// pure-function-only vitest scope. Covers what the ticket asks for on the Next.js side:
// successful proxying, invalid/failed upstream calls, and timeout handling.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET, UPSTREAM_FETCH_TIMEOUT_MS } from "../route"

// versioned() only adds a version segment when NEXT_PUBLIC_API_VERSION_PREFIX is set, which it
// isn't in this test env — so this must match the un-versioned path, not "/api/v1/...".
const RESOLVE_URL_PREFIX = "http://localhost:3001/api/files/resolve"
const S3_URL = "https://ilovelawyer-dev.s3.ap-southeast-1.amazonaws.com/generated-documents/abc.pdf?X-Amz-Signature=fake"

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), { ...init, headers: { "content-type": "application/json" } })
}

function makeRequest(rangeHeader?: string) {
  return new NextRequest("http://localhost:3002/files/some-token", {
    headers: rangeHeader ? { range: rangeHeader } : undefined,
  })
}

function callGet(token = "some-token", rangeHeader?: string) {
  return GET(makeRequest(rangeHeader), { params: Promise.resolve({ token }) })
}

describe("GET /files/[token]", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("proxies a successful S3 response, dropping S3-identifying headers", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(jsonResponse({ url: S3_URL }))
      if (url === S3_URL) {
        return Promise.resolve(
          new Response("file-bytes", {
            status: 200,
            headers: {
              "content-type": "application/pdf",
              "content-disposition": 'attachment; filename="doc.pdf"',
              "x-amz-request-id": "should-not-leak",
              server: "AmazonS3",
            },
          }),
        )
      }
      throw new Error(`unexpected fetch to ${url}`)
    })

    const res = await callGet()

    expect(res.status).toBe(200)
    expect(await res.text()).toBe("file-bytes")
    expect(res.headers.get("content-type")).toBe("application/pdf")
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="doc.pdf"')
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("x-amz-request-id")).toBeNull()
    expect(res.headers.get("server")).toBeNull()
  })

  it("never fetches anything other than the URL the resolve endpoint returned (no user-controlled destination)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(jsonResponse({ url: S3_URL }))
      return Promise.resolve(new Response("bytes", { status: 200, headers: { "content-type": "text/plain" } }))
    })

    await callGet()

    const secondCallUrl = fetchMock.mock.calls[1]?.[0]
    expect(secondCallUrl).toBe(S3_URL)
  })

  it("forwards the Range header and passes through a 206", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    let rangeSentToUpstream: string | null = null
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(jsonResponse({ url: S3_URL }))
      rangeSentToUpstream = (init?.headers as Record<string, string> | undefined)?.range ?? null
      return Promise.resolve(
        new Response("partial", {
          status: 206,
          headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-4/26", "accept-ranges": "bytes" },
        }),
      )
    })

    const res = await callGet("some-token", "bytes=0-4")

    expect(rangeSentToUpstream).toBe("bytes=0-4")
    expect(res.status).toBe(206)
    expect(res.headers.get("content-range")).toBe("bytes 0-4/26")
  })

  it("404s without ever calling S3 when the resolve endpoint rejects the token", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(new Response(null, { status: 404 }))
      throw new Error("should never reach S3");
    })

    const res = await callGet("bad-token")

    expect(res.status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("passes through a 410 from the resolve endpoint (deliberately revoked/expired)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }))

    const res = await callGet()

    expect(res.status).toBe(410)
  })

  it("404s when the resolve call itself fails (API down / network error)", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"))

    const res = await callGet()

    expect(res.status).toBe(404)
  })

  it("404s when the S3 fetch itself fails after a successful resolve", async () => {
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(jsonResponse({ url: S3_URL }))
      return Promise.reject(new Error("S3 connection reset"))
    })

    const res = await callGet()

    expect(res.status).toBe(404)
  })

  it("aborts and 404s if the S3 fetch never responds within the timeout", async () => {
    vi.useFakeTimers()
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).startsWith(RESOLVE_URL_PREFIX)) return Promise.resolve(jsonResponse({ url: S3_URL }))
      // Simulates a hung upstream: only ever settles if aborted.
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
      })
    })

    const pending = callGet()
    await vi.advanceTimersByTimeAsync(UPSTREAM_FETCH_TIMEOUT_MS + 100)
    const res = await pending

    expect(res.status).toBe(404)
  })
})
