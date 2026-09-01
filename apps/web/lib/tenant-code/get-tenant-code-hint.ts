import { headers } from "next/headers"
import type { TenantCode } from "./resolve-host"

/**
 * Server Component-only read of the `x-tenant-code` header proxy.ts already resolved from
 * the hostname for this request. Presentation context only — never the authority for an
 * authenticated organization's Tenant. See components/tenant-code-provider.tsx for how
 * this reaches client components.
 */
export async function getTenantCodeHint(): Promise<TenantCode | null> {
  const headersList = await headers()
  const value = headersList.get("x-tenant-code")
  return value === "PH" || value === "UK" ? value : null
}
