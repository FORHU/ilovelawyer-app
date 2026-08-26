import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveJurisdictionFromHost } from "@/lib/jurisdiction/resolve-host"

// Next.js 16 renamed middleware.ts -> proxy.ts (see node_modules/next/dist/docs/.../proxy.md) —
// this repo had neither file before, so proxy.ts is the correct convention for this version.
//
// This resolves jurisdiction from the request hostname only — it is presentation/routing
// context for unauthenticated pages (signup badge, initial UI), never the authority for an
// authenticated organization's legal jurisdiction (that's Organization.jurisdiction, resolved
// server-side on the API — see app/(protected)/layout.tsx for the mismatch-redirect that keeps
// these two concepts separate). No URL rewrites — every jurisdiction renders the same routes.
export function proxy(request: NextRequest) {
  const jurisdiction = resolveJurisdictionFromHost(request.headers.get("host"))

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-jurisdiction", jurisdiction ?? "")

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Non-httpOnly, presentation-only hint so client components can read the current hostname's
  // jurisdiction without a hydration flash. Never treated as a trust boundary.
  if (jurisdiction) {
    response.cookies.set("jurisdiction-hint", jurisdiction, { httpOnly: false, sameSite: "lax", path: "/" })
  } else {
    response.cookies.delete("jurisdiction-hint")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
