import { useState } from "react"
import { useTranslation } from "react-i18next"
import { MessageSquareWarning, RotateCcw } from "lucide-react"
import { AnnotationThread } from "@/components/shared/annotation-thread"
import { DecisionConfidenceBadge, DecisionDetailBody } from "@/components/shared/decision-detail"
import { useDisputeDecisionMutation, useReactivateDecisionMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, DecisionRecord } from "@/lib/terminal/types"
import { EmptyNote, PanelBody, fieldClass, ghostBtnClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// The "Why?" behind one conclusion in a legal answer — every rule[].url and evidence*[].docId
// was already verified against that turn's retrieved sources by chat-wonder-v2-api before this
// row was ever written, so `verified` here is read-only, never re-derived client-side (see
// DecisionRecordPayload in lib/terminal/types.ts). Populated automatically per legal chat turn;
// unlike Red Team / Case Reconstruction there is no "Generate" action on this panel.
export function DecisionsPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const dispute = useDisputeDecisionMutation(caseId)
  const reactivate = useReactivateDecisionMutation(caseId)
  const decisions = snapshot.decisions ?? []

  if (decisions.length === 0) {
    return (
      <PanelBody gap="3">
        <EmptyNote>{t("noDecisions")}</EmptyNote>
      </PanelBody>
    )
  }

  return (
    <PanelBody gap="3">
      <ul className="space-y-3">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            caseId={caseId}
            decision={decision}
            onDispute={(note) => dispute.mutate({ id: decision.id, note })}
            onReactivate={() => reactivate.mutate({ id: decision.id })}
            isPending={dispute.isPending || reactivate.isPending}
          />
        ))}
      </ul>
    </PanelBody>
  )
}

function DecisionCard({
  caseId,
  decision,
  onDispute,
  onReactivate,
  isPending,
}: {
  caseId: string
  decision: DecisionRecord
  onDispute: (note?: string) => void
  onReactivate: () => void
  isPending: boolean
}) {
  const { t } = useTranslation("terminal")
  const [disputing, setDisputing] = useState(false)
  const [note, setNote] = useState("")
  const [showAnnotations, setShowAnnotations] = useState(false)
  const p = decision.payload
  const disputed = decision.status === "DISPUTED"

  return (
    <li
      className={`rounded-md border px-3 py-2.5 ${disputed ? "border-orange-500/40 bg-orange-500/5" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 leading-5 font-medium text-foreground">
          {p.conclusion}
        </p>
        <DecisionConfidenceBadge confidence={p.confidence} />
      </div>

      {disputed && (
        <p className="mt-1.5 flex items-start gap-1 text-[10px] font-semibold tracking-[1px] text-orange-400">
          <MessageSquareWarning className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="uppercase">{t("decisionStatusDisputed")}</span>
          {decision.disputeNote ? <span className="normal-case">: {decision.disputeNote}</span> : null}
        </p>
      )}

      <div className="mt-2 space-y-2">
        <DecisionDetailBody payload={p} />
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAnnotations((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {t("notes")}
        </button>
        {disputed ? (
          <button
            type="button"
            onClick={onReactivate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {t("decisionReactivate")}
          </button>
        ) : disputing ? (
          <form
            className="flex w-full flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              onDispute(note.trim() || undefined)
              setDisputing(false)
              setNote("")
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("decisionDisputeNotePlaceholder")}
              className={fieldClass}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDisputing(false)
                  setNote("")
                }}
                className={ghostBtnClass}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={primaryBtnClass}
              >
                {t("decisionDispute")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDisputing(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
          >
            <MessageSquareWarning className="h-3 w-3" aria-hidden="true" />
            {t("decisionDispute")}
          </button>
        )}
      </div>

      {showAnnotations && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <AnnotationThread
            caseId={caseId}
            targetType="DECISION"
            targetId={decision.id}
          />
        </div>
      )}
    </li>
  )
}
