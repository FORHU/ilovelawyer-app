import { createContext, useContext, useRef, useState, type ReactNode, type RefObject } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@workspace/ui/lib/utils";
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion";

/** The drawer panel's own ref, for descendants that need to keep a floating element (e.g. a
 * Radix Popover) within the panel's narrow bounds instead of the full viewport — see
 * NotificationBell, which renders inside both this drawer and the full-width desktop header and
 * needs to behave differently in each. A ref object (not the resolved element) so consumers read
 * `.current` live when they actually need it (e.g. on popover open) rather than depending on this
 * context to re-render at the right moment — `undefined` outside any drawer. */
const MobileDrawerPanelContext = createContext<RefObject<HTMLDivElement | null> | undefined>(undefined);
export function useMobileDrawerPanel() {
  return useContext(MobileDrawerPanelContext);
}

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
  // `open` toggles on this same persistent instance (the 4 callers always render MobileDrawer,
  // never conditionally) — `mounted` lags one tick behind `open` on close so the slide-out tween
  // has something to animate before the panel actually leaves the DOM.
  const [mounted, setMounted] = useState(open);
  const backdropRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const offscreenX = side === "right" ? "100%" : "-100%";

  useGSAP(
    () => {
      if (open) {
        setMounted(true);
        return;
      }
      if (!mounted) return;
      const panel = panelRef.current;
      const backdrop = backdropRef.current;
      if (reducedMotion || !panel) {
        setMounted(false);
        return;
      }
      gsap.killTweensOf(panel);
      if (backdrop) {
        gsap.killTweensOf(backdrop);
        gsap.to(backdrop, { opacity: 0, duration: 0.15 });
      }
      gsap.to(panel, { x: offscreenX, duration: 0.2, ease: "power2.in", onComplete: () => setMounted(false) });
    },
    { dependencies: [open] },
  );

  // Runs right after `mounted` flips true and the panel/backdrop actually exist to animate.
  useGSAP(
    () => {
      if (!open || reducedMotion) return;
      const panel = panelRef.current;
      const backdrop = backdropRef.current;
      if (backdrop) {
        gsap.killTweensOf(backdrop);
        gsap.from(backdrop, { opacity: 0, duration: 0.15 });
      }
      if (panel) {
        gsap.killTweensOf(panel);
        gsap.from(panel, { x: offscreenX, duration: 0.22, ease: "power2.out" });
      }
    },
    { dependencies: [mounted] },
  );

  if (!mounted) return null;

  return (
    <div
      className={cn(
        breakpoint === "md" ? "md:hidden" : "lg:hidden",
        "fixed inset-0 z-(--z-modal) flex",
        side === "right" && "justify-end"
      )}
    >
      <button ref={backdropRef} type="button" aria-label={closeLabel} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div ref={panelRef} className={cn("relative flex h-full flex-col shadow-xl", panelClassName)}>
        <MobileDrawerPanelContext.Provider value={panelRef}>{children}</MobileDrawerPanelContext.Provider>
      </div>
    </div>
  );
}
