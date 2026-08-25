import { Loader2 } from "lucide-react"

// Shown while auth/approval state is still resolving (protected-route guard,
// /account-pending) — replaces a blank flash with a visible, deliberate wait so a
// PENDING/DENIED/BLOCKED user never sees a frame of real app content first.
export function LoadingScreen() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <Loader2 className="text-muted-foreground size-6 animate-spin" aria-label="Loading" />
    </div>
  )
}
