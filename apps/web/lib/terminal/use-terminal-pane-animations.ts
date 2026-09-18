import { useRef, type RefObject } from "react"
import gsap from "gsap"
import { Flip } from "gsap/Flip"
import { useGSAP } from "@gsap/react"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"

const PANE_SELECTOR = "[data-flip-id]"
const PANE_TRANSITION = { duration: 0.24, ease: "power2.out" }
type PendingEntry = { panelId: string; sourceRect: DOMRect | null }

export function useTerminalPaneAnimations({
  stageRef,
  layoutKey,
}: {
  stageRef: RefObject<HTMLElement | null>
  layoutKey: unknown
}) {
  const reducedMotion = usePrefersReducedMotion()
  const pendingStateRef = useRef<ReturnType<typeof Flip.getState> | null>(null)
  const pendingEntryRef = useRef<PendingEntry | null>(null)
  const initialAnimatedRef = useRef(false)

  const capturePaneState = () => {
    if (reducedMotion || !stageRef.current) return
    pendingStateRef.current = Flip.getState(stageRef.current.querySelectorAll<HTMLElement>(PANE_SELECTOR))
  }

  useGSAP(
    () => {
      const state = pendingStateRef.current
      pendingStateRef.current = null
      const entry = pendingEntryRef.current
      pendingEntryRef.current = null
      if (reducedMotion) return
      if (!initialAnimatedRef.current) {
        if (!layoutKey) return
        initialAnimatedRef.current = true
        const initialPanes = stageRef.current?.querySelectorAll<HTMLElement>(PANE_SELECTOR)
        if (initialPanes?.length) {
          gsap.from(initialPanes, {
            opacity: 0,
            y: 10,
            duration: 0.24,
            ease: "power2.out",
            stagger: 0.04,
            clearProps: "transform,opacity",
          })
        }
        return
      }
      if (state) {
        Flip.from(state, {
          ...PANE_TRANSITION,
          absolute: true,
          nested: true,
        })
      }
      if (!entry) return
      const element = entry
        ? stageRef.current?.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(entry.panelId)}"]`)
        : null
      if (!element) return
      const targetRect = element.getBoundingClientRect()
      const sourceRect = entry.sourceRect
      const sourceX = sourceRect ? sourceRect.left + sourceRect.width / 2 : targetRect.left + targetRect.width / 2
      const sourceY = sourceRect ? sourceRect.top + sourceRect.height / 2 : targetRect.top + targetRect.height / 2
      gsap.fromTo(
        element,
        {
          opacity: 0,
          scaleX: sourceRect ? sourceRect.width / targetRect.width : 0.92,
          scaleY: sourceRect ? sourceRect.height / targetRect.height : 0.92,
          x: sourceX - (targetRect.left + targetRect.width / 2),
          y: sourceY - (targetRect.top + targetRect.height / 2),
        },
        { opacity: 1, scaleX: 1, scaleY: 1, x: 0, y: 0, ...PANE_TRANSITION },
      )
    },
    { dependencies: [layoutKey, reducedMotion], scope: stageRef },
  )

  const cancelPaneAnimations = () => {
    if (!stageRef.current) return
    gsap.killTweensOf(stageRef.current.querySelectorAll<HTMLElement>(PANE_SELECTOR))
    pendingStateRef.current = null
    pendingEntryRef.current = null
  }

  const animatePaneOut = (panelId: string, targetRect: DOMRect | null = null) => {
    const element = stageRef.current?.querySelector<HTMLElement>(`[data-flip-id="${CSS.escape(panelId)}"]`)
    if (!element || reducedMotion) return
    const sourceRect = element.getBoundingClientRect()
    const clone = element.cloneNode(true) as HTMLElement
    clone.style.position = "fixed"
    clone.style.left = `${sourceRect.left}px`
    clone.style.top = `${sourceRect.top}px`
    clone.style.width = `${sourceRect.width}px`
    clone.style.height = `${sourceRect.height}px`
    clone.style.margin = "0"
    clone.style.pointerEvents = "none"
    clone.style.zIndex = "110"
    clone.style.transformOrigin = "center center"
    document.body.appendChild(clone)

    const targetX = targetRect ? targetRect.left + targetRect.width / 2 : sourceRect.left + sourceRect.width / 2
    const targetY = targetRect ? targetRect.top + targetRect.height / 2 : sourceRect.top + sourceRect.height / 2
    gsap.to(clone, {
      x: targetX - (sourceRect.left + sourceRect.width / 2),
      y: targetY - (sourceRect.top + sourceRect.height / 2),
      scaleX: targetRect ? targetRect.width / sourceRect.width : 0.9,
      scaleY: targetRect ? targetRect.height / sourceRect.height : 0.9,
      opacity: 0,
      ...PANE_TRANSITION,
      onComplete: () => clone.remove(),
    })
  }

  const queuePaneEntry = (panelId: string, sourceRect: DOMRect | null = null) => {
    pendingEntryRef.current = { panelId, sourceRect }
  }

  return { capturePaneState, cancelPaneAnimations, queuePaneEntry, animatePaneOut }
}