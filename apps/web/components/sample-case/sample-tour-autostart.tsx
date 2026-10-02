"use client"

import { useEffect } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useAuthStore } from "@/lib/store/auth.store"
import { useTourStore } from "@/lib/store/tour.store"
import { useIsFirstVisit } from "@/lib/tour/use-first-visit"
import { sampleCaseHref, type SampleTourTrack } from "@/lib/sample-case/tours"

// One automatic start per tour per account per tab — if saving the "seen" status fails, the user
// isn't sent to the sample case every time they open a case. Keyed by account, so someone who
// signs in after another user in the same tab still gets their own first-visit tours.
const started = new Set<string>()

/** On the user's first visit to a case's Workspace ("studio") or Legal Terminal ("terminal"),
 * takes them to that part's tour on the sample case, which brings them straight back here when
 * it ends. A history replace, not a push, so Back from the case doesn't land on the sample. */
export function SampleTourAutoStart({ track }: { track: SampleTourTrack }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const firstVisit = useIsFirstVisit(track)
  const userId = useAuthStore((s) => s.user?.id)
  // Never yank the user away while the guide is open or pointing at something.
  const guideBusy = useTourStore((s) => s.guideOpen || s.guideSpot !== null)

  useEffect(() => {
    if (!firstVisit || guideBusy || !userId) return
    const key = `${userId}:${track}`
    if (started.has(key)) return
    started.add(key)
    const here = params.size ? `${pathname}?${params}` : pathname
    router.replace(sampleCaseHref(track, here))
  }, [firstVisit, guideBusy, params, pathname, router, track, userId])

  return null
}
