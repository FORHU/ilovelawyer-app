import { useState, type ComponentPropsWithoutRef } from "react"
import { useTranslation } from "react-i18next"
import { MessageSquareWarning, RotateCcw } from "lucide-react"
import { AnnotationThread } from "@/components/shared/annotation-thread"
import { DecisionConfidenceBadge, DecisionDetailBody } from "@/components/shared/decision-detail"
import { useDisputeDecisionMutation, useReactivateDecisionMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, DecisionRecord } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, fieldClass, ghostBtnClass, primaryBtnClass } from "@/components/terminal/panel-kit"

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

  return (
    <PanelBody gap="3">
      <PanelRowList empty={<EmptyNote>{t("noDecisions")}</EmptyNote>}>
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            caseId={caseId}
            decision={decision}
            onDispute={(note) => dispute.mutate({ id: decision.id, note })}
            onReactivate={() => reactivate.mutate({ id: decision.id })}
            isPending={dispute.isPending || reactivate.isPending}
            isError={dispute.isError || reactivate.isError}
          />
        ))}
      </PanelRowList>
    </PanelBody>
  )
}

function DecisionCard({
  caseId,
  decision,
  onDispute,
  onReactivate,
  isPending,
  isError,
  ...rest
}: {
  caseId: string
  decision: DecisionRecord
  onDispute: (note?: string) => void
  onReactivate: () => void
  isPending: boolean
  isError: boolean
} & ComponentPropsWithoutRef<"li">) {
  const { t } = useTranslation("terminal")
  const [disputing, setDisputing] = useState(false)
  const [note, setNote] = useState("")
  const [showAnnotations, setShowAnnotations] = useState(false)
  const p = decision.payload
  const disputed = decision.status === "DISPUTED"

  return (
    <PanelRow {...rest} className={`@container flex-col items-start ${disputed ? "bg-riskmed/5" : ""}`}>
      {/* Stacked (badge above, full-width text) below the row's own `@sm` — not the viewport's —
       * since these panels live inside resizable desktop panes that can be much narrower than
       * the viewport implies. Side-by-side once there's room; `flex-col-reverse` keeps the badge
       * visually first without reordering the DOM. */}
      <div className="flex w-full flex-col-reverse items-start gap-1.5 @sm:flex-row @sm:items-start @sm:justify-between @sm:gap-2">
        <p className="leading-5 font-medium text-foreground @sm:flex-1">
          {p.conclusion}
        </p>
        <DecisionConfidenceBadge confidence={p.confidence} />
      </div>

      {disputed && (
        <p className="flex items-start gap-1 text-[10px] font-semibold tracking-[1px] text-riskmed">
          <MessageSquareWarning className="mt-px h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="uppercase">{t("decisionStatusDisputed")}</span>
          {decision.disputeNote ? <span className="normal-case">: {decision.disputeNote}</span> : null}
        </p>
      )}

      <div className="w-full">
        <DecisionDetailBody payload={p} />
      </div>

      <div className="flex w-full items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAnnotations((s) => !s)}
          className={ghostBtnClass}
        >
          {t("notes")}
        </button>
        {disputed ? (
          <button
            type="button"
            onClick={onReactivate}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
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
              aria-label={t("decisionDisputeNotePlaceholder")}
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
            className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
          >
            <MessageSquareWarning className="h-3 w-3" aria-hidden="true" />
            {t("decisionDispute")}
          </button>
        )}
      </div>
      <MutationError show={isError} />

      {showAnnotations && (
        <div className="w-full border-t border-border pt-2.5">
          <AnnotationThread
            caseId={caseId}
            targetType="DECISION"
            targetId={decision.id}
          />
        </div>
      )}
    </PanelRow>
  )
}
