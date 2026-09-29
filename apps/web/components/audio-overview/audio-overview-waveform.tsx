"use client"
import { useEffect, useRef } from "react"
import WaveSurfer from "wavesurfer.js"

/** A vertical CanvasGradient (top → bottom) — reusable across any canvas context per spec, so a
 * scratch context is fine for building the object wavesurfer later fills its own canvas with. */
function verticalGradient(height: number, stops: [number, string][]): CanvasGradient {
  const ctx = document.createElement("canvas").getContext("2d")!
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  for (const [offset, color] of stops) gradient.addColorStop(offset, color)
  return gradient
}

export type AudioOverviewWaveformScheme = "amber" | "emerald"

/** Two color schemes so History and Current read as different views at a glance rather than
 * identical chrome — teal/orange for History, slate/green-cyan for Current (Studio + terminal
 * panel). Each pairs a cool, muted "unplayed" against a vivid "played" (a literal RGB invert of
 * a pale gold comes out a muddy dark purple with poor contrast, so these are designed pairs, not
 * computed negatives) rather than two shades of one color, which read as a single solid block. */
const SCHEMES: Record<
  AudioOverviewWaveformScheme,
  {
    wave: [number, string][]
    progress: [number, string][]
    panelWash: string
    panelGlow: string
  }
> = {
  amber: {
    wave: [
      [0, "#5eead4"],
      [1, "#0e7490"],
    ],
    progress: [
      [0, "#fef08a"],
      [0.5, "#fb923c"],
      [1, "#ea580c"],
    ],
    panelWash: "linear-gradient(180deg, rgba(154,52,18,0.35), rgba(67,20,7,0.55))",
    panelGlow: "radial-gradient(ellipse 95% 160% at 50% 50%, rgba(251,146,60,0.35), transparent 75%)",
  },
  emerald: {
    // Darker/flatter than the first pass — a lighter slate here read as blurry rather than just
    // dim, especially once the shape's own drop-shadow (removed below) piled softness on top.
    wave: [
      [0, "#475569"],
      [1, "#0f172a"],
    ],
    progress: [
      [0, "#bbf7d0"],
      [0.5, "#34d399"],
      [1, "#0891b2"],
    ],
    panelWash: "linear-gradient(180deg, rgba(6,78,59,0.35), rgba(4,47,46,0.55))",
    panelGlow: "radial-gradient(ellipse 95% 160% at 50% 50%, rgba(45,212,191,0.35), transparent 75%)",
  },
}

/**
 * A DAW-style waveform rendered by wavesurfer.js — decodes `url` to draw the shape, but drives
 * playback through the SAME `<audio>` element the rest of the player already controls (play/pause
 * buttons, resume position, `onTimeUpdate`-driven React state), passed in as `mediaElement`
 * instead of letting wavesurfer create its own. Clicking or dragging the waveform seeks that
 * element directly; our own state picks the change up through the native events it already
 * listens to, so no separate progress/onSeek plumbing is needed here. Shared by History's rows
 * and the docked player bar (Current) — same shape and behavior, different `scheme` (see
 * SCHEMES) so the two views are still visually distinct.
 *
 * A continuous mirrored wave (wavesurfer's default shape when barWidth/barGap are left unset —
 * a bar-style render was tried first and read as a muddy dense block once the container got
 * tall/wide; see this file's git history), not discrete bars. A tinted panel behind it — a DAW
 * track's colored clip, not a flat waveform on plain black — but no blur/glow on the shape's
 * edges itself, which read as sloppy rather than soft once tried. The playhead cursor is a solid
 * red line, deliberately unrelated to either scheme's palette, so it stays legible over any bar
 * color under it. Podcast dialogue is loudness-normalized already, so raw peaks read as a
 * near-flat wall — `normalize: false` keeps the shape reading true instead of stretching
 * everything to the same height.
 */
export function AudioOverviewWaveform({
  url,
  mediaElement,
  scheme = "emerald",
  className = "h-16",
}: {
  url: string
  /** null until the bound `<audio>` element has mounted — nothing renders until then. */
  mediaElement: HTMLAudioElement | null
  scheme?: AudioOverviewWaveformScheme
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const colors = SCHEMES[scheme]

  useEffect(() => {
    if (!containerRef.current || !mediaElement) return
    const height = containerRef.current.clientHeight || 64
    const ws = WaveSurfer.create({
      container: containerRef.current,
      media: mediaElement,
      url,
      height: "auto",
      waveColor: verticalGradient(height, colors.wave),
      progressColor: verticalGradient(height, colors.progress),
      cursorColor: "#ef4444",
      cursorWidth: 2,
      normalize: false,
      dragToSeek: true,
    })
    return () => ws.destroy()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaElement, url, scheme])

  return (
    <div className={`relative overflow-hidden rounded-md bg-brand-navy-950 ${className}`}>
      {/* A tinted track-clip panel behind the wave, not flat black — a soft top-to-bottom wash
       * plus a brighter core glow at center height, where the shape sits. */}
      <div className="pointer-events-none absolute inset-0" style={{ background: colors.panelWash }} aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" style={{ background: colors.panelGlow }} aria-hidden="true" />
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}
