import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

interface EmptyStateProps {
  /** A lucide icon element, e.g. <Bell />. Sized and colored by the badge. */
  icon: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** The one call to action, if any — usually a gold `Button variant="accent"`. */
  action?: React.ReactNode
  className?: string
}

/** The empty-state pattern from DESIGN.md: a gold icon in a round bordered badge, a Libre Caslon
 * heading, muted body copy and at most one action, inside a dashed rounded box. Use this instead
 * of a bare "No results" line. */
function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-14 text-center",
        className
      )}
    >
      <span
        aria-hidden="true"
        className="mb-1 inline-flex size-11 items-center justify-center rounded-full border border-border bg-card text-brand-gold [&_svg]:size-4"
      >
        {icon}
      </span>
      <h3 className="font-['Libre_Caslon_Text'] text-[19px] font-light tracking-[-0.02em] text-foreground">{title}</h3>
      {description && <p className="max-w-[420px] text-[13px] leading-relaxed text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export { EmptyState }
