import type { AiJobStatus } from "./mutations"

/** The "caseRefresh" job's stage as each wave after the first starts (null during wave 1) —
 * mirrors ilovelawyer-api's CASE_REFRESH_STAGE in case-refresh.service.ts. */
export const CASE_REFRESH_STAGE = { wave2: "wave2", wave3: "wave3" } as const

/**
 * Whether a running case analysis ("Refresh analysis", or the automatic run after an upload) is
 * still before the end of the wave that rewrites `piece`: wave 1 for the timeline's dates (case
 * strategy), wave 2 for the case map. Once that wave is over the piece is final for this run, so
 * it stops showing as updating instead of spinning until Red Team and the Audio Overview finish
 * too. An API that doesn't report stages yet leaves `stage` null, which reads as "still rewriting"
 * for the whole run — the old behavior.
 */
export function caseRefreshRewriting(job: AiJobStatus | null | undefined, piece: "timeline" | "mindMap"): boolean {
  if (job?.status !== "IN_PROGRESS") return false
  if (piece === "timeline") return !job.stage
  return job.stage !== CASE_REFRESH_STAGE.wave3
}
