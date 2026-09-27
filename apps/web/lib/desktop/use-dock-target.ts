import { useSyncExternalStore } from "react"
import { currentDockTarget, isDesktop, onDockTargetChanged, type DockTarget } from "@/lib/desktop"

// One shell subscription shared by every component that asks, started on first use and stopped
// when the last one unmounts — each Terminal pane header reads this, and there can be a dozen.
let target: DockTarget | null = null
const listeners = new Set<() => void>()
let stop: (() => void) | null = null

function publish(next: DockTarget | null) {
  target = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!stop && isDesktop()) {
    let changedSinceStart = false
    const unlisten = onDockTargetChanged((next) => {
      changedSinceStart = true
      publish(next)
    })
    stop = unlisten
    // Only seed from the snapshot if no live event beat it here — that event is newer.
    currentDockTarget().then((initial) => {
      if (stop === unlisten && !changedSinceStart) publish(initial)
    })
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && stop) {
      stop()
      stop = null
      target = null
    }
  }
}

/**
 * The other app's window a panel can be docked beside right now, or null — always null in a
 * browser. See `DockTarget` for how its title must be handled.
 */
export function useDockTarget(): DockTarget | null {
  return useSyncExternalStore(subscribe, () => target, () => null)
}
