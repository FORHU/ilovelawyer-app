"use client"

import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { panelShortCode, presetDescription, presetLabel, type ScreenPresetDef } from "@/lib/terminal/screen-presets"
import type { ArrangementValue } from "@/lib/terminal/types"

const ARRANGEMENT_LABEL: Record<ArrangementValue, string> = {
  free: "arrangementFree",
  columns: "arrangementColumns",
  focus: "arrangementFocus",
}
const ARRANGEMENT_HINT: Record<ArrangementValue, string> = {
  free: "arrangementFreeHint",
  columns: "arrangementColumnsHint",
  focus: "arrangementFocusHint",
}

// A 40x28 sketch of how an arrangement fills a screen, so the layout name means something at a glance.
function ArrangementGlyph({ arrangement }: { arrangement: ArrangementValue }) {
  const block = "absolute rounded-[2px] bg-foreground/25"
  return (
    <span aria-hidden="true" className="relative block h-7 w-10 shrink-0 rounded-[3px] border border-border bg-background">
      {arrangement === "columns" && (
        <>
          <span className={`${block} bottom-1 left-1 top-1 w-[8px]`} />
          <span className={`${block} bottom-1 left-[15px] top-1 w-[8px]`} />
          <span className={`${block} bottom-1 left-[26px] top-1 w-[8px]`} />
        </>
      )}
      {arrangement === "focus" && (
        <>
          <span className={`${block} bottom-1 left-1 top-1 w-[17px]`} />
          <span className={`${block} left-[24px] top-1 h-[8px] w-[5px]`} />
          <span className={`${block} bottom-1 left-[24px] h-[8px] w-[5px]`} />
          <span className="absolute bottom-1 right-1 top-1 w-[5px] rounded-[2px] bg-brand-gold/60" />
        </>
      )}
      {arrangement === "free" && (
        <>
          <span className={`${block} left-1 top-1 h-[10px] w-[16px]`} />
          <span className={`${block} right-1 top-[7px] h-[9px] w-[13px]`} />
          <span className={`${block} bottom-1 left-[10px] h-[7px] w-[14px]`} />
        </>
      )}
    </span>
  )
}

interface PresetDetailProps {
  preset: ScreenPresetDef
  /** The monitor each screen lands on, or a note that it has none. Index 0 is this window. */
  monitorLabel: (screenIndex: number) => string
}

/** The selected workflow in the Workflows modal: what it is for, when to reach for it, and what sits on each screen.
 * System presets carry written copy in terminal.json (`<labelKey>Desc`, `<labelKey>When`, `<labelKey>Screen<n>`); a
 * lawyer's own saved preset or the generated Spread Evenly has none of the extras, so those parts simply don't render. */
export function PresetDetail({ preset, monitorLabel }: PresetDetailProps) {
  const { t, i18n } = useTranslation("terminal")
  const own = (suffix: string) => (preset.labelKey && i18n.exists(`${preset.labelKey}${suffix}`, { ns: "terminal" }) ? t(`${preset.labelKey}${suffix}`) : undefined)

  const summary = presetDescription(preset, t)
  const bestFor = own("When")
  const paneCount = preset.screens.reduce((n, s) => n + s.panelIds.length, 0)
  const arrangements = [...new Set(preset.screens.map((s) => s.arrangement))]

  return (
    <div key={preset.id} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <h3 className="font-['Libre_Caslon_Text'] text-lg font-normal tracking-[-0.01em] text-foreground">{presetLabel(preset, t)}</h3>
      {summary && <p className="mt-1.5 max-w-[60ch] text-[13px] leading-relaxed text-muted-foreground">{summary}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge shape="pill">{t("presetScreensCount", { count: preset.screens.length })}</Badge>
        <Badge shape="pill">{t("presetPanesCount", { count: paneCount })}</Badge>
        {arrangements.map((arrangement) => (
          <Badge key={arrangement} shape="pill">
            {t(ARRANGEMENT_LABEL[arrangement])}
          </Badge>
        ))}
      </div>

      {bestFor && (
        <div className="mt-5 border-l-2 border-brand-gold/70 pl-3">
          <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("presetBestFor")}</p>
          <p className="mt-1 max-w-[60ch] text-[13px] leading-relaxed text-foreground">{bestFor}</p>
        </div>
      )}

      <ol className="mt-5 divide-y divide-border/70 border-y border-border/70">
        {preset.screens.map((screen, index) => {
          const role = own(`Screen${index + 1}`)
          return (
            <li key={index} className="grid gap-x-5 gap-y-2.5 py-3.5 md:grid-cols-[13rem_minmax(0,1fr)]">
              <div className="flex min-w-0 items-start gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={t(ARRANGEMENT_LABEL[screen.arrangement])} className="rounded-[3px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <ArrangementGlyph arrangement={screen.arrangement} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-56">
                    <span className="font-semibold">{t(ARRANGEMENT_LABEL[screen.arrangement])}.</span> {t(ARRANGEMENT_HINT[screen.arrangement])}
                  </TooltipContent>
                </Tooltip>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                    {index === 0 ? t("thisWindow") : t("popoutWindowN", { n: index + 1 })}
                  </p>
                  {role && <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground">{role}</p>}
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                    {t(ARRANGEMENT_LABEL[screen.arrangement])}
                    {monitorLabel(index).trim() ? `, ${monitorLabel(index)}` : ""}
                  </p>
                </div>
              </div>
              <ul className="flex min-w-0 flex-wrap content-start gap-1.5">
                {screen.panelIds.map((id) => (
                  <li key={id} className="flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/30 py-1 pl-1 pr-2">
                    <span className="shrink-0 rounded bg-foreground/10 px-1 py-0.5 text-[9px] font-bold tracking-wider text-foreground">
                      {panelShortCode(PANEL_TITLES[id])}
                    </span>
                    <span className="text-[11px] leading-tight text-foreground">{PANEL_TITLES[id]}</span>
                  </li>
                ))}
              </ul>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
