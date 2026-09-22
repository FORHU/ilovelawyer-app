import { useEffect, useState } from "react"

/**
 * Debounces a loading flag so a fetch that resolves in well under a human
 * reaction time never flashes a skeleton for one frame. Only delays the
 * show; clearing `isLoading` hides the skeleton immediately.
 */
export function useDelayedLoading(isLoading: boolean, delayMs = 150): boolean {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isLoading) {
      setShow(false)
      return
    }
    const timer = setTimeout(() => setShow(true), delayMs)
    return () => clearTimeout(timer)
  }, [isLoading, delayMs])

  return isLoading && show
}
