import { useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import type { TraceEvent, TraceTurn } from "@/lib/terminal/types"

export const traceKeys = {
  all: ["terminal", "trace"] as const,
  turns: (caseId: string) => [...traceKeys.all, "turns", caseId] as const,
  events: (caseId: string, turnId: string) => [...traceKeys.all, "events", caseId, turnId] as const,
}

/** How often the turn list refreshes while the pane is open — a new question appears here within
 * a few seconds, which is what moves the pager onto it. */
const TURN_LIST_POLL_MS = 5_000
/** How often the newest turn's events refresh, so its steps appear as the answer is written. */
const LIVE_EVENTS_POLL_MS = 2_000
/** A turn counts as still being written for this long after it started. Past it, its events are
 * fetched once and kept: an answer that takes longer than this has stopped being "live" anyway. */
const LIVE_WINDOW_MS = 5 * 60_000

export function isTurnLive(turn: Pick<TraceTurn, "startedAt">, now = Date.now()): boolean {
  return now - Date.parse(turn.startedAt) < LIVE_WINDOW_MS
}

/** Every traced turn of the case, oldest first, each attributed to the member who asked. */
export function useTraceTurnsQuery(caseId: string) {
  return useQuery({
    queryKey: traceKeys.turns(caseId),
    queryFn: async () => (await apiFetch<{ turns: TraceTurn[] }>(`/api/my-cases/${caseId}/trace/turns`)).turns,
    enabled: !!caseId,
    refetchInterval: TURN_LIST_POLL_MS,
  })
}

/** One turn's events in order. `live` keeps polling for steps still being written. */
export function useTraceEventsQuery(caseId: string, turnId: string | undefined, live: boolean) {
  return useQuery({
    queryKey: traceKeys.events(caseId, turnId ?? ""),
    queryFn: async () =>
      (await apiFetch<{ events: TraceEvent[] }>(`/api/my-cases/${caseId}/trace/turns/${encodeURIComponent(turnId!)}`)).events,
    enabled: !!caseId && !!turnId,
    refetchInterval: live ? LIVE_EVENTS_POLL_MS : false,
  })
}
