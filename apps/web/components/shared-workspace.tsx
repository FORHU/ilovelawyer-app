"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Eye, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { SHARED_WORKSPACE_PATH, useAuthStore } from "@/lib/store/auth.store"
import { useSwitchWorkspace } from "@/lib/organizations/mutations"

/** Leaves someone else's portfolio as soon as this tab goes anywhere a share doesn't reach (see
 * SHARED_WORKSPACE_PATH), so the rest of the app (calendar, chat, the case list) is never asked
 * for under the owner's workspace. Mounted once in the protected layout.
 *
 * It reacts to navigation, not to entering: a shared case is opened from the case list, which
 * enters the owner's portfolio a moment before the Terminal route takes over. */
export function SharedWorkspaceGuard() {
  const pathname = usePathname()
  const inShared = useAuthStore((s) => s.workspace === "shared")
  const switchWorkspace = useSwitchWorkspace()
  const enteredOn = useRef<string | null>(null)
  useEffect(() => {
    if (!inShared || !pathname) {
      enteredOn.current = null
      return
    }
    if (enteredOn.current === null || SHARED_WORKSPACE_PATH.test(pathname)) {
      enteredOn.current = pathname
      return
    }
    if (pathname !== enteredOn.current) switchWorkspace("organization")
  }, [inShared, pathname, switchWorkspace])
  return null
}

/** Shown in the header while reading a shared case: whose it is, that it's view only, and one
 * click back to the user's own cases. */
export function SharedWorkspacePill() {
  const { t } = useTranslation("case-portfolio")
  const router = useRouter()
  const shared = useAuthStore((s) => (s.workspace === "shared" ? s.shared : null))
  if (!shared) return null

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => router.push("/homepage/case-portfolio?view=shared")}
          className="inline-flex h-8 max-w-[260px] cursor-pointer items-center gap-1.5 rounded-full border border-brand-gold/40 bg-brand-gold/10 pl-3 pr-2 text-[11px] font-semibold text-amber-700 transition-colors hover:bg-brand-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 dark:text-brand-gold"
        >
          <Eye className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("portfolioView.sharedPill", { name: shared.ownerName })}</span>
          <X className="h-3 w-3 shrink-0" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent>{t("portfolioView.sharedPillTooltip", { name: shared.ownerName })}</TooltipContent>
    </Tooltip>
  )
}
