import { headers } from "next/headers"
import type { Jurisdiction } from "./resolve-host"

/**
 * Server Component-only read of the `x-jurisdiction` header proxy.ts already resolved from
 * the hostname for this request. Presentation context only — never the authority for an
 * authenticated organization's jurisdiction. See components/jurisdiction-provider.tsx for how
 * this reaches client components.
 */
export async function getJurisdictionHint(): Promise<Jurisdiction | null> {
  const headersList = await headers()
  const value = headersList.get("x-jurisdiction")
  return value === "PH" || value === "UK" ? value : null
}
