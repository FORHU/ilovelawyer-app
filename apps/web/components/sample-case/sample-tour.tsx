"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { SpotlightBackdrop, useSpotlightTarget } from "@/components/tour/spotlight"
import { TourTip } from "@/components/tour/tour-tip"
import { useSaveProductTourMutation } from "@/lib/tour/queries"
import { SAMPLE_TOURS, type SampleTile, type SampleTourTrack, type SampleView } from "@/lib/sample-case/tours"
import { useTourT } from "@/lib/tour/use-tour-t"

/** Runs one sample-case tour (the Workspace's or the Terminal's): moves the sample page to each
 * step's tab and tile, spotlights its target, and saves the user's progress to the tour's own
 * track, so it doesn't start on its own again once they've taken or skipped it. The
 * page underneath stays untouchable until the tour ends — it's a walkthrough, not a sandbox. */
export function SampleTour({
  track,
  view,
  onView,
  onTile,
  onChanges,
  onEnd,
}: {
  track: SampleTourTrack
  view: SampleView
  onView: (view: SampleView) => void
  onTile: (tile: SampleTile) => void
  /** Opens or closes the Terminal's "What changed" panel. */
  onChanges: (open: boolean) => void
  /** Called once, after progress is saved and the closing toast is up. */
  onEnd: () => void
}) {
  const { t } = useTourT()
  const { mutate: saveTour } = useSaveProductTourMutation(track)
  const steps = SAMPLE_TOURS[track]
  const [index, setIndex] = useState(0)
  const nextRef = useRef<HTMLButtonElement>(null)
  // A double click on Finish, or Esc as the button is pressed, must not save, toast and
  // redirect twice.
  const ended = useRef(false)
  const step = steps[index]!
  const key = `sampleCase.tour.${track}`
  const { rect, tipRef, tipHeight } = useSpotlightTarget(step.target, () =>
    document.querySelector(`[data-sample-tour="${step.target}"]`),
  )

  const save = useCallback(
    (status: "IN_PROGRESS" | "COMPLETED" | "DISMISSED", at: number) =>
      saveTour({
        status,
        archetype: null,
        currentStep: status === "IN_PROGRESS" ? steps[at]!.id : null,
        doneSteps: steps.slice(0, at).map((s) => s.id),
      }),
    [saveTour, steps],
  )

  const finish = useCallback(
    (completed: boolean) => {
      if (ended.current) return
      ended.current = true
      save(completed ? "COMPLETED" : "DISMISSED", completed ? steps.length : index)
      toast(completed ? t(`${key}.done`) : t("sampleCase.tour.skipped"))
      onEnd()
    },
    [index, key, onEnd, save, steps.length, t],
  )

  // Show the step's tab, tile and "What changed" panel, and save where the user is.
  useEffect(() => {
    if (step.view !== view) onView(step.view)
    if (step.tile) onTile(step.tile)
    onChanges(!!step.changes)
    save("IN_PROGRESS", index)
    // Only when the step changes — not on every re-render of the page around it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  useEffect(() => {
    const id = setTimeout(() => nextRef.current?.focus({ preventScroll: true }), 380)
    return () => clearTimeout(id)
  }, [index])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [finish])

  if (!rect) return null

  return (
    <>
      <SpotlightBackdrop rect={rect} interactive={false} />
      <TourTip
        ref={tipRef}
        rect={rect}
        placement={step.placement}
        height={tipHeight}
        kicker={t(`${key}.name`)}
        title={t(`${key}.steps.${step.id}.title`)}
        body={t(`${key}.steps.${step.id}.body`)}
        index={index}
        total={steps.length}
        onSkip={() => finish(false)}
        onBack={() => setIndex(index - 1)}
        onNext={() => (index === steps.length - 1 ? finish(true) : setIndex(index + 1))}
        nextRef={nextRef}
      />
    </>
  )
}
