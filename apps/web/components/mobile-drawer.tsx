import type { ReactNode } from "react";
import { cn } from "@workspace/ui/lib/utils";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
  closeLabel: string;
  side: "left" | "right";
  /** The breakpoint at and above which this drawer is hidden (desktop uses a persistent rail/nav
   * instead). All 4 drawers this was extracted from should agree on `lg` — `terminal-settings-
   * sidebar` used `md` on its own, which was a bug, not an intentional difference. */
  breakpoint?: "md" | "lg";
  /** Full override — width/background/border/shadow/padding vary enough per drawer (GlobalHeader's
   * navy `w-[80%] max-w-[300px]` vs the others' card-colored `w-[85vw] max-w-80`) that one shared
   * default isn't worth fighting; this is the common case, override wholesale when it differs. */
  panelClassName?: string;
  children: ReactNode;
}

/**
 * The slide-in-panel-over-a-dimmed-backdrop shape shared by GlobalHeader's nav drawer,
 * ConsultationSidebar's mobile rail, TopicNavigator's mobile panel, and TerminalSettingsSidebar's
 * mobile panel — extracted so all 4 share one implementation instead of four hand-copies that
 * had each drifted slightly (including one real bug: terminal-settings-sidebar tripped at `md`
 * while the other three tripped at `lg`). The backdrop is a real `<button>` (not a `<div
 * onClick>`), so it's keyboard-reachable like everything else in the app.
 */
export function MobileDrawer({
  open,
  onClose,
  closeLabel,
  side,
  breakpoint = "lg",
  panelClassName = "w-[85vw] max-w-80 bg-card py-4",
  children,
}: MobileDrawerProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        breakpoint === "md" ? "md:hidden" : "lg:hidden",
        "fixed inset-0 z-(--z-modal) flex",
        side === "right" && "justify-end"
      )}
    >
      <button type="button" aria-label={closeLabel} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className={cn("relative flex h-full flex-col shadow-xl", panelClassName)}>{children}</div>
    </div>
  );
}
