"use client"

import { useSelectedLayoutSegments } from "next/navigation"
import GlobalHeader, { ACTIVE_TABS, type ActiveTab } from "@/components/global-header"
import { PageTransition } from "@/components/page-transition"

// Routes whose first segment doesn't match their nav tab by name.
const TAB_ALIASES: Record<string, ActiveTab> = {
  "sample-case": "case-portfolio",
}

function toActiveTab(segment: string | undefined): ActiveTab | undefined {
  if (!segment) return "consultation"
  if (segment in TAB_ALIASES) return TAB_ALIASES[segment]
  return (ACTIVE_TABS as readonly string[]).includes(segment) ? (segment as ActiveTab) : undefined
}

// Layouts stay mounted across navigations within their segment, and a child loading.tsx only
// replaces what's below them — so the header lives here, once, rather than inside every page,
// where each nav click unmounted it and loading.tsx's skeleton briefly showed no header at all.
// Only the page content below it animates in (PageTransition), not the header.
export default function HomepageLayout({ children }: { children: React.ReactNode }) {
  const segments = useSelectedLayoutSegments()

  // The Terminal's pop-out window for a secondary screen and its Document Viewer tab are
  // deliberately chrome-less — see terminal/[caseId]/canvas/[screenIndex]/page.tsx and
  // terminal/[caseId]/document/page.tsx.
  if (segments[0] === "terminal" && (segments[2] === "canvas" || segments[2] === "document")) return children

  return (
    <>
      <GlobalHeader activeTab={toActiveTab(segments[0])} />
      <PageTransition>{children}</PageTransition>
    </>
  )
}
