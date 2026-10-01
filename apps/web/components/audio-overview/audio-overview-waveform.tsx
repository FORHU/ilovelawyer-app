"use client"
import { useEffect, useRef } from "react"
import { useTheme } from "next-themes"
import WaveSurfer from "wavesurfer.js"

export type AudioOverviewWaveformScheme = "current" | "history"

/** Reads a theme token off the element — wavesurfer paints a canvas, which can't resolve
 * `var(--x)` itself, so the colors are resolved at draw time and redrawn on a theme change. */
function token(el: Element, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback
}

/** Left-to-right gradient for the played part, so progress reads as a sweep across the track. */
function horizontalGradient(width: number, from: string, to: string): CanvasGradient {
  const gradient = document.createElement("canvas").getContext("2d")!.createLinearGradient(0, 0, width, 0)
  gradient.addColorStop(0, from)
  gradient.addColorStop(1, to)
  return gradient
}

/**
 * A waveform rendered by wavesurfer.js — decodes `url` to draw the shape, but drives playback
 * through the SAME `<audio>` element the rest of the player already controls, passed in as
 * `mediaElement`. Clicking or dragging seeks that element directly; our own state picks the
 * change up through the native events it already listens to.
 *
 * Two schemes so Current and History read as different views at a glance: Current is a muted
 * slate against a green-to-cyan sweep on a faint teal track; History is teal against orange.
 * A continuous mirrored wave (wavesurfer's default when barWidth/barGap are unset — bars read as
 * a muddy block once the track got wide). The playhead is red in Current and the foreground color
 * in History, unrelated to either wave so it stays legible over them. `normalize: false` because
 * podcast dialogue is already loudness-normalized and stretching it flattens the shape.
 */
export function AudioOverviewWaveform({
  url,
  mediaElement,
  scheme = "current",
  className = "h-16",
}: {
  url: string
  /** null until the bound `<audio>` element has mounted — nothing renders until then. */
  mediaElement: HTMLAudioElement | null
  scheme?: AudioOverviewWaveformScheme
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)
  const { resolvedTheme } = useTheme()

  const colorsFor = (el: HTMLElement) =>
    scheme === "current"
      ? {
          waveColor: token(el, "--ao-wave", "#3d4757"),
          progressColor: horizontalGradient(
            el.clientWidth || 400,
            token(el, "--ao-played-from", "#34d399"),
            token(el, "--ao-played-to", "#22d3ee"),
          ),
          cursorColor: token(el, "--destructive", "#ef4444"),
        }
      : {
          waveColor: resolvedTheme === "light" ? "rgba(13,148,136,0.35)" : "rgba(45,212,191,0.38)",
          progressColor: resolvedTheme === "light" ? "#c2410c" : "#fb923c",
          cursorColor: token(el, "--foreground", "#fafafa"),
        }

  // Created once per recording. Re-creating it re-loads the audio into the shared <audio>
  // element (wavesurfer fetches it as a blob and points the element at its own blob URL, then
  // revokes that URL on destroy), which stops whatever is playing and resets it to 0:00 — so
  // anything that only changes how the wave looks goes through the effect below instead.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !mediaElement) return
    const ws = WaveSurfer.create({
      container: el,
      media: mediaElement,
      url,
      height: "auto",
      ...colorsFor(el),
      cursorWidth: 2,
      normalize: false,
      dragToSeek: true,
    })
    wavesurferRef.current = ws
    return () => {
      ws.destroy()
      wavesurferRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaElement, url])

  // A theme switch only recolors the existing wave — setOptions redraws without touching media.
  useEffect(() => {
    const el = containerRef.current
    if (!el || !wavesurferRef.current) return
    wavesurferRef.current.setOptions(colorsFor(el))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedTheme, scheme])

  return (
    <div
      className={`relative overflow-hidden ${
        scheme === "current" ? "rounded-md bg-(--ao-tint)" : "rounded border border-border/60"
      } ${className}`}
    >
      <div ref={containerRef} className="absolute inset-x-0 top-1 bottom-1" />
    </div>
  )
}
