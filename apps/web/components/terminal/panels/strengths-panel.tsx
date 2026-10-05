import { useTranslation } from "react-i18next"
import type { CaseFinding, CaseSnapshot, StrengthJevCheck } from "@/lib/terminal/types"
import { LlmReview, ReviewPoint } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const STRENGTHS: RatedFindingConfig = {
  category: "STRENGTH",
  regenerate: "STRENGTH",
  introKey: "strengthsIntro",
  addKey: "addStrength",
  detailPlaceholderKey: "strengthDetailPlaceholder",
  tags: [
    { tag: "STRONG", tone: "ok", label: "strengthStrong" },
    { tag: "MODERATE", tone: "neutral", label: "strengthModerate" },
  ],
  ringTag: "STRONG",
  ringTitleKey: "strengthStrongCount",
  // More impact is better: a strength only ever helps.
  impact: { badWhenUp: false, titleKey: "strengthImpact" },
  // The design shows the document a strength rests on under it.
  detailFallback: (f) => f.sourceLabel,
  jevFlagKeys: (jev) => (jev as StrengthJevCheck).flags.map((flag) => `strengthJevFlag.${flag}`),
  llmWording: true,
  dimSubLine: (jev) => (jev as StrengthJevCheck).flags.includes("NOT_BORNE_OUT"),
  // Says why the sub-line is muted.
  subHintKey: (jev) => ((jev as StrengthJevCheck).flags.includes("NOT_BORNE_OUT") ? "strengthJevFlag.NOT_BORNE_OUT" : null),
  JevDetail: StrengthJevDetail,
  upload: true,
  // No fixed state: a strength's to-do only closes by hand.
  checklist: {},
}

// The weight Score comes back normalized to 0..1 over four levels (strength-jev.ts).
const level = (score: number) => Math.min(3, Math.max(0, Math.round(score * 3)))

function StrengthJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as StrengthJevCheck
  const modelTag = modelTagLabelKey(finding, STRENGTHS)
  return (
    <LlmReview uncertain={jev.uncertain} draftRating={modelTag ? t("llmDraftSaid", { tag: t(modelTag) }) : null}>
      <ReviewPoint text={t(`strengthJevSupport.${jev.support}`)} confidence={jev.supportConfidence}>
        {!jev.sourceRead ? <span className="text-warn"> {t("strengthJevNoSourceText")}</span> : null}
      </ReviewPoint>
      <ReviewPoint text={t(`strengthWeightLevel.${level(jev.weight)}`)} confidence={jev.weightConfidence} />
      <ReviewPoint text={t(`strengthJevRebuttal.${jev.rebuttal}`)} confidence={jev.rebuttalConfidence} />
    </LlmReview>
  )
}

// Findings that carry the user's theory, the ones doing the most work first once Jev has rated
// them (positions come from strength-jev.ts's compareByWeight). Snapshot-driven, like Weaknesses.
export function StrengthsPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "STRENGTH")
  return <RatedFindingPanel caseId={caseId} items={items} config={STRENGTHS} />
}
