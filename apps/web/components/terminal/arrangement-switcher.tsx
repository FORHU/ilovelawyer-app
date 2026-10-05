"use client"

import { Columns3, LayoutPanelLeft, Move, PanelTop, type LucideIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import type { ArrangementValue } from "@/lib/terminal/types"

export const ARRANGEMENTS: { id: ArrangementValue; labelKey: string; icon: LucideIcon }[] = [
  { id: "free", labelKey: "arrangementFree", icon: Move },
  { id: "columns", labelKey: "arrangementColumns", icon: Columns3 },
  { id: "tabs", labelKey: "arrangementTabs", icon: PanelTop },
  { id: "focus", labelKey: "arrangementFocus", icon: LayoutPanelLeft },
]

export const COLUMN_COUNT_OPTIONS = [2, 3, 4]

// Free/Columns/Tabs/Focus mode switcher, plus (when Columns is active) the column-count picker —
// shared by the primary Terminal chrome and every canvas window's header bar so both write the
// same arrangement UI to whichever layout scope they own (legal-terminal.tsx's top-level
// arrangement/columnCount, or a canvas window's own screenLayouts[screenIndex] entry).
export function ArrangementSwitcher({
  arrangement,
  onSetArrangement,
  columnCount,
  onSetColumnCount,
  t,
}: {
  arrangement: ArrangementValue
  onSetArrangement: (next: ArrangementValue) => void
  columnCount: number
  onSetColumnCount: (count: number) => void
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  return (
    <>
      <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
        {ARRANGEMENTS.map(({ id, labelKey, icon: Icon }) => {
          const active = arrangement === id
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSetArrangement(id)}
                  aria-label={t(labelKey)}
                  aria-pressed={active}
                  className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-brand-gold text-brand-gold-foreground" : "text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(labelKey)}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
      {arrangement === "columns" && (
        <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5">
          {COLUMN_COUNT_OPTIONS.map((count) => {
            const active = columnCount === count
            return (
              <Tooltip key={count}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onSetColumnCount(count)}
                    aria-pressed={active}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold transition-colors ${
                      active ? "bg-brand-gold text-brand-gold-foreground" : "text-muted-foreground hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
                    }`}
                  >
                    {count}
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("columnCount", { count })}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      )}
    </>
  )
}
