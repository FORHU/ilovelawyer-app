"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "sonner"
import { X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { useTourStore } from "@/lib/store/tour.store"
import { routeMatches, TOUR_TARGETS } from "@/lib/tour/steps"
import { pageGuideFor } from "@/lib/tour/page-tours"
import { placeTip, TIP_WIDTH, type Rect } from "@/lib/tour/placement"
import { useIsFirstVisit } from "@/lib/tour/use-first-visit"
import { useTourT } from "@/lib/tour/use-tour-t"
import { GuideDrawer } from "@/components/tour/guide-drawer"
import { PageTour } from "@/components/tour/page-tour"
import { firstVisible, rectMoved, spotlightRect, SpotlightBackdrop } from "@/components/tour/spotlight"
import { useViewport } from "@/components/tour/tour-tip"

const PHONE_MAX = 640
// How long a control the guide points at may be missing before the guide gives up.
const MISSING_TARGET_MS = 1600

/** Mounted once for every signed-in page: starts a page's tour on the user's first visit to it,
 * runs "Tour this page" from Ask the guide, and shows the guide itself — its drawer, the control
 * it's pointing at, and the pill that brings it back. (A case's Workspace and Terminal tours run
 * on the sample case instead — see SampleTourAutoStart.) */
export function TourLayer() {
  const { t } = useTourT()
  const pathname = usePathname()
  const viewport = useViewport()
  const guideOpen = useTourStore((s) => s.guideOpen)
  const setGuideOpen = useTourStore((s) => s.setGuideOpen)
  const guideSpot = useTourStore((s) => s.guideSpot)
  const setGuideSpot = useTourStore((s) => s.setGuideSpot)
  const guideMinimized = useTourStore((s) => s.guideMinimized)
  const setGuideMinimized = useTourStore((s) => s.setGuideMinimized)
  const pageTour = useTourStore((s) => s.pageTour)
  const setPageTour = useTourStore((s) => s.setPageTour)
  const lastQuestion = useTourStore((s) => [...s.messages].reverse().find((m) => m.role === "user")?.text ?? "")

  const pageGuide = pageGuideFor(pathname)
  const pageTourDef = pageGuide?.kind === "page" ? pageGuide : null
  const firstVisit = useIsFirstVisit(pageTourDef?.track ?? null)
  // A first-visit tour gets one try per page per tab: if the page had nothing to show, it stays
  // unseen (and runs on a later visit) rather than retrying in a loop.
  const autoTried = useRef(new Set<string>())

  const [rect, setRect] = useState<Rect | null>(null)
  const [resolved, setResolved] = useState<string | null>(null)
  const [tipH, setTipH] = useState(150)
  const tipRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const missSince = useRef<number | null>(null)
  const scrolledFor = useRef<string | null>(null)

  // A page tour belongs to the page it was started on.
  useEffect(() => {
    setPageTour(null)
  }, [pathname, setPageTour])

  // First visit: start this page's tour.
  useEffect(() => {
    if (!pageTourDef || !firstVisit || pageTour || guideOpen || guideSpot) return
    if (autoTried.current.has(pageTourDef.track)) return
    autoTried.current.add(pageTourDef.track)
    setPageTour("auto")
  }, [firstVisit, guideOpen, guideSpot, pageTour, pageTourDef, setPageTour])

  const restoreGuide = useCallback(() => {
    setGuideSpot(null)
    setGuideMinimized(false)
    setGuideOpen(true)
  }, [setGuideMinimized, setGuideOpen, setGuideSpot])

  // Esc backs out one level: the guide's highlight, then the guide. (Page and sample tours handle
  // their own Esc.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (guideSpot) restoreGuide()
      else if (guideOpen) setGuideOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [guideOpen, guideSpot, restoreGuide, setGuideOpen])

  // Track the control the guide is pointing at, every frame. It may be a header control hidden
  // behind the menu on phones — then the menu button (its fallback) stands in.
  useEffect(() => {
    if (!guideSpot || !routeMatches(guideSpot.route, pathname)) {
      missSince.current = null
      return
    }
    const target = TOUR_TARGETS[guideSpot.target]
    const ids = [guideSpot.target, target.alt, target.fallback].filter((x): x is string => !!x)
    let raf = 0

    const measure = () => {
      const tip = tipRef.current
      if (tip) {
        const h = tip.getBoundingClientRect().height
        setTipH((prev) => (Math.abs(prev - h) > 1 ? h : prev))
      }
      let el: Element | null = null
      let id: string | null = null
      for (const x of ids) {
        el = firstVisible(x)
        if (el) {
          id = x
          break
        }
      }
      if (!el) {
        missSince.current ??= Date.now()
        if (Date.now() - missSince.current > MISSING_TARGET_MS) {
          missSince.current = null
          restoreGuide()
          toast.error(t("toasts.targetMissing"))
          return
        }
        raf = requestAnimationFrame(measure)
        return
      }
      missSince.current = null
      if (scrolledFor.current !== guideSpot.target) {
        scrolledFor.current = guideSpot.target
        const r0 = el.getBoundingClientRect()
        if (r0.top < 72 || r0.bottom > window.innerHeight - 24) el.scrollIntoView({ block: "center" })
      }
      const next = spotlightRect(el)
      setRect((prev) => (rectMoved(prev, next) ? next : prev))
      setResolved(id)
      raf = requestAnimationFrame(measure)
    }
    raf = requestAnimationFrame(measure)
    return () => cancelAnimationFrame(raf)
  }, [guideSpot, pathname, restoreGuide, t])

  const hasRect = rect !== null
  useEffect(() => {
    if (!guideSpot || !hasRect) return
    const id = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(id)
  }, [guideSpot, hasRect])

  // The terminal's pop-out canvas windows render a single pane — no guide there.
  if (pathname.includes("/canvas/")) return null

  const phone = viewport.w < PHONE_MAX
  const spotShown = !!guideSpot && !!rect && !!resolved && routeMatches(guideSpot.route, pathname)

  let tipStyle: React.CSSProperties = {}
  let tipShape = "rounded-2xl"
  if (spotShown && rect) {
    if (phone) {
      const atTop = rect.y + rect.h / 2 > viewport.h * 0.55
      tipStyle = atTop ? { top: 0 } : { bottom: 0 }
      tipShape = atTop ? "inset-x-0 rounded-b-[20px]" : "inset-x-0 rounded-t-[20px]"
    } else {
      const { left, top } = placeTip(rect, tipH, "bottom", viewport.w, viewport.h)
      tipStyle = { left, top, width: TIP_WIDTH }
    }
  }

  const label = "text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground"

  return (
    <>
      {pageTour && pageTourDef && <PageTour key={pageTourDef.track} tour={pageTourDef} mode={pageTour} onEnd={() => setPageTour(null)} />}

      {spotShown && rect && guideSpot && (
        <>
          <SpotlightBackdrop rect={rect} />
          <div
            ref={tipRef}
            role="dialog"
            aria-modal="false"
            aria-labelledby="guide-tip-title"
            aria-describedby="guide-tip-body"
            className={`fixed z-[9003] flex flex-col gap-2 border border-border bg-card px-5 py-4.5 text-foreground shadow-2xl transition-[left,top] duration-300 ease-landing motion-reduce:transition-none ${tipShape}`}
            style={tipStyle}
          >
            <span className={label}>{t("tip.guideKicker")}</span>
            <span id="guide-tip-title" className="font-['Libre_Caslon_Text'] text-xl font-light leading-tight tracking-[-0.01em]">
              {guideSpot.title}
            </span>
            <span id="guide-tip-body" className="text-[13px] leading-relaxed text-muted-foreground text-pretty">
              {guideSpot.body}
            </span>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={restoreGuide}
                className={`${label} h-8 shrink-0 cursor-pointer whitespace-nowrap rounded-full transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
              >
                {t("tip.backToGuide")}
              </button>
              <span className="flex-1" />
              <Button ref={nextRef} variant="accent" className="h-8 shrink-0 px-4 text-[10px] tracking-[1px]" onClick={() => setGuideSpot(null)}>
                {t("tip.gotIt")}
              </Button>
            </div>
          </div>
        </>
      )}

      {guideMinimized && !guideOpen && !guideSpot && !pageTour && lastQuestion && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-[8995] flex max-w-[min(360px,calc(100vw-40px))] items-center gap-2 rounded-full border border-border bg-card py-1.5 pl-3.5 pr-1.5 text-foreground shadow-2xl"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px]">{lastQuestion}</span>
          <button
            type="button"
            onClick={restoreGuide}
            className="h-[30px] shrink-0 cursor-pointer rounded-full border border-foreground px-3.5 text-[10px] font-semibold uppercase tracking-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("guide.minimizedOpen")}
          </button>
          <button
            type="button"
            onClick={() => setGuideMinimized(false)}
            aria-label={t("guide.dismiss")}
            title={t("guide.dismiss")}
            className="inline-flex size-[30px] shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="size-3" aria-hidden="true" />
          </button>
        </div>
      )}

      {guideOpen && <GuideDrawer phone={phone} />}
    </>
  )
}
