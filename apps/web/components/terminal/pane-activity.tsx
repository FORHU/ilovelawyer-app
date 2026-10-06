import { createContext, useContext, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { useAiJobStatus } from "@/lib/terminal/mutations"
import type { CaseSnapshot, PanelId } from "@/lib/terminal/types"
import { advanceDamagesTracker, damagesActivityOf, damagesItemCount, initialDamagesTracker } from "@/lib/terminal/damages-activity"

/**
 * Background work a pane is waiting on, shown wherever the pane is named — its header in every
 * arrangement, its tab, its Focus card, the panel library — so a lawyer knows new content is
 * coming (or has just landed) even with the pane closed or out of view.
 *
 *   busy  — a job that will change the pane is running now.
 *   fresh — that job finished and added something while the pane wasn't on screen.
 */
export type PaneActivity = "busy" | "fresh"

export const PaneActivityContext = createContext<Partial<Record<PanelId, PaneActivity>>>({})

/** A small spinner (busy) or dot (fresh) next to a pane's name. Renders nothing otherwise. */
export function PaneActivityMark({ panelId }: { panelId: PanelId }) {
  const { t } = useTranslation("terminal")
  const activity = useContext(PaneActivityContext)[panelId]
  if (activity === "busy") {
    return (
      <span className="inline-flex shrink-0 items-center text-progress" title={t("paneUpdating")}>
        <Loader2 className="h-3 w-3 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="sr-only">{t("paneUpdating")}</span>
      </span>
    )
  }
  if (activity === "fresh") {
    return (
      <span className="inline-flex shrink-0 items-center" title={t("paneFresh")}>
        <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
        <span className="sr-only">{t("paneFresh")}</span>
      </span>
    )
  }
  return null
}

/**
 * Tracks the damages extraction job (DamagesExtractSvc, AI job kind "damagesExtract") for the
 * Terminal — see advanceDamagesTracker for the busy / fresh rules. Mounting the job status here also
 * means the snapshot refreshes when the job ends even with the pane closed (useAiJobStatus
 * invalidates it on IN_PROGRESS → DONE).
 *
 * The tracker is adjusted during render from its inputs (React's "storing information from
 * previous renders" pattern) rather than in an effect, so there is no extra render per change.
 */
export function useDamagesActivity(
  caseId: string,
  snapshot: CaseSnapshot | undefined,
  snapshotUpdatedAt: number,
  paneVisible: boolean,
): PaneActivity | undefined {
  const job = useAiJobStatus(caseId, "damagesExtract")
  const [tracker, setTracker] = useState(() => initialDamagesTracker(snapshotUpdatedAt))
  const next = advanceDamagesTracker(tracker, {
    status: job.data?.status,
    jobUpdatedAt: job.dataUpdatedAt,
    count: damagesItemCount(snapshot),
    snapshotUpdatedAt,
    paneVisible,
  })
  if (next !== tracker) setTracker(next)
  return damagesActivityOf(next)
}
