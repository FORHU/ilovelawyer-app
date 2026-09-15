import type { AiJobStatus } from "@/lib/terminal/mutations"

/** Whether the Legal Terminal header should show "Updating analysis…" — true only when a
 * caseRefresh job is IN_PROGRESS and it wasn't this tab's own button click that's driving it
 * (that case already gets its own spinner/label on the Refresh button itself, via
 * useRefreshSnapshotMutation's isPending). This is what actually distinguishes "background work
 * is happening" from "I just clicked Refresh" — covers a corpus change auto-triggering a
 * refresh, another tab/user clicking Refresh, or this page loading mid-run, anything the
 * existing 3s useAiJobStatus poll can see that this tab's own pending flag can't. */
export function shouldShowUpdatingAnalysis(refreshIsPending: boolean, jobStatus: AiJobStatus["status"] | undefined): boolean {
  return !refreshIsPending && jobStatus === "IN_PROGRESS"
}
