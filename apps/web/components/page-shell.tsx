"use client";

import { useEffect } from "react";
import { useMobileNavStore } from "@/lib/store/mobile-nav.store";

interface PageShellProps {
  /** Hands the mobile masthead over to the page — see GlobalHeader's mobileHeaderMerged. */
  mobileHeaderMerged?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The theme wrapper every page needs — see DESIGN.md.
 * Replaces the hand-copied `<div className="min-h-screen ... bg-background text-foreground">`
 * that used to get duplicated (and sometimes dropped, causing the old-navy header bug) per page.
 * Every page respects the light/dark toggle — none of them should force a theme.
 *
 * GlobalHeader itself is NOT rendered here: it lives in app/(protected)/homepage/layout.tsx so
 * it stays mounted across navigations instead of remounting (and vanishing behind loading.tsx)
 * with every page.
 */
export function PageShell({ mobileHeaderMerged = false, className = "", children }: PageShellProps) {
  const setHeaderMerged = useMobileNavStore((s) => s.setHeaderMerged);

  useEffect(() => {
    if (!mobileHeaderMerged) return;
    setHeaderMerged(true);
    return () => setHeaderMerged(false);
  }, [mobileHeaderMerged, setHeaderMerged]);

  return (
    <div
      className={`min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif] ${className}`}
    >
      {children}
    </div>
  );
}
