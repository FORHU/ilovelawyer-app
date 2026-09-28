import { useTranslation } from "react-i18next"
import type { AttackStrategyJevCheck, CaseFinding, CaseSnapshot } from "@/lib/terminal/types"
import { JevCheck } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const ATTACK_STRATEGY: RatedFindingConfig = {
  category: "ATTACK_STRATEGY",
  introKey: "attackStrategyIntro",
  addKey: "addAttackStrategy",
  detailPlaceholderKey: "attackStrategyDetailPlaceholder",
  tags: [
    { tag: "READY", tone: "ok", label: "attackStrategyReady" },
    { tag: "DRAFTING", tone: "warn", label: "attackStrategyDrafting" },
    { tag: "BLOCKED", tone: "danger", label: "attackStrategyBlocked" },
  ],
  ringTag: "READY",
  ringTitleKey: "attackStrategyReadyCount",
  // No doneTag: READY is the goal a lawyer keeps working toward, not a finished item to sink.
  jevFlagKeys: () => [],
  JevDetail: AttackStrategyJevDetail,
  upload: true,
}

function AttackStrategyJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as AttackStrategyJevCheck
  const modelTag = modelTagLabelKey(finding, ATTACK_STRATEGY)
  return (
    <JevCheck
      verdict={t(`attackStrategyReadiness.${jev.readiness}`)}
      confidence={jev.readinessConfidence}
      uncertain={jev.uncertain}
      modelRating={modelTag ? t("findingJevModelRating", { tag: t(modelTag) }) : null}
    />
  )
}

// Offensive moves for the user's own case, in the order the API lists them (position, then
// newest first) — snapshot-driven, like the other category panels.
export function AttackStrategyPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "ATTACK_STRATEGY")
  return <RatedFindingPanel caseId={caseId} items={items} config={ATTACK_STRATEGY} />
}
