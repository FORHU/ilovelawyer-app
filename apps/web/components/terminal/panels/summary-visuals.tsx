import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { ConfidenceLevel, OutlookBand } from "@/lib/terminal/types"

const BANDS: OutlookBand[] = ["UNFAVORABLE", "LEANS_UNFAVORABLE", "UNCERTAIN", "LEANS_FAVORABLE", "FAVORABLE"]

// Text colour for a band name; the semantic severity tokens keep both themes correct.
export const BAND_TONE: Record<OutlookBand, string> = {
  UNFAVORABLE: "text-danger",
  LEANS_UNFAVORABLE: "text-riskmed",
  UNCERTAIN: "text-warn",
  LEANS_FAVORABLE: "text-ok",
  FAVORABLE: "text-ok",
}
// Same hues as the text tones, with the leaning-favorable arc dimmed so the two greens stay distinct.
const ARC_TONE: Record<OutlookBand, string> = { ...BAND_TONE, LEANS_FAVORABLE: "text-ok/60" }

const SEG = 36
const GAP = 3
const point = (angle: number, r: number) => [
  100 + r * Math.cos((angle * Math.PI) / 180),
  100 - r * Math.sin((angle * Math.PI) / 180),
]
function arc(from: number, to: number, r: number) {
  const [x0, y0] = point(from, r)
  const [x1, y1] = point(to, r)
  return `M${x0!.toFixed(2)} ${y0!.toFixed(2)}A${r} ${r} 0 0 1 ${x1!.toFixed(2)} ${y1!.toFixed(2)}`
}

// Badge tone for a band; the pill is outlined in the same hue.
export const BAND_BADGE: Record<OutlookBand, "danger" | "warning" | "caution" | "success"> = {
  UNFAVORABLE: "danger",
  LEANS_UNFAVORABLE: "warning",
  UNCERTAIN: "caution",
  LEANS_FAVORABLE: "success",
  FAVORABLE: "success",
}

// Five-band gauge, no number: every arc stays lit and the needle rests on the middle of the active band.
export function OutlookGauge({ band, label, className }: { band: OutlookBand; label: string; className?: string }) {
  const index = BANDS.indexOf(band)
  // Needle rotation from straight up: -90deg is the far left, +90deg the far right.
  const target = (index + 0.5) * SEG - 90
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  return (
    <svg viewBox="0 0 200 110" role="img" aria-label={label} className={cn("h-auto w-40", className)}>
      {BANDS.map((b, i) => (
        <path
          key={b}
          d={arc(180 - i * SEG - GAP / 2, 180 - (i + 1) * SEG + GAP / 2, 80)}
          stroke="currentColor"
          strokeWidth="12"
          fill="none"
          className={ARC_TONE[b]}
        />
      ))}
      <g
        style={{ transform: `rotate(${ready ? target : -90}deg)`, transformOrigin: "100px 100px" }}
        className="text-foreground transition-transform duration-700 ease-out motion-reduce:transition-none"
      >
        <line x1="100" y1="100" x2="100" y2="38" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        <circle cx="100" cy="100" r="6" fill="currentColor" />
      </g>
    </svg>
  )
}

// Tiny trend line with the latest value marked; colour comes from the caller via text-*.
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null
  const W = 64
  const H = 20
  const P = 2
  const min = Math.min(...points)
  const span = Math.max(...points) - min || 1
  const xy = points.map((v, i) => [P + (i * (W - 2 * P)) / (points.length - 1), H - P - ((v - min) / span) * (H - 2 * P)])
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x!.toFixed(1)} ${y!.toFixed(1)}`).join("")
  const [lx, ly] = xy[xy.length - 1]!
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" fill="none" className={cn("h-5 w-16 shrink-0", className)}>
      <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx} cy={ly} r="2" fill="currentColor" />
    </svg>
  )
}

const LEVEL: Record<ConfidenceLevel, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 }

// Three bars instead of a percentage: confidence is a level, not a measurement.
export function ConfidenceMeter({ level, label }: { level: ConfidenceLevel; label: string }) {
  return (
    <span role="img" aria-label={label} title={label} className="inline-flex shrink-0 items-end gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={cn("w-1 rounded-[1px]", n <= LEVEL[level] ? "bg-foreground" : "bg-border")}
          style={{ height: 4 + n * 3 }}
        />
      ))}
    </span>
  )
}
