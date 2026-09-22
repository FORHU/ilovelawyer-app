import { AlertCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"

// Standardized isError fallback so a failed fetch never renders a silently
// broken/empty page — see the isLoading skeleton this pairs with in each tab.
export function ErrorState({ message, retryLabel, onRetry }: { message: string; retryLabel: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
      <p className="text-sm text-red-600">{message}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onRetry}
            className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
          >
            {retryLabel}
          </button>
        </TooltipTrigger>
        <TooltipContent>{retryLabel}</TooltipContent>
      </Tooltip>
    </div>
  )
}
