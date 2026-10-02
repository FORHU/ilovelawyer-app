"use client"

import { useEffect, useRef, useState } from "react"
import type { Rect } from "@/lib/tour/placement"

// Padding between a highlighted control and the spotlight's edge.
export const SPOTLIGHT_PAD = 6

/** Turns a control's bounding box into the spotlight's (padded) box. */
export function spotlightRect(el: Element): Rect {
  const r = el.getBoundingClientRect()
  return {
    x: r.left - SPOTLIGHT_PAD,
    y: r.top - SPOTLIGHT_PAD,
    w: r.width + SPOTLIGHT_PAD * 2,
    h: r.height + SPOTLIGHT_PAD * 2,
    radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 8,
  }
}

export function isVisible(el: Element) {
  const r = el.getBoundingClientRect()
  if (r.width < 1 || r.height < 1) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== "hidden" && cs.display !== "none" && parseFloat(cs.opacity || "1") > 0.05
}

/** The first visible element carrying `attr="id"` — a control can render twice (e.g. a desktop
 * and a mobile variant), and only the one on screen should be highlighted. */
export function firstVisible(id: string, attr = "data-tour-id") {
  return Array.from(document.querySelectorAll(`[${attr}="${id}"]`)).find(isVisible) ?? null
}

/** Tracks the element `find` returns, every animation frame, as a spotlight box — so the
 * spotlight follows it through scrolling, resizing and layout changes. Scrolls it into view once
 * per `key`. Also measures the step card (`tipRef`) for placing it. `key` null tracks nothing. */
export function useSpotlightTarget(key: string | null, find: () => Element | null) {
  const [rect, setRect] = useState<Rect | null>(null)
  const [tipHeight, setTipHeight] = useState(190)
  const tipRef = useRef<HTMLDivElement>(null)
  const findRef = useRef(find)
  useEffect(() => {
    findRef.current = find
  })

  useEffect(() => {
    if (key === null) return
    let raf = 0
    let scrolled = false
    const measure = () => {
      const tip = tipRef.current
      if (tip) {
        const h = tip.getBoundingClientRect().height
        setTipHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev))
      }
      const el = findRef.current()
      if (el) {
        if (!scrolled) {
          scrolled = true
          const r = el.getBoundingClientRect()
          if (r.top < 72 || r.bottom > window.innerHeight - 24) el.scrollIntoView({ block: "center" })
        }
        const next = spotlightRect(el)
        setRect((prev) => (rectMoved(prev, next) ? next : prev))
      }
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [key])

  return { rect, tipRef, tipHeight }
}

/** Whether two spotlight boxes differ enough to re-render (sub-pixel jitter is ignored). */
export function rectMoved(a: Rect | null, b: Rect) {
  return !a || Math.abs(a.x - b.x) > 0.5 || Math.abs(a.y - b.y) > 0.5 || Math.abs(a.w - b.w) > 0.5 || Math.abs(a.h - b.h) > 0.5
}

/** The dimmed page with a cut-out around `rect`, shared by every tour. Four click-blockers
 * cover everything outside the cut-out, so the page stays inert; the highlighted control itself
 * still takes clicks unless `interactive` is false (a look-don't-touch walkthrough). The dim is
 * one huge shadow around the cut-out, so it animates with it from step to step. */
export function SpotlightBackdrop({ rect, interactive = true }: { rect: Rect; interactive?: boolean }) {
  const radius = Math.min(rect.radius + SPOTLIGHT_PAD, rect.h / 2 + SPOTLIGHT_PAD)
  return (
    <>
      <div aria-hidden="true" className="fixed inset-x-0 top-0 z-[9000]" style={{ height: Math.max(0, rect.y) }} />
      <div aria-hidden="true" className="fixed inset-x-0 bottom-0 z-[9000]" style={{ top: rect.y + rect.h }} />
      <div aria-hidden="true" className="fixed left-0 z-[9000]" style={{ top: rect.y, height: rect.h, width: Math.max(0, rect.x) }} />
      <div aria-hidden="true" className="fixed right-0 z-[9000]" style={{ top: rect.y, height: rect.h, left: rect.x + rect.w }} />
      {!interactive && <div aria-hidden="true" className="fixed z-[9000]" style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }} />}
      {[false, true].map((ring) => (
        <div
          key={String(ring)}
          aria-hidden="true"
          className={`pointer-events-none fixed transition-[left,top,width,height] duration-300 ease-landing motion-reduce:transition-none ${
            ring ? "z-[9002] border-2 border-foreground" : "z-[9001] shadow-[0_0_0_200vmax_var(--tour-dim)]"
          }`}
          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: radius }}
        />
      ))}
    </>
  )
}
