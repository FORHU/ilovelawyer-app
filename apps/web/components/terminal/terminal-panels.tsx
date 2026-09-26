"use client"

import { useTranslation } from "react-i18next"
import { AlertTriangle } from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
// PANEL_TITLES lives on legal-terminal.tsx, which imports TerminalPanelBody from this file —
// a real circular import, but a safe one: PANEL_TITLES is only read inside ChatPanel's render
// (never at module-eval time), by which point both modules have finished initializing. The
// same cycle already exists today via terminal-settings-sidebar.tsx importing PANEL_TITLES.
import { PANEL_TITLES } from "@/components/terminal/legal-terminal"
import { CitationMap } from "@/components/citation-map"
import { TheoriesPanel } from "@/components/terminal/theories-panel"
import type { CaseSnapshot, PanelId, SnapshotRisk } from "@/lib/terminal/types"
import { CommandPanel } from "@/components/terminal/panels/command-panel"
import { EvidencePanel } from "@/components/terminal/panels/evidence-panel"
import { LawPanel } from "@/components/terminal/panels/law-panel"
import { RedTeamPanel } from "@/components/terminal/panels/red-team-panel"
import { ProcedurePanel } from "@/components/terminal/panels/procedure-panel"
import { TeamAuditPanel } from "@/components/terminal/panels/team-audit-panel"
import { ContradictionsPanel } from "@/components/terminal/panels/contradictions-panel"
import { CaseFindingPanel, LegalIssuesPanel } from "@/components/terminal/panels/case-finding-panel"
import { WitnessPanel } from "@/components/terminal/panels/witness-panel"
import { DamagePanel } from "@/components/terminal/panels/damage-panel"
import { CaseReconstructionPanel } from "@/components/terminal/panels/case-reconstruction-panel"
import { AudioOverviewPanel } from "@/components/terminal/panels/audio-overview-panel"
import { DecisionsPanel } from "@/components/terminal/panels/decisions-panel"
import { VerificationPanel } from "@/components/terminal/panels/verification-panel"
import { CaseMindMapPanel } from "@/components/terminal/panels/case-mind-map-panel"

export function FatalRiskBanner({ risks }: { risks: SnapshotRisk[] }) {
  const { t } = useTranslation("terminal")
  if (risks.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{t("fatalBanner")}</span>{" "}
        {risks.map((r) => r.title).join(" · ")}
      </p>
    </div>
  )
}

export function TerminalPanelBody({
  panelId,
  caseId,
  snapshot,
  onJumpToPanel,
}: {
  panelId: PanelId
  caseId: string
  snapshot: CaseSnapshot
  onJumpToPanel?: (id: PanelId) => void
}) {
  switch (panelId) {
    case "command":
      return <CommandPanel snapshot={snapshot} caseId={caseId} />
    case "evidence":
      return <EvidencePanel snapshot={snapshot} caseId={caseId} />
    case "law":
      return <LawPanel snapshot={snapshot} caseId={caseId} />
    case "dates":
      return null
    case "chat":
      return <ChatPanel caseId={caseId} caseName={snapshot.case.caseName} onJumpToPanel={onJumpToPanel} />
    case "mindMap":
      return <CaseMindMapPanel caseId={caseId} snapshot={snapshot} />
    case "citationMap":
      return <CitationMapPanel caseId={caseId} />
    case "redTeam":
      return <RedTeamPanel snapshot={snapshot} caseId={caseId} />
    case "procedure":
      return <ProcedurePanel snapshot={snapshot} caseId={caseId} />
    case "teamAudit":
      return <TeamAuditPanel snapshot={snapshot} />
    case "contradictions":
      return <ContradictionsPanel caseId={caseId} />
    case "legalIssues":
      return <LegalIssuesPanel caseId={caseId} />
    case "weaknesses":
      return (
        <CaseFindingPanel
          snapshot={snapshot}
          caseId={caseId}
          category="WEAKNESS"
        />
      )
    case "strengths":
      return (
        <CaseFindingPanel
          snapshot={snapshot}
          caseId={caseId}
          category="STRENGTH"
        />
      )
    case "attackStrategy":
      return (
        <CaseFindingPanel
          snapshot={snapshot}
          caseId={caseId}
          category="ATTACK_STRATEGY"
        />
      )
    case "defenseStrategy":
      return (
        <CaseFindingPanel
          snapshot={snapshot}
          caseId={caseId}
          category="DEFENSE_STRATEGY"
        />
      )
    case "witnesses":
      return <WitnessPanel caseId={caseId} onJumpToPanel={onJumpToPanel} />
    case "damages":
      return <DamagePanel snapshot={snapshot} caseId={caseId} />
    case "caseReconstruction":
      return <CaseReconstructionPanel snapshot={snapshot} caseId={caseId} />
    case "audioOverview":
      return <AudioOverviewPanel caseId={caseId} />
    case "decisions":
      return <DecisionsPanel snapshot={snapshot} caseId={caseId} />
    case "verification":
      return <VerificationPanel caseId={caseId} />
    case "theories":
      return <TheoriesPanel snapshot={snapshot} caseId={caseId} />
    default:
      return null
  }
}

function ChatPanel({
  caseId,
  caseName,
  onJumpToPanel,
}: {
  caseId: string
  caseName: string
  onJumpToPanel?: (id: PanelId) => void
}) {
  const { t } = useTranslation("terminal")
  return (
    <ConsultationChat
      embedded
      isolateConsultation
      basePath={`/homepage/terminal/${caseId}`}
      caseId={caseId}
      emptyStateHeading={t("chatEmptyHeading", { caseName })}
      emptyStateSubheading={t("chatEmptySubheading")}
      inputPlaceholder={t("askQuestion")}
      showSuggestedPrompts
      showRelatedCases
      showTopicNavigator
      // enableFileChips deliberately stays off (see its own doc comment) — Case Documents
      // has its own dedicated surface; this links out to it instead of duplicating chip UI.
      filesLinkHref={`/homepage/case-portfolio/${caseId}`}
      // "Jump to panel" — only meaningful inside the Terminal's own pane grid, so both props are
      // Terminal-only and ConsultationChat only renders the link when it has a real, exact match
      // (see PANEL_TITLES) between a reply's topic title and a real panel name.
      panelTitles={PANEL_TITLES}
      onJumpToPanel={onJumpToPanel ? (id: string) => onJumpToPanel(id as PanelId) : undefined}
    />
  )
}

function CitationMapPanel({ caseId }: { caseId: string }) {
  return (
    <div className="min-h-0 flex-1 p-2">
      <CitationMap caseId={caseId} />
    </div>
  )
}
