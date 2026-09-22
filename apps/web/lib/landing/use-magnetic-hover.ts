"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

const RADIUS = 130;
const MAX_PUSH = 16;

/** Magnetic give-way hover for the feature grid (handoff §D): on hover of any
 * `[data-magnetic-item]` inside `containerRef`, every other item within 130px of its
 * center is pushed away along the vector between centers (linear falloff, max 16px).
 * Disabled on touch (no hover) and under reduced motion. */
export function useMagneticHover(containerRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("[data-magnetic-item]"));
    if (items.length === 0) return;

    const centerOf = (el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };

    const reset = () => {
      for (const item of items) item.style.transform = "";
    };

    const onEnter = (hovered: HTMLElement) => {
      const hoveredCenter = centerOf(hovered);
      for (const item of items) {
        if (item === hovered) continue;
        const c = centerOf(item);
        const dx = c.x - hoveredCenter.x;
        const dy = c.y - hoveredCenter.y;
        const dist = Math.hypot(dx, dy);
        if (dist === 0 || dist >= RADIUS) continue;
        const push = (1 - dist / RADIUS) * MAX_PUSH;
        item.style.transform = `translate(${(dx / dist) * push}px, ${(dy / dist) * push}px)`;
      }
    };

    const listeners: Array<() => void> = [];
    for (const item of items) {
      const enter = () => onEnter(item);
      item.addEventListener("mouseenter", enter);
      item.addEventListener("mouseleave", reset);
      listeners.push(() => {
        item.removeEventListener("mouseenter", enter);
        item.removeEventListener("mouseleave", reset);
      });
      item.style.transition = `transform ${260}ms cubic-bezier(.16,1,.3,1)`;
      item.style.willChange = "transform";
    }

    return () => {
      for (const off of listeners) off();
      reset();
    };
  }, [containerRef, enabled]);
}
