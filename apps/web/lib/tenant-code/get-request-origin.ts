import { headers } from "next/headers"
import { protocolForHost } from "./resolve-host"

/**
 * Absolute origin (protocol + host) for the current request, from the `Host` header. Self-
 * referencing only — never translates to the other tenant's host (see `hostForTenantCode` for
 * that). Works unchanged across prod (`ph.ilovelawyer.com`), staging, and every local dev host
 * convention in resolve-host.ts, with no env var required.
 */
export async function getRequestOrigin(): Promise<string> {
  const headersList = await headers()
  const host = headersList.get("host") ?? ""
  return `${protocolForHost(host)}://${host}`
}
