"use client"

import { useEffect, useState, type Ref, type RefObject } from "react"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { placeTip, TIP_WIDTH, type Rect } from "@/lib/tour/placement"
import type { Placement } from "@/lib/tour/steps"
import { useTourT } from "@/lib/tour/use-tour-t"

const PHONE_MAX = 640
// Room kept clear at the bottom of the screen for the control bar, so the step card never
// sits under it.
const CONTROLS_CLEARANCE = 100

export function useViewport() {
  const [viewport, setViewport] = useState({ w: 1440, h: 900 })
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return viewport
}

interface TourTipProps {
  rect: Rect
  placement: Placement
  /** The card's measured height, for placing it — see TourTip's ref. */
  height: number
  /** The tour's name, e.g. "Terminal" or "Calendar". The step count is on the control bar. */
  kicker: string
  title: string
  body: string
  index: number
  total: number
  onSkip: () => void
  onBack: () => void
  onNext: () => void
  nextRef: RefObject<HTMLButtonElement | null>
  ref?: Ref<HTMLDivElement>
}

// Both arrows look the same — one control, two directions — so neither competes for attention.
const arrowButton =
  "inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full border border-foreground/20 text-foreground transition-colors hover:border-foreground hover:bg-foreground/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-foreground/20 disabled:hover:bg-transparent"

/** A step of the step-through tours (page tours and the sample-case tours), in two parts: the
 * card that explains the step, placed beside the spotlight (a sheet on phones), and a control bar
 * that stays put at the bottom centre of the screen — Skip, then ← progress dots →, with ✓ on the
 * last step — so the user never has to look for the buttons. ← and → on the keyboard work too. */
export function TourTip({ rect, placement, height, kicker, title, body, index, total, onSkip, onBack, onNext, nextRef, ref }: TourTipProps) {
  const { t } = useTourT()
  const viewport = useViewport()
  const phone = viewport.w < PHONE_MAX
  const first = index === 0
  const last = index === total - 1

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault()
        onNext()
      } else if (e.key === "ArrowLeft" && !first) {
        e.preventDefault()
        onBack()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [first, onBack, onNext])

  let style: React.CSSProperties
  let shape: string
  if (phone) {
    // A sheet on the edge away from the target: at the top, or just above the control bar.
    const atTop = rect.y + rect.h / 2 > viewport.h * 0.55
    style = atTop ? { top: 0 } : { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${CONTROLS_CLEARANCE}px)` }
    shape = atTop ? "inset-x-0 rounded-b-[20px]" : "inset-x-3 rounded-[20px]"
  } else {
    const { left, top } = placeTip(rect, height, placement, viewport.w, viewport.h - CONTROLS_CLEARANCE)
    style = { left, top, width: TIP_WIDTH }
    shape = "rounded-2xl"
  }

  const nextLabel = last ? t("tip.finish") : t("tip.next")

  return (
    <>
      <div
        ref={ref}
        role="dialog"
        aria-modal="false"
        aria-labelledby="tour-tip-title"
        aria-describedby="tour-tip-body"
        className={`fixed z-[9003] flex flex-col gap-2 border border-border bg-card px-5 py-4.5 text-foreground shadow-2xl transition-[left,top] duration-300 ease-landing motion-reduce:transition-none ${shape}`}
        style={style}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{kicker}</span>
        <span id="tour-tip-title" className="font-['Libre_Caslon_Text'] text-xl font-light leading-tight tracking-[-0.01em]">
          {title}
        </span>
        <span id="tour-tip-body" className="text-[13px] leading-relaxed text-muted-foreground text-pretty">
          {body}
        </span>
      </div>

      <div
        role="group"
        aria-label={t("tip.controls")}
        className="fixed left-1/2 z-[9003] flex max-w-[calc(100vw-24px)] -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card py-2 pl-4 pr-2 text-foreground shadow-2xl sm:gap-2 sm:pl-5"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)" }}
      >
        <button
          type="button"
          onClick={onSkip}
          className="h-11 shrink-0 cursor-pointer whitespace-nowrap rounded-full px-1 text-[11px] font-semibold uppercase tracking-[1.2px] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("tip.skip")}
        </button>
        <span aria-hidden="true" className="mx-1 h-6 w-px shrink-0 bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onBack}
              disabled={first}
              aria-label={t("tip.previous")}
              className={arrowButton}
            >
              <ArrowLeft className="size-[18px]" aria-hidden="true" />
            </button>
          </TooltipTrigger>
          {/* Above the tour's own layers (z 9000+), or it would open underneath them. */}
          <TooltipContent className="z-[9010]">{t("tip.previous")}</TooltipContent>
        </Tooltip>
        {/* Progress as bullets — the current step is a longer pill — with the count for screen
            readers. */}
        <span className="flex min-w-0 items-center gap-1 px-1 sm:gap-1.5 sm:px-1.5" aria-live="polite">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`size-1.5 shrink-0 rounded-full transition-all duration-300 ease-landing motion-reduce:transition-none sm:size-2 ${
                i === index ? "w-4 bg-foreground sm:w-5" : i < index ? "bg-foreground/45" : "bg-foreground/15"
              }`}
            />
          ))}
          <span className="sr-only">{t("tip.progress", { step: index + 1, total })}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              ref={nextRef}
              type="button"
              onClick={onNext}
              aria-label={nextLabel}
              className={arrowButton}
            >
              {last ? <Check className="size-[18px]" aria-hidden="true" /> : <ArrowRight className="size-[18px]" aria-hidden="true" />}
            </button>
          </TooltipTrigger>
          <TooltipContent className="z-[9010]">{nextLabel}</TooltipContent>
        </Tooltip>
      </div>
    </>
  )
}
