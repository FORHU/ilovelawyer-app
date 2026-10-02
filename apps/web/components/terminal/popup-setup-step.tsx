"use client"

import { useTranslation } from "react-i18next"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { panelShortCode, type ScreenPresetDef } from "@/lib/terminal/screen-presets"

// The browser's own pop-up settings page, for allowing this site by hand. Edge identifies itself
// with "Edg/" in its user agent; every other Chromium browser takes Chrome's path.
export function popupSettingsPath(): string {
  return typeof navigator !== "undefined" && navigator.userAgent.includes("Edg/")
    ? "edge://settings/content/popups"
    : "chrome://settings/content/popups"
}

interface PopupSetupStepProps {
  preset: ScreenPresetDef
  // Display indices (1+) the popup blocker refused a window for. Their panels are already shown in
  // the primary window (see foldScreensIntoPrimary) while this step is up.
  refused: number[]
  onKeepHere: () => void
  onOpenRemaining: () => void
}

// The presets modal's one-time setup reminder: shown only when the browser's popup blocker refused
// some display windows on Apply. A site can't allow its own pop-ups, so this walks the lawyer
// through allowing them once; after that every display opens on the first click and this step
// never shows again. "Open remaining displays" is a fresh click, so it also gets at least one more
// window through even if pop-ups are still blocked.
export function PopupSetupStep({ preset, refused, onKeepHere, onOpenRemaining }: PopupSetupStepProps) {
  const { t } = useTranslation("terminal")
  const refusedSet = new Set(refused)
  const settingsPath = popupSettingsPath()
  const movedIds = preset.screens.flatMap((screen, index) => (refusedSet.has(index) ? screen.panelIds : []))

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-['Libre_Caslon_Text'] text-base text-foreground font-normal">{t("popupSetupTitle")}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t("popupSetupSummary", { count: refused.length })}</p>
      </div>

      <ul className="flex flex-col gap-1.5">
        {preset.screens.map((screen, index) => {
          if (index === 0) return null
          const blocked = refusedSet.has(index)
          return (
            <li key={index} className="flex items-start gap-2.5 text-xs text-foreground">
              <span
                className={`mt-1 size-2 shrink-0 rounded-full ${blocked ? "bg-amber-500" : "bg-emerald-500"}`}
                aria-hidden="true"
              />
              <span>
                {blocked
                  ? t("popupSetupBlocked", { display: t("displayN", { n: index + 1 }), count: screen.panelIds.length })
                  : t("popupSetupOpened", { display: t("displayN", { n: index + 1 }) })}
              </span>
            </li>
          )
        })}
      </ul>

      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("popupSetupThisWindow")}</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-1.5">
          {movedIds.map((id) => (
            <div key={id} className="flex items-center gap-1.5 rounded border border-dashed border-amber-500/70 bg-background/60 px-2 py-1.5">
              <span className="shrink-0 rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-foreground">
                {panelShortCode(PANEL_TITLES[id])}
              </span>
              <span className="min-w-0 break-words text-[11px] leading-tight text-foreground">{PANEL_TITLES[id]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-border/70 bg-muted/30 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("popupSetupHowTo")}</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-xs text-foreground">
          <li>{t("popupSetupStep1")}</li>
          <li>{t("popupSetupStep2")}</li>
          <li>{t("popupSetupStep3")}</li>
        </ol>
        <p className="mt-2.5 text-[11px] text-muted-foreground">
          {t("popupSetupNoIcon", { path: settingsPath })}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">{t("popupSetupOnce")}</p>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="button"
          onClick={onKeepHere}
          className="text-xs font-semibold tracking-wider uppercase text-muted-foreground hover:text-foreground px-4 py-2.5 rounded-full transition-colors"
        >
          {t("presetKeepHere")}
        </button>
        <button
          type="button"
          onClick={onOpenRemaining}
          className="bg-brand-gold text-brand-gold-foreground text-xs font-semibold tracking-wider px-6 py-2.5 rounded-full hover:bg-brand-gold/85 transition-colors uppercase"
        >
          {t("presetOpenRemaining")}
        </button>
      </div>
    </div>
  )
}
