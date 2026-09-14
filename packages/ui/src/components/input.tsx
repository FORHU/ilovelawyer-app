import * as React from "react"
import { AlertCircle } from "lucide-react"

import { cn } from "@workspace/ui/lib/utils"

/**
 * The bare styled input, extracted from edit-case-modal.tsx's field recipe — the most-used
 * generic text-field convention in the app. text-base on mobile avoids iOS Safari's
 * auto-zoom-on-focus; sm:text-sm restores the compact desktop size once that's no longer a risk
 * (same reasoning as SearchInput). Pass `invalid` for the error border/ring state instead of
 * reaching for a raw conditional className at each call site.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { invalid?: boolean }>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "w-full rounded-xl border bg-transparent px-3 py-2.5 outline-none text-base sm:text-sm transition-colors focus:ring-2",
          invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
            : "border-border hover:border-foreground/30 focus:border-foreground focus:ring-foreground/5",
          className
        )}
        aria-invalid={invalid}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

interface TextFieldProps extends React.ComponentProps<"input"> {
  label: React.ReactNode
  /** Optional hint shown under the label, above the input. */
  helperText?: React.ReactNode
  /** Shown below the input instead of `helperText` when present, with the error icon/border. */
  errorText?: React.ReactNode
  containerClassName?: string
}

/**
 * Label-above / helper-or-error-below field, per DESIGN.md's form pattern — label ABOVE input,
 * error text BELOW, never placeholder-as-label. Wraps `Input`; use `Input` directly only when
 * you need a bespoke label layout `TextField` doesn't cover (e.g. edit-case-modal's party rows).
 */
const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, helperText, errorText, containerClassName, id, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId
    const errorId = errorText ? `${inputId}-error` : undefined

    return (
      <div className={cn("flex flex-col gap-2", containerClassName)}>
        <label htmlFor={inputId} className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
          {label}
        </label>
        {helperText && !errorText && <p className="text-xs text-muted-foreground">{helperText}</p>}
        <Input
          ref={ref}
          id={inputId}
          invalid={!!errorText}
          aria-describedby={errorId}
          {...props}
        />
        {errorText && (
          <p id={errorId} className="flex items-center gap-1.5 text-xs text-red-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            {errorText}
          </p>
        )}
      </div>
    )
  }
)
TextField.displayName = "TextField"

export { Input, TextField }
