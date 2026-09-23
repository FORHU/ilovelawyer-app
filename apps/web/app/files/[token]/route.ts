import { NextRequest } from "next/server"
import { versioned } from "@/lib/api-version"
import { resolveErrorStatus, buildFileResponseInit } from "./response"

// Same env var next.config.ts reads server-side for rewrites() — this route makes the app's
// first *runtime* server-to-server call to the API (rewrites() only wires up build-time proxy
// targets), so there's no existing fetch pattern here to mirror; timeout and error handling
// below are new.
const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "")

const RESOLVE_TIMEOUT_MS = 5_000

// Bounds only the time to get a response (headers) from S3 — cleared as soon as fetch() settles,
// so it never cuts off an in-progress download of a large file. A hung/unavailable upstream is
// the failure mode this guards against, not a slow-but-completing transfer.
export const UPSTREAM_FETCH_TIMEOUT_MS = 10_000

/**
 * Resolves a getProxyFileUrl token (ilovelawyer-api/src/utils/s3.ts) against the API and streams
 * the file back same-origin, so the browser never sees an S3 host, bucket or signature. The
 * token in the path is the only auth — this route is reachable from a plain <a>, <img>, <audio>
 * or <iframe> src, none of which can carry the app's Bearer access token.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  let presignedUrl: string
  try {
    const resolveRes = await fetch(
      `${API_URL}${versioned("/api/files/resolve")}?token=${encodeURIComponent(token)}`,
      { signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) },
    )
    if (!resolveRes.ok) {
      return new Response(null, { status: resolveErrorStatus(resolveRes.status) })
    }
    ;({ url: presignedUrl } = await resolveRes.json())
  } catch (err) {
    console.error("files/[token]: resolve call failed", err)
    return new Response(null, { status: 404 })
  }

  const range = req.headers.get("range")
  const upstreamController = new AbortController()
  const upstreamTimeout = setTimeout(() => upstreamController.abort(), UPSTREAM_FETCH_TIMEOUT_MS)
  let upstream: Response
  try {
    upstream = await fetch(presignedUrl, {
      ...(range ? { headers: { range } } : {}),
      signal: upstreamController.signal,
    })
  } catch (err) {
    console.error("files/[token]: upstream fetch failed", err)
    return new Response(null, { status: 404 })
  } finally {
    clearTimeout(upstreamTimeout)
  }

  const init = buildFileResponseInit(upstream)
  if (!init) return new Response(null, { status: 404 })

  return new Response(upstream.body, init)
}
