import { useEffect, useState } from "react"

/** Milliseconds left until `until` (epoch ms), ticking once a second; stops at 0. */
export function useCountdown(until: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return Math.max(0, until - now)
}

export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
