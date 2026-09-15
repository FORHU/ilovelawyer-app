"use client"
import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@workspace/ui/components/sheet"

export const chipClass = (selected: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none ${
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
  }`

interface FilterOption {
  value: string
  label: string
}

type FilterChipGroupProps =
  | {
      label: string
      options: FilterOption[]
      mode: "single"
      allLabel: string
      selected: string | null
      onSelect: (value: string | null) => void
    }
  | {
      label: string
      options: FilterOption[]
      mode: "multi"
      allLabel: string
      selected: string[]
      onToggle: (value: string) => void
      onClear: () => void
    }

/**
 * One filter group (Case Type / Topics / Court on the Library browse page). Desktop keeps the
 * original inline wrapped-chip row unchanged; below `sm` that row would wrap into a dozen-plus
 * cramped lines for a facet like Court (24 options), so mobile instead collapses to one summary
 * button that opens a Sheet with the same chips laid out with room to breathe. Selecting a chip
 * still applies immediately either way — the sheet is just closed via Done afterward.
 */
export function FilterChipGroup(props: FilterChipGroupProps) {
  const { t } = useTranslation("library")
  const { label, options } = props
  const [open, setOpen] = useState(false)

  const isSelected = (value: string) =>
    props.mode === "single" ? props.selected === value : props.selected.includes(value)

  const handlePick = (value: string) => {
    if (props.mode === "single") props.onSelect(props.selected === value ? null : value)
    else props.onToggle(value)
  }

  const summary =
    props.mode === "single"
      ? (props.selected ? options.find((o) => o.value === props.selected)?.label : null) ?? props.allLabel
      : props.selected.length > 0
        ? t("lawSearch.filterSelectedCount", { count: props.selected.length })
        : props.allLabel

  const isAllSelected = props.mode === "single" ? props.selected === null : props.selected.length === 0

  const handleClearAll = () => {
    if (props.mode === "single") props.onSelect(null)
    else props.onClear()
  }

  const chips = (
    <>
      <button type="button" onClick={handleClearAll} className={chipClass(isAllSelected)}>
        {props.allLabel}
      </button>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => handlePick(o.value)} className={chipClass(isSelected(o.value))}>
          {o.label}
        </button>
      ))}
    </>
  )

  // Sheet content: a single-column list of full-width rows (not the pill/chip grid) — far
  // easier to scan and tap through 24 options than a wrapped grid of variable-width pills.
  // bg-muted collapses to the flat --background in dark mode (see globals.css), so the selected
  // row needs an explicit dark-mode fill (dark:bg-white/10) or it'd be invisible there.
  const listRowClass = (selected: boolean) =>
    `flex w-full items-center justify-between gap-2 rounded-lg px-3.5 py-2.5 text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:bg-muted ${
      selected ? "bg-muted dark:bg-white/10 text-foreground font-medium" : "text-foreground hover:bg-muted/50 dark:hover:bg-overlay-hover"
    }`

  const listRows = (
    <div className="flex flex-1 flex-col overflow-y-auto -mx-1">
      <button
        type="button"
        onClick={() => {
          handleClearAll()
          if (props.mode === "single") setOpen(false)
        }}
        className={listRowClass(isAllSelected)}
      >
        {props.allLabel}
        {isAllSelected && <Check className="size-4 shrink-0" aria-hidden="true" />}
      </button>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            handlePick(o.value)
            if (props.mode === "single") setOpen(false)
          }}
          className={listRowClass(isSelected(o.value))}
        >
          {o.label}
          {isSelected(o.value) && <Check className="size-4 shrink-0" aria-hidden="true" />}
        </button>
      ))}
    </div>
  )

  return (
    <>
      {/* Desktop/tablet — unchanged inline wrapped row. */}
      <div className="hidden sm:flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">{label}</span>
        {chips}
      </div>

      {/* Mobile — collapses to a summary button that opens the full list in a Sheet. */}
      <div className="sm:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-border px-3.5 py-2.5 text-sm text-foreground transition-colors hover:border-foreground/40"
            >
              <span className="truncate">
                <span className="font-medium">{label}:</span> <span className="text-muted-foreground">{summary}</span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{label}</SheetTitle>
            </SheetHeader>
            {listRows}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-auto inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary px-5 py-2.5 text-xs font-semibold tracking-wider text-primary-foreground uppercase transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              {t("lawSearch.filterDone")}
            </button>
          </SheetContent>
        </Sheet>
      </div>
    </>
  )
}
