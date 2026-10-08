import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  useUpdateMissingEvidenceMutation,
  usePaneRegenerate,
} from "@/lib/terminal/mutations"
import type {
  MissingEvidenceSeverity,
  MissingEvidenceStatus,
  SnapshotMissingEvidence,
} from "@/lib/terminal/types"
import {
  EmptyNote,
  MutationError,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TonePill,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  type Tone,
  RegenerateButton,
  PaneLoadingState,
  usePaneLoadingLabel,
} from "@/components/terminal/panel-kit"

const SEVERITY_STYLE: Record<MissingEvidenceSeverity, { tone: Tone; label: string }> = {
  CRITICAL: { tone: "danger", label: "missingEvidenceCritical" },
  MODERATE: { tone: "riskmed", label: "missingEvidenceModerate" },
  MINOR: { tone: "warn", label: "missingEvidenceMinor" },
}

// The Missing Evidence section of Evidence & Timeline, beside Contradictions: a contradiction is
// two documents disagreeing, this is the record being silent on something a claim needs. Rows come
// straight off the snapshot already ordered (open first, most severe first — see the API's
// MissingEvidenceRepo.list), so this never re-sorts them. Generated in every analysis refresh,
// with its own Regenerate here.
export function EvidenceMissing({
  caseId,
  items,
}: {
  caseId: string
  items: SnapshotMissingEvidence[]
}) {
  const { t } = useTranslation("terminal")
  const update = useUpdateMissingEvidenceMutation(caseId)
  const regen = usePaneRegenerate(caseId, "missingEvidence")
  const loadingLabel = usePaneLoadingLabel(regen)
  const [open, setOpen] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const handledCount = items.filter((item) => item.status !== "OPEN").length

  const toggle = (id: string) => {
    setOpen(open === id ? null : id)
    setNote("")
  }
  const setStatus = (id: string, status: MissingEvidenceStatus) => {
    update.mutate({ id, status, resolutionNote: status === "OPEN" ? null : note.trim() || null })
    setNote("")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={labelTextClass}>{t("missingEvidenceTitle")}</p>
        <div className="flex items-baseline gap-3">
          {items.length > 0 ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {t("missingEvidenceHandled", { done: handledCount, total: items.length })}
            </span>
          ) : null}
          <RegenerateButton regen={regen} hint={t("regenerateMissingEvidenceHint")} />
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground">{t("missingEvidenceIntro")}</p>
      <MutationError show={update.isError} />
      {loadingLabel ? (
        <PaneLoadingState>{loadingLabel}</PaneLoadingState>
      ) : (
        /* Same shrink-0 wrapper as the Contradictions list: PanelRowList's <ul> is overflow-hidden. */
        <div className="shrink-0">
          <PanelRowList empty={<EmptyNote>{t("noMissingEvidence")}</EmptyNote>}>
            {items.map((item) => {
              const style = SEVERITY_STYLE[item.severity]
              const tone = TONE_STYLE[style.tone]
              const handled = item.status !== "OPEN"
              const isOpen = open === item.id
              return (
                <PanelRow
                  key={item.id}
                  className={`flex-col items-stretch gap-2 border-l-[3px] ${handled ? "border-l-border" : `${tone.edge} ${tone.tint}`}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left ${handled ? "opacity-60" : ""}`}
                  >
                    {/* 8rem floor, as in Contradictions: in a narrow pane the pill drops under the
                        headline instead of squeezing it. */}
                    <span className="min-w-0 flex-[1_1_8rem]">
                      <span className="block text-[13px] font-medium text-foreground first-letter:uppercase">
                        {item.label}
                      </span>
                      <span className={`mt-0.5 block truncate ${labelTextClass}`}>
                        {item.claimLabel ?? t("missingEvidenceCaseWide")}
                      </span>
                    </span>
                    {handled ? (
                      <span className={`shrink-0 ${labelTextClass}`}>
                        {t(item.status === "RESOLVED" ? "missingEvidenceResolved" : "missingEvidenceDismissed")}
                      </span>
                    ) : null}
                    <TonePill tone={style.tone}>{t(style.label)}</TonePill>
                  </button>
                  {isOpen ? (
                    <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px]">
                      <p className="leading-5 text-foreground">{item.detail ?? t("missingEvidenceNoDetail")}</p>
                      <div>
                        <p className={labelTextClass}>{t("missingEvidenceWouldCloseIt")}</p>
                        <p className="mt-0.5 leading-5 text-foreground">
                          {item.suggestedSource ?? t("missingEvidenceNoSource")}
                        </p>
                      </div>
                      <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                        {handled ? (
                          <>
                            {item.resolutionNote ? <p className="text-foreground">“{item.resolutionNote}”</p> : null}
                            <button
                              type="button"
                              onClick={() => setStatus(item.id, "OPEN")}
                              disabled={update.isPending}
                              className={`self-start ${ghostBtnClass}`}
                            >
                              {t("missingEvidenceReopen")}
                            </button>
                          </>
                        ) : (
                          <>
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              placeholder={t("missingEvidenceNotePlaceholder")}
                              aria-label={t("missingEvidenceNotePlaceholder")}
                              className={fieldClass}
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => setStatus(item.id, "RESOLVED")}
                                disabled={update.isPending}
                                className={ghostBtnClass}
                                title={t("missingEvidenceResolveHint")}
                              >
                                {t("missingEvidenceResolve")}
                              </button>
                              <button
                                type="button"
                                onClick={() => setStatus(item.id, "DISMISSED")}
                                disabled={update.isPending}
                                className={ghostBtnClass}
                                title={t("missingEvidenceDismissHint")}
                              >
                                {t("missingEvidenceDismiss")}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : null}
                </PanelRow>
              )
            })}
          </PanelRowList>
        </div>
      )}
    </div>
  )
}
