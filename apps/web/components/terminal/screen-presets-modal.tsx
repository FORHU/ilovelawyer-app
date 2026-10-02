"use client"

import { useEffect, useReducer, useState, type Dispatch, type SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { PresetList } from "@/components/terminal/preset-list"
import { PopupSetupStep } from "@/components/terminal/popup-setup-step"
import { MultiScreenGuide } from "@/components/terminal/multi-screen-guide"
import { openCanvasWindow, placeCanvasWindow, sortedSecondaryScreens, subscribeToScreenChanges, type ScreenDetails } from "@/lib/terminal/multi-screen"
import {
  applyScreenPreset,
  captureCurrentScreens,
  foldScreensIntoPrimary,
  fromRow,
  generateSpreadPreset,
  panelShortCode,
  panelsHiddenByPreset,
  presetDescription,
  presetLabel,
  type ScreenPresetDef,
} from "@/lib/terminal/screen-presets"
import { useCreateScreenPresetMutation, useDeleteScreenPresetMutation, useScreenPresetsQuery } from "@/lib/terminal/mutations"
import type { WorkspaceLayout } from "@/lib/terminal/types"

// Set once an Apply has opened every display window, which means pop-ups are allowed in this
// browser. From then on the how-to guide starts collapsed. Per browser, like the pop-up setting it
// tracks; storage can be unavailable (private window, blocked site data), so every access is
// guarded and the guide simply starts expanded.
const GUIDE_COLLAPSED_KEY = "terminal:multiScreenGuideCollapsed"

function readGuideCollapsed(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(GUIDE_COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

function writeGuideCollapsed(collapsed: boolean) {
  try {
    if (collapsed) window.localStorage.setItem(GUIDE_COLLAPSED_KEY, "1")
    else window.localStorage.removeItem(GUIDE_COLLAPSED_KEY)
  } catch {
    // Storage unavailable: the guide just starts expanded next time.
  }
}

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
  // The same detection's screen list (live: ScreenDetails updates itself), kept so Apply can open
  // every display window synchronously inside its own click. Awaiting getScreenDetails() again
  // first would let the click's user activation lapse, and the popup blocker would then let
  // through at most one window.
  detectedScreens: ScreenDetails | null
  caseId: string
  layout: WorkspaceLayout | null
  setLayout: Dispatch<SetStateAction<WorkspaceLayout | null>>
  canvasWindowsRef: React.RefObject<Map<number, Window>>
}

// Two-column layout-template picker for the toolbar "Workflows" button: a list of named
// workflows on the left (system presets seeded server-side + this lawyer's own saved ones,
// fetched by screen count), filtered to however many screens are actually connected (shown as a
// plain indicator, not something to override — a preset for more screens than exist has nowhere
// to send its extra panes), and the selected one's per-display pane breakdown + Apply on the
// right. Applying is immediate unless it would hide a panel the lawyer currently has visible,
// which shows an inline confirm naming what's about to disappear before committing.
//
// "+ New Layout" uses a separate component, LayoutBuilderModal, not this one — building a new
// layout from scratch is a drag-and-drop exercise, not a pick-one-preset-and-name-it dialog.
export function ScreenPresetsModal({ open, onOpenChange, detectedCount, detectedScreens, caseId, layout, setLayout, canvasWindowsRef }: ScreenPresetsModalProps) {
  const { t } = useTranslation("terminal")
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [liveScreens, setLiveScreens] = useState<ScreenDetails | null>(null)
  // Set after Apply when the popup blocker refused some display windows: the preset and those
  // display indices, whose panels are meanwhile shown in this window. Drives the one-time setup
  // reminder (PopupSetupStep); its "Open remaining displays" is a fresh click that retries.
  const [blocked, setBlocked] = useState<{ preset: ScreenPresetDef; refused: number[] } | null>(null)
  const [guideExpanded, setGuideExpanded] = useState(() => !readGuideCollapsed())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saveName, setSaveName] = useState("")

  // Screens can change while the modal is open (a monitor unplugged or plugged back in).
  // ScreenDetails is live, so follow its change events: re-count the screens (which also refetches
  // the presets for the new count) and re-render the per-display monitor names.
  const activeScreens = liveScreens ?? detectedScreens
  const [, bumpScreensVersion] = useReducer((n: number) => n + 1, 0)
  useEffect(() => {
    if (!open || !activeScreens) return
    return subscribeToScreenChanges(activeScreens, () => {
      setLiveCount(1 + sortedSecondaryScreens(activeScreens).length)
      bumpScreensVersion()
    })
  }, [open, activeScreens])
  const secondaryScreens = activeScreens ? sortedSecondaryScreens(activeScreens) : []

  const count = liveCount ?? detectedCount
  const presetsQuery = useScreenPresetsQuery(count ?? 0)
  const createPreset = useCreateScreenPresetMutation()
  const deletePreset = useDeleteScreenPresetMutation()

  const presets: ScreenPresetDef[] | null = count
    ? [...(presetsQuery.data?.map(fromRow) ?? []), ...(count > 3 ? [generateSpreadPreset(count)] : [])]
    : null
  const selected = presets?.find((p) => p.id === selectedId) ?? presets?.[0] ?? null

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) {
      setLiveCount(null)
      setLiveScreens(null)
      setBlocked(null)
      setSelectedId(null)
      setConfirming(false)
      setSaveName("")
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
      .then(([details]) => {
        setLiveScreens(details)
        setLiveCount(1 + sortedSecondaryScreens(details).length)
      })
      .finally(() => setDetecting(false))
  }

  // Gives every display in `preset` a canvas window on its own monitor: an open window is moved
  // onto it (the OS may have moved it when a monitor was unplugged), a missing one is opened, and an
  // open window whose monitor is gone is closed. Returns the display indices left without a window
  // (`missing`), and the subset of those the popup blocker refused (`refused`; the rest have no
  // monitor to go to). Each window that opens loads its panels itself: it asks the open windows for
  // the current layout on mount (see useLayoutSyncChannel).
  const openDisplayWindows = (preset: ScreenPresetDef, details: ScreenDetails | null): { missing: number[]; refused: number[] } => {
    const secondary = details ? sortedSecondaryScreens(details) : []
    const missing: number[] = []
    const refused: number[] = []
    preset.screens.forEach((presetScreen, screenIndex) => {
      // A screen can be empty when a stored preset only listed retired panes (see fromRow).
      if (screenIndex === 0 || presetScreen.panelIds.length === 0) return
      const existing = canvasWindowsRef.current.get(screenIndex)
      const screen = secondary[screenIndex - 1]
      if (existing && !existing.closed) {
        if (screen) {
          placeCanvasWindow(existing, screen)
          return
        }
        // Its monitor is gone: its panels go to this window instead (see foldScreensIntoPrimary).
        existing.close()
        canvasWindowsRef.current.delete(screenIndex)
      }
      if (!screen) {
        missing.push(screenIndex)
      } else if (!openCanvasWindow(caseId, screenIndex, screen, canvasWindowsRef)) {
        missing.push(screenIndex)
        refused.push(screenIndex)
      }
    })
    return { missing, refused }
  }

  // Lays the preset out with every display that has no window folded into this one, so every
  // panel in the preset is on screen the moment it's applied. If the popup blocker was the reason,
  // the one-time setup reminder stays up to get pop-ups allowed and the rest opened.
  const applyWithWindows = (preset: ScreenPresetDef, details: ScreenDetails | null) => {
    const { missing, refused } = preset.screens.length > 1 ? openDisplayWindows(preset, details) : { missing: [], refused: [] }
    setLayout((prev) => (prev ? applyScreenPreset(prev, foldScreensIntoPrimary(preset, missing)) : prev))
    if (refused.length > 0) {
      setBlocked({ preset, refused })
      return
    }
    // Every display got its window, so pop-ups work here: the guide has done its job.
    if (preset.screens.length > 1 && missing.length === 0) {
      writeGuideCollapsed(true)
      setGuideExpanded(false)
    }
    setBlocked(null)
    onOpenChange(false)
  }

  // Closes canvas windows for displays the preset doesn't use, then applies it, opening every
  // display's window within this click.
  const commit = (preset: ScreenPresetDef) => {
    if (!layout) return
    setConfirming(false)
    canvasWindowsRef.current.forEach((win, screenIndex) => {
      if (screenIndex < preset.screens.length) return
      win.close()
      canvasWindowsRef.current.delete(screenIndex)
    })
    const details = liveScreens ?? detectedScreens
    if (details || preset.screens.length <= 1 || !window.getScreenDetails) {
      applyWithWindows(preset, details)
      return
    }
    // Detection hadn't finished when Apply was clicked, so detect now. Any window the popup
    // blocker refuses after this wait has its panels shown here instead.
    window
      .getScreenDetails()
      .then((fresh) => {
        setLiveScreens(fresh)
        applyWithWindows(preset, fresh)
      })
      .catch(() => applyWithWindows(preset, null))
  }

  // A fresh click, so the popup blocker lets more windows through. Re-applying moves the panels of
  // every display that now has a window out of this one and onto it.
  const openRemaining = () => {
    if (blocked) applyWithWindows(blocked.preset, liveScreens ?? detectedScreens)
  }

  const handlePrimaryClick = () => {
    if (!selected || !layout) return
    if (panelsHiddenByPreset(layout, selected).length > 0) {
      setConfirming(true)
      return
    }
    commit(selected)
  }

  const handleSave = () => {
    if (!layout || !count || !saveName.trim()) return
    const screens = captureCurrentScreens(layout, count)
    if (screens.length === 0) return
    createPreset.mutate({ name: saveName.trim(), screens })
    setSaveName("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-border bg-muted/60 py-5 pl-6 pr-12">
          <div className="min-w-0">
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

        {!count || presetsQuery.isLoading ? (
          <p className="px-6 py-6 text-sm text-muted-foreground">{t("detectingScreens")}</p>
        ) : (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto sm:flex-row sm:overflow-visible">
            <div className="flex shrink-0 flex-col border-b border-border/70 sm:w-56 sm:border-b-0 sm:border-r">
              <PresetList
                presets={presets!}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id)
                  setConfirming(false)
                  setBlocked(null)
                }}
                onDelete={(id) => {
                  deletePreset.mutate(id)
                  if (selectedId === id) setSelectedId(null)
                }}
              />

              <div className="flex items-center gap-1.5 border-t border-border/70 p-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={t("savePresetPlaceholder")}
                  className="h-7 min-w-0 flex-1 rounded border border-border bg-background px-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!saveName.trim() || createPreset.isPending}
                  className="h-7 shrink-0 rounded border border-border px-2 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
                >
                  {t("savePreset")}
                </button>
              </div>
            </div>

            <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
              {blocked && (
                <PopupSetupStep
                  preset={blocked.preset}
                  refused={blocked.refused}
                  onKeepHere={() => handleOpenChange(false)}
                  onOpenRemaining={openRemaining}
                />
              )}

              {count > 1 && !blocked && (
                <MultiScreenGuide
                  expanded={guideExpanded}
                  onToggle={() => {
                    writeGuideCollapsed(guideExpanded)
                    setGuideExpanded(!guideExpanded)
                  }}
                />
              )}

              {selected && !blocked && !confirming && (
                <>
                  <h3 className="font-['Libre_Caslon_Text'] text-base text-foreground font-normal">{presetLabel(selected, t)}</h3>
                  {presetDescription(selected, t) && <p className="mt-1 text-xs text-muted-foreground">{presetDescription(selected, t)}</p>}

                  <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
                    {selected.screens.map((screen, index) => (
                      <div key={index} className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                          {index === 0 ? t("thisWindow") : t("popoutWindowN", { n: index + 1 })}
                        </p>
                        {/* Which physical monitor this display lands on, so a lawyer can tell them
                            apart. Blank when the OS reports no name; flagged when there's no monitor. */}
                        <p className="mb-1.5 truncate text-[10px] text-muted-foreground/80">
                          {index === 0
                            ? activeScreens?.currentScreen?.label || "\u00a0"
                            : secondaryScreens[index - 1]
                              ? secondaryScreens[index - 1]!.label || "\u00a0"
                              : t("displayNoMonitor")}
                        </p>
                        <div className="flex flex-col gap-1.5 rounded-md border border-border/70 bg-muted/30 p-2">
                          {screen.panelIds.map((id) => (
                            <div key={id} className="flex items-center gap-1.5 rounded border border-border/60 bg-background/60 px-2 py-1.5">
                              <span className="shrink-0 rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-foreground">
                                {panelShortCode(PANEL_TITLES[id])}
                              </span>
                              <span className="min-w-0 break-words text-[11px] leading-tight text-foreground">{PANEL_TITLES[id]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handlePrimaryClick}
                      className="bg-brand-gold text-brand-gold-foreground text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
                    >
                      {count > 1 ? t("presetApplyToDisplays", { count }) : t("presetApplyConfirm")}
                    </button>
                  </div>
                </>
              )}

              {selected && !blocked && confirming && (
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
                      onClick={() => commit(selected)}
                      className="bg-brand-gold text-brand-gold-foreground text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
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
