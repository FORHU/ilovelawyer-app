import type { ComponentProps } from "react";
import GlobalHeader from "@/components/global-header";

type GlobalHeaderProps = ComponentProps<typeof GlobalHeader>;

interface PageShellProps {
  activeTab: GlobalHeaderProps["activeTab"];
  mobileHeaderMerged?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * The `.landing-theme` wrapper + GlobalHeader pairing every page needs — see DESIGN.md.
 * Replaces the hand-copied `<div className="landing-theme ... bg-background text-foreground">`
 * that used to get duplicated (and sometimes dropped, causing the old-navy header bug) per page.
 * Every page respects the light/dark toggle — none of them should force a theme.
 */
export function PageShell({ activeTab, mobileHeaderMerged, className = "", children }: PageShellProps) {
  return (
    <div
      className={`landing-theme min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif] ${className}`}
    >
      <GlobalHeader activeTab={activeTab} mobileHeaderMerged={mobileHeaderMerged} />
      {children}
    </div>
  );
}
