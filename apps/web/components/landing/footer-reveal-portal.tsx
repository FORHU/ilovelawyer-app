"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const DEFAULT_HEIGHT = 460;

/**
 * ScrollSmoother-safe footer reveal. CSS `position: sticky` and a GSAP ScrollTrigger pin
 * both break inside ScrollSmoother's transformed/overflow:hidden wrapper (confirmed via
 * GSAP's own docs and, the hard way, by shipping the sticky version first). This instead
 * follows the pattern GSAP's own community gives for this exact combination ("Pinning a
 * footer using scroll smoother"): no scroll-linked JS at all for the reveal itself.
 *
 * The footer renders `position: fixed` at the viewport's bottom edge, portaled OUTSIDE the
 * ScrollSmoother wrapper (fixed elements must be, same as the navbar) with a z-index below
 * the page's own opaque sections (see scroll-smoother-provider.tsx's z-10 on #smooth-content).
 * A same-height, empty spacer is left in the normal scroll flow at the footer's natural
 * position, inside the smoothed content — it's the only thing reserving scroll room. Once
 * the page has scrolled past every opaque section, that spacer is all that's left on
 * screen, and the always-present fixed footer shows through underneath it — which reads as
 * the footer rising into view.
 */
export function FooterRevealPortal({ children }: { children: ReactNode }) {
  const footerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [portalTarget, setPortalTarget] = useState<Element | null>(null);

  useEffect(() => {
    setPortalTarget(document.getElementById("footer-reveal-portal-target"));
  }, []);

  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const update = () => setHeight(el.scrollHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <>
      {/* Reserves scroll room inside the smoothed content — intentionally empty. Carries the
          id nav links scroll to, since the portaled footer below is `position: fixed` and
          always sits at the same viewport-relative spot, not a meaningful scroll target. */}
      <div id="footer-spacer" aria-hidden style={{ height }} />
      {portalTarget &&
        createPortal(
          <div ref={footerRef} className="fixed inset-x-0 bottom-0 z-0">
            {children}
          </div>,
          portalTarget,
        )}
    </>
  );
}
