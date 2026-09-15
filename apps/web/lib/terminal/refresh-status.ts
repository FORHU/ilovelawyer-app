import type { AiJobStatus } from "@/lib/terminal/mutations"

/** Whether the Legal Terminal header should show "Updating analysis…" — true whenever a
 * caseRefresh job is IN_PROGRESS. There is no manual "Refresh analysis" trigger in the UI
 * anymore (auto-refresh on corpus change replaced it) — every IN_PROGRESS job here is a
 * background one, so there is nothing left to distinguish it from. */
export function shouldShowUpdatingAnalysis(jobStatus: AiJobStatus["status"] | undefined): boolean {
  return jobStatus === "IN_PROGRESS"
}
