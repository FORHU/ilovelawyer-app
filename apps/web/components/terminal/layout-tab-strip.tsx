"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react"

interface LayoutTabStripProps {
  tabs: { id: string; name: string }[]
  activeId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  labels: { close: string; newLayout: string; scrollLeft: string; scrollRight: string }
}

const SCROLL_STEP_PX = 240
const EDGE_PADDING_PX = 8

// The Terminal bar's layout tabs. With many layouts the row used to grow a native horizontal
// scrollbar; this hides it and instead shows ‹ › buttons only while the tabs actually overflow,
// scrolls with the mouse wheel, keeps the active tab in view, and pins "New layout" outside the
// scroller so it's always reachable.
export default function LayoutTabStrip({ tabs, activeId, onSelect, onClose, onNew, labels }: LayoutTabStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState({ overflowing: false, atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const overflowing = el.scrollWidth > el.clientWidth + 1
    setOverflow((prev) => {
      const next = {
        overflowing,
        atStart: el.scrollLeft <= 1,
        atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
      }
      return prev.overflowing === next.overflowing && prev.atStart === next.atStart && prev.atEnd === next.atEnd ? prev : next
    })
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    // Tabs added/removed change scrollWidth without resizing the scroller's own box.
    for (const child of Array.from(el.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [measure, tabs])

  // Bring the selected tab fully into view when it changes (new layout created, one closed,
  // or the selection restored on load) — otherwise it can sit off-screen behind the overflow.
  useEffect(() => {
    const scroller = scrollerRef.current
    const tab = scroller?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeId)}"]`)
    if (!scroller || !tab) return
    if (tab.offsetLeft < scroller.scrollLeft) {
      scroller.scrollTo({ left: tab.offsetLeft - EDGE_PADDING_PX, behavior: "smooth" })
    } else if (tab.offsetLeft + tab.offsetWidth > scroller.scrollLeft + scroller.clientWidth) {
      scroller.scrollTo({ left: tab.offsetLeft + tab.offsetWidth - scroller.clientWidth + EDGE_PADDING_PX, behavior: "smooth" })
    }
  }, [activeId, tabs.length])

  const scrollBy = (direction: -1 | 1) => scrollerRef.current?.scrollBy({ left: direction * SCROLL_STEP_PX, behavior: "smooth" })

  const arrowClass =
    "flex h-6 w-6 shrink-0 items-center justify-center self-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-30 dark:hover:bg-overlay-hover"

  return (
    <div className="flex min-w-0 flex-1 items-stretch gap-2">
      {overflow.overflowing && (
        <button type="button" onClick={() => scrollBy(-1)} disabled={overflow.atStart} aria-label={labels.scrollLeft} className={arrowClass}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <div
        ref={scrollerRef}
        onScroll={measure}
        onWheel={(e) => {
          // A plain mouse wheel only reports deltaY; map it to horizontal so the strip is
          // scrollable without the (now hidden) scrollbar. Trackpads already send deltaX.
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && scrollerRef.current) scrollerRef.current.scrollLeft += e.deltaY
        }}
        className="relative flex min-w-0 items-stretch gap-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId
          return (
            <span key={tab.id} data-tab-id={tab.id} className="group/tab flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                className={`whitespace-nowrap border-b-2 py-1 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors ${
                  active ? "border-brand-gold text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.name}
              </button>
              <button
                type="button"
                onClick={() => onClose(tab.id)}
                aria-label={labels.close}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 dark:hover:bg-overlay-hover"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          )
        })}
      </div>
      {overflow.overflowing && (
        <button type="button" onClick={() => scrollBy(1)} disabled={overflow.atEnd} aria-label={labels.scrollRight} className={arrowClass}>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={onNew}
        className="flex shrink-0 items-center gap-1.5 self-center whitespace-nowrap text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-3 w-3" aria-hidden="true" />
        {labels.newLayout}
      </button>
    </div>
  )
}
