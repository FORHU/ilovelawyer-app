"use client"

import GlobalHeader from "@/components/global-header"
import { useAuthStore } from "@/lib/store/auth.store"
import { getJurisdictionConfig } from "@/config/jurisdictions"
import { isFeatureEnabled } from "@/config/jurisdictions/capabilities"
import type { JurisdictionCapabilities } from "@/config/jurisdictions/types"

type ActiveTab = Parameters<typeof GlobalHeader>[0]["activeTab"]

interface FeatureGuardCopy {
  eyebrow: string
  heading: string
  body: (displayName: string) => string
}

/**
 * General-purpose capability gate: renders a "coming soon" notice for any capability the
 * jurisdiction registry (config/jurisdictions/capabilities.ts) marks "coming-soon" for the
 * caller's org, instead of scattering `jurisdiction === "UK"` checks through page components.
 * Returns null when the feature should render normally (enabled, or no org loaded yet), so
 * callers do `const guard = useJurisdictionFeatureGuard("legalSearch", "library", copy); if
 * (guard) return guard;` at the top of the page component — same convention as
 * usePhStatutoryContentGuard, which stays separate since it gates a specific hardcoded PH
 * statute library, not a general capability.
 */
export function useJurisdictionFeatureGuard(
  feature: keyof JurisdictionCapabilities,
  activeTab: ActiveTab,
  copy: FeatureGuardCopy,
) {
  const jurisdiction = useAuthStore((s) => s.organization?.jurisdiction)
  const config = getJurisdictionConfig(jurisdiction)

  if (isFeatureEnabled(jurisdiction, feature)) return null

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab={activeTab} />
      <main className="max-w-[720px] w-full mx-auto px-6 md:px-[48px] py-24 flex flex-col items-center gap-4 text-center">
        <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">{copy.eyebrow}</span>
        <h1 className="font-['Libre_Caslon_Text',serif] text-[28px] md:text-[32px] text-foreground">{copy.heading}</h1>
        <p className="text-muted-foreground text-[15px] max-w-md leading-relaxed">{copy.body(config.displayName)}</p>
      </main>
    </div>
  )
}
