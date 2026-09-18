import { useTranslation } from "react-i18next"
import { Loader2, Sparkles } from "lucide-react"
import AttributedMarkdown, { AttributedTextLegend } from "@/components/shared/attributed-text"
import { useAiJobStatus, useGenerateRedTeamMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, SectionLabel, ghostBtnClass } from "@/components/terminal/panel-kit"

// Opposing counsel's own adversarial read of the case — generated from the case's structured
// findings (Legal Issues, Weaknesses, Contradictions, Witnesses, Damages), not raw documents.
// No manual edit, unlike Case Reconstruction: this is meant to be read as their commentary.
export function RedTeamPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const generate = useGenerateRedTeamMutation(caseId)
  const job = useAiJobStatus(caseId, "redTeam")
  const isGenerating = generate.isPending || job.data?.status === "IN_PROGRESS"
  const content = snapshot.redTeamAssessment?.content ?? ""
  const claims = snapshot.redTeamAssessment?.claims ?? []

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("redTeamAssessment")}</SectionLabel>
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={isGenerating}
          className={`inline-flex items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating
            ? t("generating")
            : content
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>
      <MutationError show={generate.isError} />

      {!content && !isGenerating ? (
        <EmptyNote>{t("noRedTeam")}</EmptyNote>
      ) : content ? (
        <>
          {claims.length > 0 && <AttributedTextLegend />}
          <AttributedMarkdown content={content} claims={claims} />
        </>
      ) : null}
    </PanelBody>
  )
}
