import type { ClientRequestStatus } from "@/lib/client-handoff"
import type { ClientRequestForLawyer } from "./types"

const HOUR = 3_600_000
const MINUTE = 60_000

/** An open request closing within this many hours reads as urgent on its card. */
export const CLOSING_SOON_HOURS = 6

/** Milliseconds until `iso` (never below 0), or null when there's no time to count to. 0 means it has run out. */
export function timeLeft(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null
  return Math.max(0, new Date(iso).getTime() - now)
}

/** Whether a time left counts as closing soon. */
export function closingSoon(ms: number): boolean {
  return ms < CLOSING_SOON_HOURS * HOUR
}

/** A time left as it reads on a card, rounded down so it never overstates: whole hours, then whole
 * minutes in the last hour. Both are 0 in the last minute. */
export function leftToShow(ms: number): { hours: number } | { minutes: number } {
  return ms >= HOUR ? { hours: Math.floor(ms / HOUR) } : { minutes: Math.floor(ms / MINUTE) }
}

/** How many of the intake's lawyer-readiness criteria are met, or null before the check has run. */
export function readiness(request: Pick<ClientRequestForLawyer, "brief">): { met: number; total: number } | null {
  const criteria = request.brief.intake?.completeness?.criteria
  if (!criteria?.length) return null
  return { met: criteria.filter((c) => c.met).length, total: criteria.length }
}

export type InboxSort = "closing" | "newest"

/** The open requests in the order asked for. "Closing soonest" puts the ones nearest their 48-hour
 * expiry first; a request with no expiry goes last. Never mutates its input. */
export function sortRequests<T extends Pick<ClientRequestForLawyer, "routedAt" | "routingExpiresAt">>(requests: T[], sort: InboxSort): T[] {
  const time = (iso: string | null, fallback: number) => (iso ? new Date(iso).getTime() : fallback)
  return [...requests].sort((a, b) =>
    sort === "closing"
      ? time(a.routingExpiresAt, Infinity) - time(b.routingExpiresAt, Infinity)
      : time(b.routedAt, 0) - time(a.routedAt, 0)
  )
}

/** Where a request is on the five-step line: how many steps are behind it. A closed request has
 * finished them all; one that expired or was withdrawn has no line to show (null). */
export function stepPosition(status: ClientRequestStatus): number | null {
  switch (status) {
    case "REQUESTED":
    case "ROUTED":
      return 0
    case "CLAIMED":
      return 1
    case "QUOTED":
      return 2
    case "CONFIRMED":
      return 3
    case "ENGAGED":
      return 4
    case "CLOSED":
      return 5
    case "EXPIRED":
    case "WITHDRAWN":
      return null
  }
}
