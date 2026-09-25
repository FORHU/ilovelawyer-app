import { useTranslation } from "react-i18next"
import type { CaseFinding, CaseSnapshot, StrengthJevCheck } from "@/lib/terminal/types"
import { JevCheck } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const STRENGTHS: RatedFindingConfig = {
  category: "STRENGTH",
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
  dimSubLine: (jev) => (jev as StrengthJevCheck).flags.includes("NOT_BORNE_OUT"),
  JevDetail: StrengthJevDetail,
}

function StrengthJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as StrengthJevCheck
  const modelTag = modelTagLabelKey(finding, STRENGTHS)
  const pct = (n: number) => Math.round(n * 100)
  return (
    <JevCheck
      verdict={t(`strengthJevSupport.${jev.support}`)}
      confidence={jev.supportConfidence}
      uncertain={jev.uncertain}
      modelRating={modelTag ? t("findingJevModelRating", { tag: t(modelTag) }) : null}
    >
      {!jev.sourceRead ? <p className="text-warn">{t("strengthJevNoSourceText")}</p> : null}
      <p>{t("strengthJevWeightLine", { pct: pct(jev.weight), conf: pct(jev.weightConfidence) })}</p>
      <p>{t("strengthJevRebuttalLine", { verdict: t(`strengthJevRebuttal.${jev.rebuttal}`), pct: pct(jev.rebuttalConfidence) })}</p>
    </JevCheck>
  )
}

// Findings that carry the user's theory, the ones doing the most work first once Jev has rated
// them (positions come from strength-jev.ts's compareByWeight). Snapshot-driven, like Weaknesses.
export function StrengthsPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "STRENGTH")
  return <RatedFindingPanel caseId={caseId} items={items} config={STRENGTHS} />
}
