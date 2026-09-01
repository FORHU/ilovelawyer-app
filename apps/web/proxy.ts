import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { resolveTenantCodeFromHost } from "@/lib/tenant-code/resolve-host"

// Next.js 16 renamed middleware.ts -> proxy.ts (see node_modules/next/dist/docs/.../proxy.md) —
// this repo had neither file before, so proxy.ts is the correct convention for this version.
//
// This resolves the Tenant code from the request hostname only — it is presentation/routing
// context for unauthenticated pages (signup badge, initial UI), never the authority for an
// authenticated organization's Tenant (that's Organization.tenantId, resolved server-side on
// the API — see app/(protected)/layout.tsx for the mismatch-redirect that keeps these two
// concepts separate). No URL rewrites — every tenant renders the same routes.
export function proxy(request: NextRequest) {
  const tenantCode = resolveTenantCodeFromHost(request.headers.get("host"))

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-tenant-code", tenantCode ?? "")

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // Non-httpOnly, presentation-only hint so client components can read the current hostname's
  // Tenant code without a hydration flash. Never treated as a trust boundary.
  if (tenantCode) {
    response.cookies.set("tenant-code-hint", tenantCode, { httpOnly: false, sameSite: "lax", path: "/" })
  } else {
    response.cookies.delete("tenant-code-hint")
  }

  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
