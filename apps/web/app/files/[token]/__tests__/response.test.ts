import { describe, it, expect } from "vitest"
import { resolveErrorStatus, buildFileResponseInit } from "../response"

describe("resolveErrorStatus", () => {
  it("passes through 410 from the resolve endpoint", () => {
    expect(resolveErrorStatus(410)).toBe(410)
  })

  it("collapses everything else (bad token, 500, API down) to a generic 404", () => {
    expect(resolveErrorStatus(404)).toBe(404)
    expect(resolveErrorStatus(400)).toBe(404)
    expect(resolveErrorStatus(500)).toBe(404)
  })
})

describe("buildFileResponseInit", () => {
  it("passes through a 206 Range response with Content-Range/Accept-Ranges", () => {
    const headers = new Headers({
      "content-type": "audio/mpeg",
      "content-range": "bytes 0-99/200",
      "accept-ranges": "bytes",
      "content-length": "100",
    })

    const init = buildFileResponseInit({ ok: false, status: 206, headers })

    expect(init).not.toBeNull()
    expect(init!.status).toBe(206)
    expect(init!.headers.get("content-range")).toBe("bytes 0-99/200")
    expect(init!.headers.get("accept-ranges")).toBe("bytes")
    expect(init!.headers.get("content-length")).toBe("100")
  })

  it("passes through a full 200 with Content-Disposition for a download", () => {
    const headers = new Headers({
      "content-type": "application/pdf",
      "content-disposition": 'attachment; filename="Affidavit.pdf"',
    })

    const init = buildFileResponseInit({ ok: true, status: 200, headers })

    expect(init!.status).toBe(200)
    expect(init!.headers.get("content-disposition")).toBe('attachment; filename="Affidavit.pdf"')
  })

  it("always sets Cache-Control: private, no-store", () => {
    const init = buildFileResponseInit({ ok: true, status: 200, headers: new Headers() })
    expect(init!.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("drops any header not on the allowlist, e.g. S3/CloudFront-identifying ones", () => {
    const headers = new Headers({
      "content-type": "application/pdf",
      "x-amz-id-2": "leaky-s3-detail",
      "x-amz-request-id": "leaky-s3-detail",
      server: "AmazonS3",
    })

    const init = buildFileResponseInit({ ok: true, status: 200, headers })

    expect(init!.headers.get("x-amz-id-2")).toBeNull()
    expect(init!.headers.get("x-amz-request-id")).toBeNull()
    expect(init!.headers.get("server")).toBeNull()
    expect(init!.headers.get("content-type")).toBe("application/pdf")
  })

  it("returns null (caller 404s) when upstream failed and it wasn't a Range 206", () => {
    const init = buildFileResponseInit({ ok: false, status: 403, headers: new Headers() })
    expect(init).toBeNull()
  })
})
