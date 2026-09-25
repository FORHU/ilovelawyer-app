import { useTranslation } from "react-i18next"
import type { CaseFinding, CaseSnapshot, WeaknessJevCheck } from "@/lib/terminal/types"
import { JevCheck } from "@/components/terminal/panel-kit"
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
  subHintKey: (jev) => ((jev as WeaknessJevCheck).curable === "NOT_CURABLE" ? "weaknessNoFix" : null),
  JevDetail: WeaknessJevDetail,
}

function WeaknessJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as WeaknessJevCheck
  const modelTag = modelTagLabelKey(finding, WEAKNESSES)
  const pct = (n: number) => Math.round(n * 100)
  return (
    <JevCheck
      verdict={t(`weaknessJevSupport.${jev.support}`)}
      confidence={jev.supportConfidence}
      uncertain={jev.uncertain}
      modelRating={modelTag ? t("findingJevModelRating", { tag: t(modelTag) }) : null}
    >
      <p>
        {t("weaknessJevScores", {
          sev: pct(jev.severity),
          sevConf: pct(jev.severityConfidence),
          sur: pct(jev.surfacing),
          surConf: pct(jev.surfacingConfidence),
        })}
      </p>
      <p>{t("weaknessJevCurableLine", { verdict: t(`weaknessJevCurable.${jev.curable}`), pct: pct(jev.curableConfidence) })}</p>
    </JevCheck>
  )
}

// Exposure in the user's own case, soonest to surface first once Jev has rated it (positions come
// from weakness-jev.ts's compareBySurfacing). Snapshot-driven, like the other category panels.
export function WeaknessesPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "WEAKNESS")
  return <RatedFindingPanel caseId={caseId} items={items} config={WEAKNESSES} />
}
