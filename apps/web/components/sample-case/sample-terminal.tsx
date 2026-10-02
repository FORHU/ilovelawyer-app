"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Pin, X } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { PANEL_TITLES } from "@/lib/terminal/panel-titles"
import { ARRANGEMENT_VALUES, type ArrangementValue, type PanelId } from "@/lib/terminal/types"
import { PANE_CATEGORY_META, PANE_CATEGORY_ORDER, PANEL_CATEGORY } from "@/components/terminal/terminal-pane-categories"
import { PANE_INFO, SAMPLE_GRID, type SampleCase } from "@/lib/sample-case/data"
import { SeverityChip } from "@/components/sample-case/severity-chip"
import { useTourT } from "@/lib/tour/use-tour-t"

const GRID_CLASS: Record<ArrangementValue, string> = {
  free: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
  columns: "grid-cols-1 sm:grid-cols-2",
  tabs: "grid-cols-1",
  focus: "grid-cols-1",
}

const iconButton =
  "inline-flex size-6 cursor-pointer items-center justify-center rounded-full border border-border hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** The sample case's Legal Terminal: a pane grid with sample content, the four arrangements, and
 * Add pane listing every pane by group. Rearranging works; anything that would save doesn't. */
export function SampleTerminal({ data, onReadOnly }: { data: SampleCase; onReadOnly: () => void }) {
  const { t } = useTourT()
  const { t: tTerminal } = useTranslation("terminal")
  const [grid, setGrid] = useState<PanelId[]>(SAMPLE_GRID)
  const [focused, setFocused] = useState<PanelId>(SAMPLE_GRID[0]!)
  const [arrangement, setArrangement] = useState<ArrangementValue>("free")
  const [catalogOpen, setCatalogOpen] = useState(false)

  const singlePane = arrangement === "tabs" || arrangement === "focus"
  const shown = singlePane ? grid.filter((id) => id === focused) : grid
  const catalog = PANE_CATEGORY_ORDER.map((category) => ({
    category,
    panes: (Object.keys(PANEL_CATEGORY) as PanelId[]).filter((id) => PANEL_CATEGORY[id] === category),
  }))

  const close = (id: PanelId) => {
    const next = grid.filter((x) => x !== id)
    setGrid(next)
    if (focused === id && next[0]) setFocused(next[0])
  }

  const add = (id: PanelId) => {
    if (!grid.includes(id)) setGrid([...grid, id])
    setFocused(id)
    setCatalogOpen(false)
    requestAnimationFrame(() => document.querySelector(`[data-sample-tour="pane-${id}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }))
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div data-sample-tour="arrange" role="group" aria-label={t("sampleCase.arrangement")} className="inline-flex rounded-full border border-border p-0.5">
          {ARRANGEMENT_VALUES.map((a) => (
            <button
              key={a}
              type="button"
              aria-pressed={arrangement === a}
              onClick={() => setArrangement(a)}
              className={`h-7 cursor-pointer rounded-full px-3 text-[10px] uppercase tracking-[0.8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                arrangement === a ? "bg-foreground/[0.08] font-bold text-foreground" : "text-muted-foreground"
              }`}
            >
              {t(`sampleCase.arrangements.${a}`)}
            </button>
          ))}
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">{t("sampleCase.paneCount", { count: grid.length })}</span>
        <span className="flex-1" />
        <Button variant="outline" className="h-9 rounded-full px-4 text-[10px] font-semibold uppercase tracking-[1px]" onClick={onReadOnly}>
          {t("sampleCase.refresh")}
        </Button>
        <Button data-sample-tour="add-pane" variant="accent" className="h-9 px-4 text-[10px] tracking-[1px]" onClick={() => setCatalogOpen(true)}>
          + {t("sampleCase.addPane")}
        </Button>
      </div>

      {arrangement === "tabs" && (
        <div className="flex gap-1.5 overflow-x-auto">
          {grid.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={focused === id}
              onClick={() => setFocused(id)}
              className={`h-7 shrink-0 cursor-pointer rounded-lg border px-3 text-[11.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                focused === id ? "border-foreground font-semibold" : "border-border"
              }`}
            >
              {PANEL_TITLES[id]}
            </button>
          ))}
        </div>
      )}

      <div className={`grid gap-3 ${GRID_CLASS[arrangement]}`}>
        {shown.map((id) => {
          const info = PANE_INFO[id]
          const rows = data.panes[id]
          const title = PANEL_TITLES[id]
          const category = info ? tTerminal(PANE_CATEGORY_META[info.category].labelKey) : ""
          return (
            <section
              key={id}
              data-sample-tour={`pane-${id}`}
              aria-label={title}
              className="flex min-h-[230px] min-w-0 flex-col rounded-xl border border-border bg-background"
            >
              <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                <span className="min-w-0 flex-1 truncate text-[10px] font-bold uppercase tracking-[1px]">{title}</span>
                <span className="font-mono text-[9.5px] text-muted-foreground">{category}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={onReadOnly} aria-label={t("sampleCase.pin", { pane: title })} className={iconButton}>
                      <Pin className="size-3" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("sampleCase.pin", { pane: title })}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" onClick={() => close(id)} aria-label={t("sampleCase.close", { pane: title })} className={iconButton}>
                      <X className="size-3" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("sampleCase.close", { pane: title })}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex min-w-0 flex-col gap-2 px-3 py-2.5 text-[12.5px]">
                {rows ? (
                  rows.map((row) => (
                    <div key={row.title} className="flex flex-col gap-1">
                      <div className="flex items-start gap-2">
                        {row.tag && <SeverityChip sev={row.tag.sev}>{row.tag.label}</SeverityChip>}
                        <span className="min-w-0 flex-1">
                          {row.title}
                          {row.detail && <small className="block text-[11px] leading-snug text-muted-foreground">{row.detail}</small>}
                        </span>
                        {row.value && <span className="shrink-0 font-mono text-[11.5px] tabular-nums">{row.value}</span>}
                      </div>
                      {row.meter !== undefined && (
                        <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
                          <div className="h-full bg-foreground" style={{ width: `${row.meter}%` }} />
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <>
                    <p className="m-0 text-[12px] leading-normal text-muted-foreground">{info?.description}</p>
                    <p className="m-0 text-[12px] leading-normal text-muted-foreground">{t("sampleCase.emptyPane")}</p>
                  </>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <Sheet open={catalogOpen} onOpenChange={setCatalogOpen}>
        <SheetContent side="right" className="flex flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="font-['Libre_Caslon_Text'] text-[22px] font-light">{t("sampleCase.addPaneTitle")}</SheetTitle>
            <SheetDescription>{t("sampleCase.addPaneBody")}</SheetDescription>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4">
            {catalog.map(({ category, panes }) => (
              <div key={category} className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">
                  {tTerminal(PANE_CATEGORY_META[category].labelKey)}
                </span>
                {panes.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => add(id)}
                    className={`flex cursor-pointer flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left hover:border-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      grid.includes(id) ? "border-brand-gold" : "border-border"
                    }`}
                  >
                    <span className="text-[12.5px] font-semibold">
                      {PANEL_TITLES[id]}
                      {grid.includes(id) && <span className="font-normal text-muted-foreground"> · {t("sampleCase.onGrid")}</span>}
                    </span>
                    <span className="text-[11.5px] leading-snug text-muted-foreground">{PANE_INFO[id]?.description}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
