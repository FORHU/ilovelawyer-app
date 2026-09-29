import { useTranslation } from "react-i18next"
import type { CaseFinding, CaseSnapshot, WeaknessJevCheck } from "@/lib/terminal/types"
import { LlmReview, ReviewPoint } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const WEAKNESSES: RatedFindingConfig = {
  category: "WEAKNESS",
  introKey: "weaknessesIntro",
  addKey: "addWeakness",
  detailPlaceholderKey: "weaknessDetailPlaceholder",
  tags: [
    { tag: "MATERIAL", tone: "danger", label: "weaknessMaterial" },
    { tag: "MINOR", tone: "warn", label: "weaknessMinor" },
    { tag: "CLOSED", tone: "ok", label: "weaknessClosed" },
  ],
  ringTag: "CLOSED",
  ringTitleKey: "weaknessClosedCount",
  doneTag: "CLOSED",
  // More impact is worse: a weakness only ever hurts.
  impact: { badWhenUp: true, titleKey: "weaknessImpact" },
  jevFlagKeys: (jev) => (jev as WeaknessJevCheck).flags.map((flag) => `weaknessJevFlag.${flag}`),
  llmWording: true,
  subHintKey: (jev) => ((jev as WeaknessJevCheck).curable === "NOT_CURABLE" ? "weaknessNoFix" : null),
  JevDetail: WeaknessJevDetail,
  upload: true,
}

// Scores come back normalized to 0..1 over four levels (weakness-jev.ts) — back to the level index.
const level = (score: number) => Math.min(3, Math.max(0, Math.round(score * 3)))

function WeaknessJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as WeaknessJevCheck
  const modelTag = modelTagLabelKey(finding, WEAKNESSES)
  return (
    <LlmReview uncertain={jev.uncertain} draftRating={modelTag ? t("llmDraftSaid", { tag: t(modelTag) }) : null}>
      <ReviewPoint text={t(`weaknessJevSupport.${jev.support}`)} confidence={jev.supportConfidence} />
      <ReviewPoint text={t(`weaknessSeverityLevel.${level(jev.severity)}`)} confidence={jev.severityConfidence} />
      <ReviewPoint text={t(`weaknessSurfacingLevel.${level(jev.surfacing)}`)} confidence={jev.surfacingConfidence} />
      <ReviewPoint text={t(`weaknessJevCurable.${jev.curable}`)} confidence={jev.curableConfidence} />
    </LlmReview>
  )
}

// Exposure in the user's own case, soonest to surface first once Jev has rated it (positions come
// from weakness-jev.ts's compareBySurfacing). Snapshot-driven, like the other category panels.
export function WeaknessesPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "WEAKNESS")
  return <RatedFindingPanel caseId={caseId} items={items} config={WEAKNESSES} />
}
