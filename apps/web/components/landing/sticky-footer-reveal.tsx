"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const DEFAULT_HEIGHT = 460;

/** The handoff's sticky reveal footer (§8): the footer is revealed by the page scrolling
 * off it, not pushed. `--footer-h` there is measured from the footer's own scrollHeight on
 * mount and on every resize — ours needs the same measurement (rather than the handoff's
 * fixed 460px default) because this footer's real content height varies with the
 * 5-column-to-2-column responsive collapse. Not gated behind prefers-reduced-motion: this
 * is a layout technique, not an animation. */
export function StickyFooterReveal({ children }: { children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    const el = contentRef.current;
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
    <div className="relative mt-auto" style={{ height, clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)" }}>
      <div className="relative" style={{ height: `calc(100vh + ${height}px)`, top: "-100vh" }}>
        <div className="sticky" style={{ height, top: `calc(100vh - ${height}px)` }}>
          <div ref={contentRef}>{children}</div>
        </div>
      </div>
    </div>
  );
}
