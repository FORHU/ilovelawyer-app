import type { ComponentProps } from "react";
import GlobalHeader from "@/components/global-header";

type GlobalHeaderProps = ComponentProps<typeof GlobalHeader>;

interface PageShellProps {
  activeTab: GlobalHeaderProps["activeTab"];
  mobileHeaderMerged?: boolean;
  /** Forces dark mode regardless of the user's theme toggle (Consultation-style full-bleed
   * surfaces). Most pages should leave this unset and respect the toggle (Cases-style). */
  forceDark?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The `.landing-theme` wrapper + GlobalHeader pairing every page needs — see DESIGN.md.
 * Replaces the hand-copied `<div className="landing-theme ... bg-background text-foreground">`
 * that used to get duplicated (and sometimes dropped, causing the old-navy header bug) per page.
 */
export function PageShell({ activeTab, mobileHeaderMerged, forceDark, className = "", children }: PageShellProps) {
  return (
    <div
      className={`landing-theme ${forceDark ? "dark " : ""}min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif] ${className}`}
    >
      <GlobalHeader activeTab={activeTab} mobileHeaderMerged={mobileHeaderMerged} />
      {children}
    </div>
  );
}
