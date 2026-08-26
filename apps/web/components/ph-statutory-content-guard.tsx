"use client"

import GlobalHeader from "@/components/global-header"
import { useAuthStore } from "@/lib/store/auth.store"
import { getJurisdictionConfig } from "@/config/jurisdictions"

type ActiveTab = Parameters<typeof GlobalHeader>[0]["activeTab"]

/**
 * These PH statute pages (civil-code, labor-code, constitution, etc.) are hardcoded Philippine
 * legal content with no UK equivalent — rather than fabricate one, a UK organization gets this
 * notice instead. Returns null when the content should render normally (PH org, or no active
 * org yet), so callers do `const guard = usePhStatutoryContentGuard("civil-code"); if (guard)
 * return guard;` right at the top of the page component.
 */
export function usePhStatutoryContentGuard(activeTab: ActiveTab) {
  const jurisdiction = useAuthStore((s) => s.organization?.jurisdiction)
  const config = getJurisdictionConfig(jurisdiction)

  if (config.ui.showPhilippineStatutoryLibrary) return null

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab={activeTab} />
      <main className="max-w-[720px] w-full mx-auto px-6 md:px-[48px] py-24 flex flex-col items-center gap-4 text-center">
        <span className="text-[11px] font-semibold tracking-[1.5px] text-amber-700 dark:text-amber-400 uppercase">Research · Codals</span>
        <h1 className="font-['Libre_Caslon_Text',serif] text-[28px] md:text-[32px] text-foreground">Not available for your jurisdiction</h1>
        <p className="text-muted-foreground text-[15px] max-w-md leading-relaxed">
          This section covers Philippine statutory material and isn&apos;t available for {config.displayName} organizations yet.
        </p>
      </main>
    </div>
  )
}
