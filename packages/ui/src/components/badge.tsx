import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@workspace/ui/lib/utils"

const badgeVariants = cva(
  "inline-flex shrink-0 items-center gap-1 px-2 py-0.5 font-semibold whitespace-nowrap uppercase",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground",
        success: "bg-emerald-500/15 text-emerald-400",
        warning: "bg-orange-500/15 text-orange-400",
        danger: "bg-red-500/15 text-red-300",
      },
      // "rounded" is the terminal/evidence-panel look (font-mono, tight tracking). "pill" is
      // the rounded-full status-badge look used across the rest of the app (e.g. RAG status) —
      // added so those call sites can adopt Badge instead of hand-rolling the same shape.
      shape: {
        rounded: "rounded font-mono text-[9px] tracking-[1px]",
        pill: "rounded-full text-[10px] tracking-wide",
      },
    },
    defaultVariants: {
      tone: "neutral",
      shape: "rounded",
    },
  }
)

function Badge({
  className,
  tone = "neutral",
  shape = "rounded",
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-tone={tone}
      data-shape={shape}
      className={cn(badgeVariants({ tone, shape, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
