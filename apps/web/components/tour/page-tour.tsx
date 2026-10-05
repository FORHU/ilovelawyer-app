"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { firstVisible, SpotlightBackdrop, useSpotlightTarget } from "@/components/tour/spotlight"
import { TourTip } from "@/components/tour/tour-tip"
import type { PageTourMode } from "@/lib/store/tour.store"
import type { PageTour as PageTourDef, PageTourStep } from "@/lib/tour/page-tours"
import { useSaveProductTourMutation } from "@/lib/tour/queries"
import { useTourT } from "@/lib/tour/use-tour-t"

// The page may still be loading its content (e.g. the case list) when the tour opens: wait for
// the set of controls on screen to hold still for SETTLE_POLLS checks in a row, up to SETTLE_MAX_MS.
const SETTLE_POLL_MS = 250
const SETTLE_POLLS = 3
const SETTLE_MAX_MS = 6000

/** A page's tour: steps through its own controls, look-only. Started automatically on the user's
 * first visit ("auto") or from "Tour this page" in Ask the guide ("manual"). The page is marked
 * seen as soon as the tour shows, so it doesn't start on its own again even if the user leaves
 * halfway; finishing or skipping records which. Controls not on screen are left out. */
export function PageTour({ tour, mode, onEnd }: { tour: PageTourDef; mode: PageTourMode; onEnd: () => void }) {
  const { t } = useTourT()
  const { mutate: saveTour } = useSaveProductTourMutation(tour.track)
  const [steps, setSteps] = useState<PageTourStep[] | null>(null)
  const [index, setIndex] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  const ended = useRef(false)
  const step = steps?.[index]
  const { rect, tipRef, tipHeight } = useSpotlightTarget(step?.target ?? null, () => (step ? firstVisible(step.target) : null))

  const finish = useCallback(
    (status: "COMPLETED" | "DISMISSED" | null, message: string | null) => {
      if (ended.current) return
      ended.current = true
      if (status) saveTour({ status, archetype: null, currentStep: null, doneSteps: [] })
      if (message) toast(message)
      onEnd()
    },
    [onEnd, saveTour],
  )

  // Decide the steps once the page has settled.
  useEffect(() => {
    const startedAt = Date.now()
    let last = ""
    let stable = 0
    const id = setInterval(() => {
      const visible = tour.steps.filter((s) => firstVisible(s.target))
      const signature = visible.map((s) => s.target).join(",")
      stable = signature === last ? stable + 1 : 0
      last = signature
      const timedOut = Date.now() - startedAt > SETTLE_MAX_MS
      if ((visible.length > 0 && stable >= SETTLE_POLLS) || timedOut) {
        clearInterval(id)
        setSteps(visible)
      }
    }, SETTLE_POLL_MS)
    return () => clearInterval(id)
  }, [tour.steps])

  // Nothing to show: a first-visit tour stays quiet (and unseen, so it can run once the page
  // has content); one the user asked for says so.
  useEffect(() => {
    if (steps && steps.length === 0) finish(null, mode === "manual" ? t("pageTour.nothing") : null)
  }, [finish, mode, steps, t])

  // Seen: it won't start on its own again.
  useEffect(() => {
    if (steps && steps.length > 0) saveTour({ status: "IN_PROGRESS", archetype: null, currentStep: null, doneSteps: [] })
  }, [saveTour, steps])

  useEffect(() => {
    const id = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(id)
  }, [index, steps])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish("DISMISSED", null)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish])

  if (!steps || !step || !rect) return null
  const last = index === steps.length - 1

  return (
    <>
      <SpotlightBackdrop rect={rect} interactive={false} />
      <TourTip
        ref={tipRef}
        rect={rect}
        placement={step.placement}
        height={tipHeight}
        kicker={t(`pageTour.names.${tour.track}`)}
        title={t(`targets.${step.target}`)}
        body={t(`pageTour.steps.${step.target}`)}
        index={index}
        total={steps.length}
        onSkip={() => finish("DISMISSED", null)}
        onBack={() => setIndex(index - 1)}
        onNext={() => (last ? finish("COMPLETED", t("pageTour.done")) : setIndex(index + 1))}
        nextRef={nextRef}
      />
    </>
  )
}
