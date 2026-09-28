import type { AiJobStatus } from "@/lib/terminal/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"

/**
 * Whether the Damages & Remedies pane has news, from the damages extraction job's status and the
 * snapshots that follow it. Pure, so the rules are testable without rendering; the Terminal feeds
 * it through useDamagesActivity (components/terminal/pane-activity.tsx).
 *
 *   busy  — the job is running.
 *   fresh — it finished, and the first snapshot after that has more heads or suggested updates
 *           than when it started, while the pane wasn't visible. Cleared once the pane is visible.
 */
export interface DamagesTracker {
  status: AiJobStatus["status"] | undefined
  snapshotAt: number
  /** Item count when the current run started; null when no run is being tracked. */
  baseline: number | null
  /** When the run was seen to finish; the next snapshot after this decides "fresh". */
  finishedAt: number | null
  fresh: boolean
}

export interface DamagesTrackerInput {
  status: AiJobStatus["status"] | undefined
  /** When the job status was last updated (react-query's dataUpdatedAt). */
  jobUpdatedAt: number
  /** Heads + suggested updates in the current snapshot; null while it hasn't loaded. */
  count: number | null
  snapshotUpdatedAt: number
  paneVisible: boolean
}

export function initialDamagesTracker(snapshotUpdatedAt: number): DamagesTracker {
  return { status: undefined, snapshotAt: snapshotUpdatedAt, baseline: null, finishedAt: null, fresh: false }
}

/** What counts as "something new" in the pane: its heads, plus suggested updates on a head. */
export function damagesItemCount(snapshot: CaseSnapshot | undefined): number | null {
  if (!snapshot) return null
  return snapshot.damages.length + snapshot.damages.filter((d) => d.aiProposedBasis).length
}

/** The tracker after these inputs — the same object when nothing changed, so a caller holding it
 * in state can skip the update. */
export function advanceDamagesTracker(tracker: DamagesTracker, input: DamagesTrackerInput): DamagesTracker {
  let next = tracker
  if (input.status !== tracker.status) {
    if (input.status === "IN_PROGRESS") next = { ...next, baseline: input.count ?? 0, finishedAt: null }
    else if (tracker.status === "IN_PROGRESS" && next.baseline !== null) next = { ...next, finishedAt: input.jobUpdatedAt }
    next = { ...next, status: input.status }
  }
  if (input.snapshotUpdatedAt !== tracker.snapshotAt) {
    next = { ...next, snapshotAt: input.snapshotUpdatedAt }
    if (next.baseline !== null && next.finishedAt !== null && input.snapshotUpdatedAt > next.finishedAt && input.count !== null) {
      next = {
        ...next,
        fresh: next.fresh || (!input.paneVisible && input.count > next.baseline),
        baseline: null,
        finishedAt: null,
      }
    }
  }
  if (input.paneVisible && next.fresh) next = { ...next, fresh: false }
  return next
}

export function damagesActivityOf(tracker: DamagesTracker): "busy" | "fresh" | undefined {
  if (tracker.status === "IN_PROGRESS") return "busy"
  return tracker.fresh ? "fresh" : undefined
}
