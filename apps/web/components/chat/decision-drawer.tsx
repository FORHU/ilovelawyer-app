"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@workspace/ui/components/sheet"
import { DecisionConfidenceBadge, DecisionDetailBody } from "@/components/shared/decision-detail"
import type { DecisionRecordPayload } from "@/lib/terminal/types"

/** Opened by clicking a highlighted conclusion in a legal chat reply (see the "Why?" anchor
 * highlighting in assistant-message.tsx) — shows the same audited rule/evidence/alternatives
 * detail as the case-level Decisions panel, but read-only: this decision hasn't necessarily been
 * promoted into the case graph (only happens when the consultation is case-linked), so there's
 * no row here to dispute. Disputing lives in the Decisions panel once the case Refresh has run.
 */
export function DecisionDrawer({
  decision,
  onOpenChange,
}: {
  decision: DecisionRecordPayload | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={!!decision} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        {decision && (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 leading-5">{decision.conclusion}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-3 text-sm">
              <DecisionConfidenceBadge confidence={decision.confidence} />
              <DecisionDetailBody payload={decision} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
