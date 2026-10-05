import { useState } from "react"
import { useCurrentUserQuery } from "@/lib/user/mutations"
import { useProductTourQuery, type TourTrack } from "@/lib/tour/queries"

// An account this new still gets its first-visit tours when their saved progress can't be
// loaded (the API is down, or its migration hasn't run) — a new user must never miss them.
const NEW_ACCOUNT_MS = 24 * 60 * 60 * 1000

/** Whether this is the user's first visit to the page whose tour is `track` — i.e. the tour
 * should start on its own. Undecided (false) until their progress has loaded. */
export function useIsFirstVisit(track: TourTrack | null): boolean {
  const { data, isError } = useProductTourQuery(track ?? "consultation", !!track)
  const { data: me } = useCurrentUserQuery()
  // Read the clock once, when the page opens — not on every render.
  const [openedAt] = useState(() => Date.now())
  if (!track) return false
  if (data) return data.status === "NOT_STARTED"
  return isError && !!me && openedAt - new Date(me.createdAt).getTime() < NEW_ACCOUNT_MS
}
