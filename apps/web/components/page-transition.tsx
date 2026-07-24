"use client"

import { usePathname } from "next/navigation"

// Keying on pathname forces React to remount this div on every route change,
// which replays the CSS entrance animation below — Next's App Router otherwise
// swaps page content in place with no transition of its own. motion-safe:
// respects prefers-reduced-motion instead of a manual media query.
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div
      key={pathname}
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300 motion-safe:ease-out"
    >
      {children}
    </div>
  )
}
