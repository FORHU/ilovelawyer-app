"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { openCanvasWindow, sortedSecondaryScreens } from "@/lib/terminal/multi-screen"
import { applyScreenPreset, panelShortCode, panelsHiddenByPreset, presetsForScreenCount, type ScreenPresetDef } from "@/lib/terminal/screen-presets"
import type { WorkspaceLayout } from "@/lib/terminal/types"

interface ScreenPresetsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Detected by the caller's click handler and handed down — getScreenDetails() is
  // permission-gated and must run synchronously off the real click (Chromium's
  // transient-activation rule, same as usePopOutToNextScreen). This Dialog has no DialogTrigger
  // of its own (it's opened purely by the parent flipping `open`), so Radix's onOpenChange never
  // fires on that open transition — detecting here would silently never run. Null while the
  // caller's own getScreenDetails() call is still in flight.
  detectedCount: number | null
  caseId: string
  layout: WorkspaceLayout | null
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>
  canvasWindowsRef: React.RefObject<Map<number, Window>>
}

// Two-column layout-template picker for the multi-screen capability pill: a list of named
// workflows on the left, filtered to however many screens are actually connected (shown as a
// plain indicator, not something to override — a preset for more screens than exist has nowhere
// to send its extra panes), and the selected one's per-display pane breakdown + Apply on the
// right. Applying is immediate unless it would hide a panel the lawyer currently has visible,
// which shows an inline confirm naming what's about to disappear before committing.
//
// Skipped vs. the mockup: drag-drop pane rebalancing across displays, a deadline-driven
// "recommended" badge, and "save as my own phase" — each is its own real feature (live case-data
// wiring, a custom-preset persistence layer, a DnD rebuild), not a reskin. Add if wanted.
export function ScreenPresetsModal({ open, onOpenChange, detectedCount, caseId, layout, setLayout, canvasWindowsRef }: ScreenPresetsModalProps) {
  const { t } = useTranslation("terminal")
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const count = liveCount ?? detectedCount
  const presets = count ? presetsForScreenCount(count) : null
  const selected = presets?.find((p) => p.id === selectedId) ?? presets?.[0] ?? null

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setLiveCount(null)
      setSelectedId(null)
      setConfirming(false)
    }
  }

  const [detecting, setDetecting] = useState(false)
  const detect = () => {
    if (!window.getScreenDetails) return
    setDetecting(true)
    // getScreenDetails() resolves near-instantly once permission is already granted — without a
    // floor, the true->false toggle can collapse into one render before it ever paints, so the
    // spin never becomes visible.
    const minDelay = new Promise((resolve) => setTimeout(resolve, 400))
    Promise.all([window.getScreenDetails(), minDelay])
      .then(([details]) => setLiveCount(1 + sortedSecondaryScreens(details).length))
      .finally(() => setDetecting(false))
  }

  const apply = (preset: ScreenPresetDef) => {
    if (!layout) return
    setLayout((prev) => (prev ? applyScreenPreset(prev, preset) : prev))
    if (window.getScreenDetails) {
      window.getScreenDetails().then((details) => {
        const secondary = sortedSecondaryScreens(details)
        preset.screens.forEach((_, screenIndex) => {
          if (screenIndex === 0 || canvasWindowsRef.current.has(screenIndex)) return
          const screen = secondary[screenIndex - 1]
          if (screen) openCanvasWindow(caseId, screenIndex, screen, canvasWindowsRef)
        })
      })
    }
    setConfirming(false)
    onOpenChange(false)
  }

  const handleApplyClick = () => {
    if (!layout || !selected) return
    if (panelsHiddenByPreset(layout, selected).length > 0) {
      setConfirming(true)
      return
    }
    apply(selected)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/60 py-5 pl-6 pr-12">
          <div>
            <DialogTitle asChild>
              <h2 className="font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">{t("screenPresets")}</h2>
            </DialogTitle>
            <DialogDescription asChild>
              <p className="mt-1 text-xs text-muted-foreground">{t("screenPresetsHint")}</p>
            </DialogDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {count && (
              <span className="rounded-full border border-border px-3 py-1 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                {t("screensConnected", { count })}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={detect}
                  aria-label={t("detectScreens")}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("detectScreens")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {!count ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("detectingScreens")}</p>
        ) : (
          <div className="flex min-h-0">
            <div className="w-56 shrink-0 border-r border-border/70 py-2">
              {presets!.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(preset.id)
                    setConfirming(false)
                  }}
                  className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs transition-colors ${
                    (selected?.id ?? presets![0]!.id) === preset.id
                      ? "bg-brand-gold/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span className="font-semibold uppercase tracking-[0.5px]">{t(preset.labelKey)}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {preset.screens.reduce((n, s) => n + s.panelIds.length, 0)}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 px-6 py-5">
              {selected && !confirming && (
                <>
                  <h3 className="font-['Libre_Caslon_Text'] text-base text-foreground font-normal">{t(selected.labelKey)}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{t(selected.descriptionKey)}</p>

                  <div className="mt-4 flex gap-3 overflow-x-auto">
                    {selected.screens.map((screen, index) => (
                      <div key={index} className="min-w-[160px] flex-1">
                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                          {index === 0 ? t("thisWindow") : t("popoutWindowN", { n: index + 1 })}
                        </p>
                        <div className="flex flex-col gap-1.5 rounded-md border border-border/70 bg-muted/30 p-2">
                          {screen.panelIds.map((id) => (
                            <div key={id} className="flex items-center gap-1.5 rounded border border-border/60 bg-background/60 px-2 py-1.5">
                              <span className="rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-foreground">
                                {panelShortCode(PANEL_TITLES[id])}
                              </span>
                              <span className="truncate text-[11px] text-foreground">{PANEL_TITLES[id]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleApplyClick}
                      className="bg-brand-gold text-brand-navy-950 text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
                    >
                      {count > 1 ? t("presetApplyToDisplays", { count }) : t("presetApplyConfirm")}
                    </button>
                  </div>
                </>
              )}

              {selected && confirming && (
                <div>
                  <p className="text-sm text-foreground leading-relaxed">
                    {t("presetWillHide", { panels: panelsHiddenByPreset(layout!, selected).map((id) => PANEL_TITLES[id]).join(", ") })}
                  </p>
                  <div className="mt-5 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirming(false)}
                      className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      type="button"
                      onClick={() => apply(selected)}
                      className="bg-brand-gold text-brand-navy-950 text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
                    >
                      {t("presetApplyConfirm")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
