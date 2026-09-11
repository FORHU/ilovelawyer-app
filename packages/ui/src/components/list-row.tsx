import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The Cases-page row: stacked card on mobile, a grid row on desktop, driven by one
 * `gridTemplateColumns` string so the row and its header (`ListRowHeader`) always line up.
 */
function ListRow({
  columns,
  className,
  ...props
}: React.ComponentProps<"div"> & { columns: string }) {
  return (
    <div
      style={{ "--list-row-columns": columns } as React.CSSProperties}
      className={cn(
        "group/row flex flex-col gap-3 border-b border-border px-4 py-4 transition-colors md:grid md:[grid-template-columns:var(--list-row-columns)] md:items-center md:gap-4 md:rounded-lg md:hover:bg-card",
        className
      )}
      {...props}
    />
  )
}

function ListRowHeader({
  columns,
  className,
  ...props
}: React.ComponentProps<"div"> & { columns: string }) {
  return (
    <div
      style={{ "--list-row-columns": columns } as React.CSSProperties}
      className={cn(
        "hidden md:grid md:[grid-template-columns:var(--list-row-columns)] gap-4 px-4 py-3 border-b border-border text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

export { ListRow, ListRowHeader }
