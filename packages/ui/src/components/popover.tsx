"use client"

import * as React from "react"
import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "@workspace/ui/lib/utils"

function Popover({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger({ ...props }: React.ComponentProps<typeof PopoverPrimitive.Trigger>) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  align = "end",
  sideOffset = 8,
  // Radix portals to document.body by default, which escapes any DOM-scoped theme override
  // (e.g. a `dark` class wrapping a specific subtree rather than the document root) — CSS
  // custom properties follow the DOM tree, not the React tree, so a portalled node outside
  // that wrapper falls back to the page's actual theme instead of the override. Pass the
  // wrapper's own node here to keep the popover inside it.
  container,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  container?: React.ComponentProps<typeof PopoverPrimitive.Portal>["container"]
}) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "bg-card text-foreground border-border animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-72 origin-(--radix-popover-content-transform-origin) rounded-lg border p-3 shadow-lg outline-none",
          className
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
