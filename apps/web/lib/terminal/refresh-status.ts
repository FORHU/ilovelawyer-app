import type { AiJobStatus } from "@/lib/terminal/mutations"

/** Whether the Legal Terminal header should show "Updating analysis…" — true while any of the
 * background jobs that follow a document change is IN_PROGRESS: the caseRefresh pipeline and the
 * damages extraction (DamagesExtractSvc), which run side by side after an upload and read as one
 * "the case is being analysed" to the lawyer. There is no manual "Refresh analysis" trigger in the
 * UI anymore (auto-refresh on corpus change replaced it) — every IN_PROGRESS job here is a
 * background one, so there is nothing left to distinguish it from. */
export function shouldShowUpdatingAnalysis(...jobStatuses: (AiJobStatus["status"] | undefined)[]): boolean {
  return jobStatuses.some((status) => status === "IN_PROGRESS")
}
