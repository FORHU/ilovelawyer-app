"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "radix-ui"
import { Check, ChevronDown } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

function Select({ ...props }: React.ComponentProps<typeof SelectPrimitive.Root>) {
  return <SelectPrimitive.Root data-slot="select" {...props} />
}

function SelectValue({ ...props }: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />
}

function SelectTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm text-foreground outline-none transition-colors focus:border-primary data-[placeholder]:text-muted-foreground data-[state=open]:border-primary [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-3.5" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  container,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content> & {
  container?: React.ComponentProps<typeof SelectPrimitive.Portal>["container"]
}) {
  return (
    <SelectPrimitive.Portal container={container}>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        sideOffset={sideOffset}
        className={cn(
          // No zoom-in/out here (unlike popover/dropdown-menu): those are small, so a 95%->100%
          // scale reads as a quick pop. This content is nearly as wide and tall as its full-width
          // trigger, so the same scale reads as the whole box visibly growing open — a plain fade
          // avoids that without losing the open/close transition.
          //
          // max-h caps at 15rem (~6 rows, scrolling past that) rather than letting it grow to
          // fill all --radix-select-content-available-height. A list with a dozen items (e.g.
          // linked cases) otherwise renders tall enough that Radix has to flip it to the opposite
          // side of the trigger to keep it on-screen — on a trigger near the bottom of a short
          // panel, that means the dropdown reopens far away, up near the top of the panel, which
          // reads as the whole thing jumping. Capping the height keeps it small enough to almost
          // always fit on the trigger's own side.
          "bg-card text-foreground border-border animate-in fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 z-50 max-h-[min(15rem,var(--radix-select-content-available-height))] min-w-(--radix-select-trigger-width) overflow-hidden rounded-xl border p-1.5 shadow-lg",
          position === "popper" && "w-full",
          className
        )}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-0.5">{children}</SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg py-2 pl-8 pr-3 text-[13px] outline-none transition-colors",
        "focus:bg-muted dark:focus:bg-overlay-hover",
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-40",
        className
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5" />
        </SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
}

export { Select, SelectValue, SelectTrigger, SelectContent, SelectItem }
