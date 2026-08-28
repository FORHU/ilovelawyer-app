"use client"

import * as React from "react"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

const TenantCodeHintContext = React.createContext<TenantCode | null>(null)

/** Exposes the current hostname's resolved Tenant code (from proxy.ts, via a server-rendered
 * initial value — no client-side flash) to any component. This is presentation/routing context
 * only: signup badges, the tenant switcher, initial UI defaults. It is never the authority for
 * an authenticated organization's Tenant — components that need that must read it from the
 * organization record (see lib/organizations/queries.ts), not this hook. */
export function useTenantCodeHint(): TenantCode | null {
  return React.useContext(TenantCodeHintContext)
}

export function TenantCodeProvider({
  tenantCode,
  children,
}: {
  tenantCode: TenantCode | null
  children: React.ReactNode
}) {
  return <TenantCodeHintContext.Provider value={tenantCode}>{children}</TenantCodeHintContext.Provider>
}
