import { useTranslation } from "react-i18next"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type { CaseFinding, LegalIssueJevCheck } from "@/lib/terminal/types"
import { LlmReview, ReviewPoint } from "@/components/terminal/panel-kit"
import { RatedFindingPanel, modelTagLabelKey, type RatedFindingConfig } from "@/components/terminal/panels/rated-finding-panel"

const LEGAL_ISSUES: RatedFindingConfig = {
  category: "LEGAL_ISSUE",
  introKey: "legalIssuesIntro",
  addKey: "addLegalIssue",
  detailPlaceholderKey: "issueDetailPlaceholder",
  tags: [
    { tag: "CONTESTED", tone: "riskmed", label: "issueContested" },
    { tag: "BRIEFING", tone: "warn", label: "issueBriefing" },
    { tag: "OPEN", tone: "neutral", label: "issueOpen" },
    { tag: "RESOLVED", tone: "ok", label: "issueResolved" },
  ],
  ringTag: "RESOLVED",
  ringTitleKey: "issueResolvedCount",
  doneTag: "RESOLVED",
  jevFlagKeys: (jev) => (jev as LegalIssueJevCheck).flags.map((flag) => `issueJevFlag.${flag}`),
  llmWording: true,
  JevDetail: LegalIssueJevDetail,
}

function LegalIssueJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as LegalIssueJevCheck
  const modelTag = modelTagLabelKey(finding, LEGAL_ISSUES)
  return (
    <LlmReview uncertain={jev.uncertain} draftRating={modelTag ? t("llmDraftSaid", { tag: t(modelTag) }) : null}>
      <ReviewPoint text={t(`issueJevContested.${jev.contested}`)} confidence={jev.contestedConfidence} />
      <ReviewPoint text={t(`issueJevRaised.${jev.raised}`)} confidence={jev.raisedConfidence} />
      <ReviewPoint
        text={jev.burden === "UNCLEAR" ? t("issueBurdenUnclear") : t("issueBurdenOn", { party: t(`issueJevBurden.${jev.burden}`) })}
        confidence={jev.burdenConfidence}
      >
        {jev.flags.includes("BURDEN_DISPUTED") && jev.modelBurden ? (
          <span className="text-warn"> {t("issueJevBurdenDisputed", { party: t(`issueJevBurden.${jev.modelBurden}`) })}</span>
        ) : null}
      </ReviewPoint>
    </LlmReview>
  )
}

// The one CaseFinding category the case graph tracks as its own node type (view_type=issues also
// carries CLAIM nodes) — reads the graph-view projection instead of slicing CaseSnapshot, unlike
// the other category panels, which stay snapshot-driven.
export function LegalIssuesPanel({ caseId }: { caseId: string }) {
  const graphView = useGraphViewQuery(caseId, "issues")
  const items = (graphView.data?.nodes ?? [])
    .filter((node) => node.type === "FINDING")
    .map((node) => node.data as unknown as CaseFinding)
  return <RatedFindingPanel caseId={caseId} items={items} config={LEGAL_ISSUES} />
}
