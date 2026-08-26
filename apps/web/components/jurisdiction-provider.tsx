"use client"

import * as React from "react"
import type { Jurisdiction } from "@/lib/jurisdiction/resolve-host"

const JurisdictionHintContext = React.createContext<Jurisdiction | null>(null)

/** Exposes the current hostname's resolved jurisdiction (from proxy.ts, via a server-rendered
 * initial value — no client-side flash) to any component. This is presentation/routing context
 * only: signup badges, the jurisdiction switcher, initial UI defaults. It is never the
 * authority for an authenticated organization's jurisdiction — components that need that must
 * read it from the organization record (see lib/organizations/queries.ts), not this hook. */
export function useJurisdictionHint(): Jurisdiction | null {
  return React.useContext(JurisdictionHintContext)
}

export function JurisdictionProvider({
  jurisdiction,
  children,
}: {
  jurisdiction: Jurisdiction | null
  children: React.ReactNode
}) {
  return <JurisdictionHintContext.Provider value={jurisdiction}>{children}</JurisdictionHintContext.Provider>
}
