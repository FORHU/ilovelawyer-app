import type { Placement } from "@/lib/tour/steps"

export const TIP_WIDTH = 300
const TIP_GAP = 14
// The tip never covers the 64px header.
const TIP_MIN_TOP = 76
const EDGE = 12

/** The spotlight's box in viewport pixels, already padded around the target. */
export interface Rect {
  x: number
  y: number
  w: number
  h: number
  radius: number
}

/** Where the tip goes on desktop: the step's preferred side if it fits, else any side that
 * does, else docked to whichever edge has more room — never on top of the highlighted control. */
export function placeTip(r: Rect, tipH: number, preferred: Placement, W: number, H: number) {
  const fits: Record<Placement, boolean> = {
    bottom: r.y + r.h + TIP_GAP + tipH < H - EDGE,
    top: r.y - TIP_GAP - tipH > TIP_MIN_TOP,
    left: r.x - TIP_GAP - TIP_WIDTH > EDGE,
    right: r.x + r.w + TIP_GAP + TIP_WIDTH < W - EDGE,
  }
  const side = fits[preferred] ? preferred : (["bottom", "top", "left", "right"] as const).find((p) => fits[p])

  if (!side) {
    const dockBottom = H - (r.y + r.h) >= r.y - TIP_MIN_TOP
    const left = r.x + r.w / 2 < W / 2 ? W - TIP_WIDTH - EDGE : EDGE
    return { left, top: dockBottom ? H - tipH - EDGE : TIP_MIN_TOP }
  }

  let left: number
  let top: number
  if (side === "bottom" || side === "top") {
    left = r.x + r.w / 2 - TIP_WIDTH / 2
    top = side === "bottom" ? r.y + r.h + TIP_GAP : r.y - TIP_GAP - tipH
  } else {
    top = r.y + r.h / 2 - tipH / 2
    left = side === "left" ? r.x - TIP_GAP - TIP_WIDTH : r.x + r.w + TIP_GAP
  }
  left = Math.max(EDGE, Math.min(W - TIP_WIDTH - EDGE, left))
  top = Math.max(TIP_MIN_TOP, Math.min(H - tipH - EDGE, top))
  return { left, top }
}
