import * as React from "react"

import { cn } from "@workspace/ui/lib/utils"

interface PageHeadingProps {
  /** Small uppercase badge above the title, e.g. "128 cases". Omit for no eyebrow. */
  eyebrow?: React.ReactNode
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Right-aligned slot for the page's one primary action button. */
  action?: React.ReactNode
  className?: string
}

/** The Cases-page section header: eyebrow dot + Libre Caslon title + subtitle, CTA on the right. */
function PageHeading({ eyebrow, title, subtitle, action, className }: PageHeadingProps) {
  return (
    <div className={cn("flex items-end justify-between gap-6 flex-wrap", className)}>
      <div className="flex flex-col gap-3.5">
        {eyebrow && (
          <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
            {eyebrow}
          </span>
        )}
        <h1 className="font-['Libre_Caslon_Text'] text-[23px] sm:text-[clamp(34px,3.6vw,48px)] font-light leading-none tracking-[-0.02em] text-foreground">
          {title}
        </h1>
        {subtitle && (
          <p className="text-muted-foreground text-[13px] sm:text-[15px] leading-relaxed max-w-[520px]">
            {subtitle}
          </p>
        )}
      </div>

      {action}
    </div>
  )
}

export { PageHeading }
