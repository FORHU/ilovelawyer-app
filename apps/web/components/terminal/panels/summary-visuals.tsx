import { useEffect, useState } from "react"
import { cn } from "@workspace/ui/lib/utils"
import type { ConfidenceLevel, DamageCategory, OutlookBand } from "@/lib/terminal/types"
import { rangePercent, ringSegments } from "@/lib/terminal/damages-format"

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

// ── Damages & Remedies ─────────────────────────────────────────────────────────────────────

// One hue per damage head, from the shared severity tokens rather than new colours (DESIGN.md):
// the dot in each row and the arc in the ring use the same pair, so a head reads as one colour.
export const DAMAGE_TONE: Record<DamageCategory, { text: string; bg: string }> = {
  ACTUAL: { text: "text-ok", bg: "bg-ok" },
  MORAL: { text: "text-riskmed", bg: "bg-riskmed" },
  EXEMPLARY: { text: "text-warn", bg: "bg-warn" },
  ATTORNEYS_FEES: { text: "text-muted-foreground", bg: "bg-muted-foreground" },
  OTHER: { text: "text-danger", bg: "bg-danger" },
}

// Donut of the case's damage heads, each arc sized by its share of the total. Arcs are dashes on
// one circle (pathLength=1, so lengths are plain fractions); they sweep in from nothing on mount.
// The centre is HTML over the SVG so the display face renders like the rest of the app's type.
export function DamagesRing({
  heads,
  label,
  eyebrow,
  total,
  caption,
  dimmed,
  className,
}: {
  heads: { id: string; category: DamageCategory; share: number }[]
  /** Accessible summary, e.g. "Total claim ₱918,600: Actual 53%, …". */
  label: string
  eyebrow: string
  total: string
  caption: string
  dimmed?: boolean
  className?: string
}) {
  const segments = ringSegments(heads)
  const categoryOf = new Map(heads.map((h) => [h.id, h.category]))
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div role="img" aria-label={label} className={cn("relative mx-auto aspect-square w-44 max-w-full", className)}>
      <svg viewBox="0 0 200 200" aria-hidden="true" className="h-full w-full -rotate-90">
        {/* The empty track — also the whole ring when there are no heads yet. Not text-muted: in dark
            mode --muted is the same colour as the card behind it, so the circle would vanish. */}
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="16" className="text-foreground/10" />
        {segments.map((s) => (
          <circle
            key={s.id}
            cx="100"
            cy="100"
            r="80"
            fill="none"
            stroke="currentColor"
            strokeWidth="16"
            pathLength={1}
            strokeDasharray={ready ? `${s.length} ${1 - s.length}` : "0 1"}
            strokeDashoffset={-s.offset}
            className={cn(
              DAMAGE_TONE[categoryOf.get(s.id)!].text,
              "transition-[stroke-dasharray] duration-700 ease-out motion-reduce:transition-none",
            )}
          />
        ))}
      </svg>
      <div
        className={cn(
          "absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center transition-opacity",
          dimmed && "opacity-50",
        )}
      >
        <span className="text-[9px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">{eyebrow}</span>
        <span className="font-['Libre_Caslon_Text'] text-[26px] leading-none font-normal tracking-[-0.02em] text-foreground tabular-nums">
          {total}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{caption}</span>
      </div>
    </div>
  )
}

// Low–high exposure band on a 0 → scaleMax track, with a tick at the modeled total. One scale
// places the band, the tick and every label, so they can't disagree.
export function ExposureRange({
  low,
  modeled,
  high,
  scaleMax,
  format,
  labels,
}: {
  low: number
  modeled: number
  high: number
  scaleMax: number
  format: (value: number) => string
  labels: { title: string; low: string; modeled: string; high: string; unset: string }
}) {
  const unset = low === modeled && high === modeled
  const left = rangePercent(low, scaleMax)
  const right = rangePercent(high, scaleMax)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">{labels.title}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {format(0)} – {format(scaleMax)}
        </span>
      </div>
      {unset ? (
        <p className="text-[11px] text-muted-foreground">{labels.unset}</p>
      ) : (
        <>
          <div className="relative h-2.5 rounded-full bg-muted" aria-hidden="true">
            <div
              className="absolute inset-y-0 rounded-full border border-ok/50 bg-ok/20"
              style={{ left: `${left}%`, width: `${Math.max(right - left, 0.5)}%` }}
            />
            <div
              className="absolute -inset-y-1 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
              style={{ left: `${rangePercent(modeled, scaleMax)}%` }}
            />
          </div>
          <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[10px] uppercase">
            <span className="text-muted-foreground">
              {labels.low} {format(low)}
            </span>
            <span className="font-medium text-foreground">
              {labels.modeled} {format(modeled)}
            </span>
            <span className="text-muted-foreground">
              {labels.high} {format(high)}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
