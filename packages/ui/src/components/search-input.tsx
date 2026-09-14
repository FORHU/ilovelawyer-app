import * as React from "react"
import { Search } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/** The Cases-page pill search box. text-base on mobile avoids iOS Safari's auto-zoom-on-focus. */
const SearchInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative w-full flex items-center">
        <span className="absolute left-4 text-muted-foreground">
          <Search className="w-4 h-4" aria-hidden="true" />
        </span>
        <input
          ref={ref}
          type="text"
          className={cn(
            "w-full bg-card border border-border rounded-full h-11 sm:h-10 pl-11 pr-4 outline-none font-['Inter'] text-base sm:text-[13px] hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors",
            className
          )}
          {...props}
        />
      </div>
    )
  }
)
SearchInput.displayName = "SearchInput"

export { SearchInput }
