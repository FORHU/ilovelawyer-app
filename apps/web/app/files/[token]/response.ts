// Pure decision logic pulled out of route.ts so it can be unit-tested without a request/response
// harness (this repo's vitest.config.ts is deliberately scoped to pure-function tests only).

/** Maps a GET /api/files/resolve failure onto what the browser sees. 410 (token deliberately
 * revoked/expired, per the API) passes through; everything else — bad token, network error,
 * API down — collapses to a generic 404 so nothing about the failure reason leaks. */
export function resolveErrorStatus(resolveStatus: number): number {
  return resolveStatus === 410 ? 410 : 404
}

// Headers safe to mirror from the upstream S3 response onto ours. Everything else (esp. any
// S3/CloudFront-identifying header, e.g. x-amz-*, Server: AmazonS3) is dropped.
const PASSTHROUGH_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "content-range",
  "accept-ranges",
]

export interface UpstreamLike {
  ok: boolean
  status: number
  headers: Headers
}

/** Builds this route's own status + headers from the upstream S3 fetch, or null when the caller
 * should 404 instead (upstream failed and it wasn't a Range 206). */
export function buildFileResponseInit(upstream: UpstreamLike): { status: number; headers: Headers } | null {
  if (!upstream.ok && upstream.status !== 206) return null

  const headers = new Headers()
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  headers.set("Cache-Control", "private, no-store")

  return { status: upstream.status, headers }
}
