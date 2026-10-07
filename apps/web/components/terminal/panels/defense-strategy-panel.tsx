import { useTranslation } from "react-i18next"
import type { CaseFinding, CaseSnapshot, DefenseStrategyJevCheck } from "@/lib/terminal/types"
import { JevCheck } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const DEFENSE_STRATEGY: RatedFindingConfig = {
  category: "DEFENSE_STRATEGY",
  regenerate: "defense",
  introKey: "defenseStrategyIntro",
  addKey: "addDefenseStrategy",
  detailPlaceholderKey: "defenseStrategyDetailPlaceholder",
  tags: [
    { tag: "ANSWERED", tone: "ok", label: "defenseStrategyAnswered" },
    { tag: "PARTIAL", tone: "warn", label: "defenseStrategyPartial" },
    { tag: "UNANSWERED", tone: "danger", label: "defenseStrategyUnanswered" },
  ],
  ringTag: "ANSWERED",
  ringTitleKey: "defenseStrategyAnsweredCount",
  // An answered defense is handled and sinks to the bottom, same as Weaknesses' CLOSED.
  doneTag: "ANSWERED",
  jevFlagKeys: () => [],
  JevDetail: DefenseStrategyJevDetail,
  upload: true,
  checklist: { fixedTag: "ANSWERED", todoLabel: (f, t) => t("defenseStrategyTodo", { defense: f.label }) },
}

function DefenseStrategyJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as DefenseStrategyJevCheck
  const modelTag = modelTagLabelKey(finding, DEFENSE_STRATEGY)
  return (
    <JevCheck
      verdict={t(`defenseStrategyStatus.${jev.defenseStatus}`)}
      confidence={jev.defenseStatusConfidence}
      uncertain={jev.uncertain}
      modelRating={modelTag ? t("findingJevModelRating", { tag: t(modelTag) }) : null}
    />
  )
}

// Defenses the opposing party is expected to raise, and this case's answer to each — snapshot-
// driven, like the other category panels.
export function DefenseStrategyPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const items = snapshot.findings.filter((f) => f.category === "DEFENSE_STRATEGY")
  return <RatedFindingPanel caseId={caseId} items={items} config={DEFENSE_STRATEGY} />
}
