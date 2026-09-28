import { useTranslation } from "react-i18next"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type { CaseFinding, LegalIssueJevCheck } from "@/lib/terminal/types"
import { JevCheck } from "@/components/terminal/panel-kit"
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
  JevDetail: LegalIssueJevDetail,
}

function LegalIssueJevDetail({ finding }: { finding: CaseFinding }) {
  const { t } = useTranslation("terminal")
  const jev = finding.jev as unknown as LegalIssueJevCheck
  const modelTag = modelTagLabelKey(finding, LEGAL_ISSUES)
  return (
    <JevCheck
      verdict={t(`issueJevContested.${jev.contested}`)}
      confidence={jev.contestedConfidence}
      uncertain={jev.uncertain}
      modelRating={modelTag ? t("findingJevModelRating", { tag: t(modelTag) }) : null}
    >
      <p>{t("issueJevRaisedLine", { verdict: t(`issueJevRaised.${jev.raised}`), pct: Math.round(jev.raisedConfidence * 100) })}</p>
      <p>
        {t("issueJevBurdenLine", { party: t(`issueJevBurden.${jev.burden}`), pct: Math.round(jev.burdenConfidence * 100) })}
        {jev.flags.includes("BURDEN_DISPUTED") && jev.modelBurden ? (
          <span className="text-warn"> {t("issueJevBurdenDisputed", { party: t(`issueJevBurden.${jev.modelBurden}`) })}</span>
        ) : null}
      </p>
    </JevCheck>
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
