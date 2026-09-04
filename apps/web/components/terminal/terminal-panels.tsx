"use client"

import { useEffect, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  Info,
  Search,
  Trash2,
  Sparkles,
  Loader2,
  Save,
  Volume2,
} from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
import { CaseTimelineView } from "@/components/cases/case-timeline"
import { EvidenceDetailDrawer } from "@/components/terminal/evidence-detail-drawer"
import LegalMarkdown from "@/components/library/legal-markdown"
import { Badge } from "@workspace/ui/components/badge"
import { useConsultationsQuery } from "@/lib/chat/mutations"
import { useAudioOverview } from "@/lib/chat/use-audio-overview"
import {
  pollReconstructionAudio,
  terminalKeys,
  useCheckCitationMutation,
  useConfirmDeadlineMutation,
  useRecomputeDeadlineMutation,
  useCreateDamageMutation,
  useCreateDeadlineMutation,
  useCreateFindingMutation,
  useCreateProcedureItemMutation,
  useCreateRiskMutation,
  useCreateWitnessMutation,
  useDeleteDamageMutation,
  useDeleteFindingMutation,
  useDeleteWitnessMutation,
  useGenerateReconstructionAudioMutation,
  useGenerateReconstructionMutation,
  useGenerateRedTeamMutation,
  useProcedureRulesQuery,
  useScanContradictionsMutation,
  useUpdateProcedureItemMutation,
  useUpdateReconstructionMutation,
} from "@/lib/terminal/mutations"
import type { UpdateReconstructionPayload } from "@/lib/terminal/mutations"
import type {
  CaseSnapshot,
  DamageCategory,
  FindingCategory,
  HearsayCategory,
  PanelId,
  PrivilegeStatus,
  SnapshotContradiction,
  SnapshotEvidenceMatrixItem,
  SnapshotRisk,
  Witness,
} from "@/lib/terminal/types"
import { useAuthStore } from "@/lib/store/auth.store"
import { getStatus } from "@/config/tenant-codes/capabilities"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—"
  const date = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

function formatContradictionValue(kind: string, value: string) {
  if (kind === "amount_mismatch" && /^\d+(\.\d+)?$/.test(value)) {
    return `₱${Number(value).toLocaleString()}`
  }
  return value
}

function contradictionHeadline(item: SnapshotContradiction) {
  const left = formatContradictionValue(item.kind, item.leftValue)
  const right = formatContradictionValue(item.kind, item.rightValue)
  const label =
    item.factKey && item.factKey !== "other"
      ? item.factKey.replace(/_/g, " ")
      : null
  return label ? `${label}: ${left} vs ${right}` : `${left} vs ${right}`
}

export const fieldClass =
  "h-8 min-w-0 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
export const primaryBtnClass =
  "h-8 shrink-0 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
const ghostBtnClass =
  "h-8 shrink-0 rounded-md border border-border bg-transparent px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"

type RiskLevel = "HIGH" | "MEDIUM" | "LOW"

const EMPTY_METER = {
  score: 0,
  level: "LOW" as const,
  drivers: [] as { code: string; count: number }[],
}

const RISK_DRIVER_KEYS: Record<string, string> = {
  fatal: "riskDriverFatal",
  major: "riskDriverMajor",
  missingEvidence: "riskDriverMissingEvidence",
  contradictions: "riskDriverContradictions",
  amountMismatches: "riskDriverAmountMismatches",
  overdueDeadlines: "riskDriverOverdue",
  upcomingDeadlines: "riskDriverUpcoming",
  failedDocuments: "riskDriverFailedDocs",
  invalidCitations: "riskDriverInvalidCitations",
  unverifiedEvidence: "riskDriverUnverifiedEvidence",
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}

// Shared root wrapper for every panel body. Density lives here in one place —
// see High Density Mode in CONTEXT.md / docs/adr/0013-legal-terminal-redesign.md —
// so a panel author never touches spacing tokens directly.
const DENSE_GAP = { "3": "gap-1.5", "4": "gap-2.5", "5": "gap-3" } as const
const NORMAL_GAP = { "3": "gap-3", "4": "gap-4", "5": "gap-5" } as const

function PanelBody({
  gap,
  children,
}: {
  gap: keyof typeof NORMAL_GAP
  children: ReactNode
}) {
  const dense = useTerminalDisplayStore((state) => state.highDensity)
  return (
    <div
      className={`flex h-full min-h-0 flex-col ${dense ? DENSE_GAP[gap] : NORMAL_GAP[gap]} overflow-y-auto ${
        dense ? "p-2.5 text-[13px]" : "p-4 text-sm"
      } text-foreground`}
    >
      {children}
    </div>
  )
}

function TerminalRagBadge({ status }: { status: string | null }) {
  const { t } = useTranslation("terminal")
  if (status === "READY") {
    return (
      <span className="shrink-0 text-[10px] font-semibold tracking-[1px] text-emerald-400 uppercase">
        {t("ragReady")}
      </span>
    )
  }
  if (status === "FAILED") {
    return (
      <span className="shrink-0 text-[10px] font-semibold tracking-[1px] text-red-400 uppercase">
        {t("ragFailed")}
      </span>
    )
  }
  return (
    <span className="shrink-0 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
      {t("ragPending")}
    </span>
  )
}

function RiskMeter({
  label,
  score,
  level,
  drivers,
}: {
  label: string
  score: number
  level: RiskLevel
  drivers: { code: string; count: number }[]
}) {
  const { t } = useTranslation("terminal")
  const width = Math.max(8, Math.min(100, score))
  const barColor =
    level === "HIGH"
      ? "bg-red-500"
      : level === "MEDIUM"
        ? "bg-orange-400"
        : "bg-emerald-400"
  const badge =
    level === "HIGH"
      ? "bg-red-500/15 text-red-300"
      : level === "MEDIUM"
        ? "bg-orange-500/15 text-orange-400"
        : "bg-emerald-500/15 text-emerald-400"
  const driverText = drivers
    .map((driver) => {
      const key = RISK_DRIVER_KEYS[driver.code]
      return key ? t(key, { n: driver.count }) : ""
    })
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
          {label}
        </span>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[9px] font-semibold tracking-[1px] uppercase ${badge}`}
        >
          {level} · {score}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${width}%` }}
        />
      </div>
      {driverText ? (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {driverText}
        </p>
      ) : null}
    </div>
  )
}

export function FatalRiskBanner({ risks }: { risks: SnapshotRisk[] }) {
  const { t } = useTranslation("terminal")
  if (risks.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{t("fatalBanner")}</span>{" "}
        {risks.map((r) => r.title).join(" · ")}
      </p>
    </div>
  )
}

export function RefreshButton({
  onClick,
  pending,
  className,
}: {
  onClick: () => void
  pending: boolean
  className?: string
}) {
  const { t } = useTranslation("terminal")
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={className ?? ghostBtnClass}
    >
      {pending ? t("refreshing") : t("refresh")}
    </button>
  )
}

export function TerminalPanelBody({
  panelId,
  caseId,
  snapshot,
}: {
  panelId: PanelId
  caseId: string
  snapshot: CaseSnapshot
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
      return <ChatPanel caseId={caseId} caseName={snapshot.case.caseName} />
    case "mindMap":
      return <MindMapPanel caseId={caseId} />
    case "redTeam":
      return <RedTeamPanel snapshot={snapshot} caseId={caseId} />
    case "procedure":
      return <ProcedurePanel snapshot={snapshot} caseId={caseId} />
    case "teamAudit":
      return <TeamAuditPanel snapshot={snapshot} />
    case "contradictions":
      return <ContradictionsPanel snapshot={snapshot} caseId={caseId} />
    case "legalIssues":
      return (
        <CaseFindingPanel
          snapshot={snapshot}
          caseId={caseId}
          category="LEGAL_ISSUE"
        />
      )
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
      return <WitnessPanel snapshot={snapshot} caseId={caseId} />
    case "damages":
      return <DamagePanel snapshot={snapshot} caseId={caseId} />
    case "caseReconstruction":
      return <CaseReconstructionPanel snapshot={snapshot} caseId={caseId} />
    case "audioOverview":
      return <AudioOverviewPanel caseId={caseId} />
    default:
      return null
  }
}

function ChatPanel({ caseId, caseName }: { caseId: string; caseName: string }) {
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
    />
  )
}

function MindMapPanel({ caseId }: { caseId: string }) {
  return (
    <ConsultationChat
      embedded
      isolateConsultation
      mindMapOnly
      basePath={`/homepage/terminal/${caseId}`}
      caseId={caseId}
    />
  )
}

function CommandPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const createRisk = useCreateRiskMutation(caseId)
  const [title, setTitle] = useState("")
  const statusLabel =
    snapshot.case.actionType?.trim() ||
    snapshot.case.jurisdiction?.trim() ||
    null

  return (
    <PanelBody gap="5">
      <div>
        <SectionLabel>{t("parties")}</SectionLabel>
        {snapshot.case.parties.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.case.parties.map((party) => (
              <li key={party.id}>
                <p className="text-[15px] leading-snug font-medium text-foreground">
                  {party.name}
                </p>
                {party.designation ? (
                  <p className="mt-0.5 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                    {party.designation}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <SectionLabel>{t("keyIssues")}</SectionLabel>
        {snapshot.risks.length === 0 ? (
          <EmptyNote>{t("noKeyIssues")}</EmptyNote>
        ) : (
          <ul className="space-y-2.5">
            {snapshot.risks.map((risk) => (
              <li key={risk.id} className="flex items-start gap-2.5">
                <Info
                  className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold"
                  aria-hidden="true"
                />
                <span className="leading-5 text-foreground">{risk.title}</span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const value = title.trim()
            if (!value) return
            createRisk.mutate({ title: value, severity: "MAJOR" })
            setTitle("")
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("addRisk")}
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={createRisk.isPending}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </form>
      </div>

      {statusLabel ? (
        <div>
          <SectionLabel>{t("status")}</SectionLabel>
          <div className="inline-flex h-8 items-center rounded-md border border-border bg-muted px-3 text-xs text-foreground">
            {statusLabel}
          </div>
        </div>
      ) : null}
    </PanelBody>
  )
}

export const PRIVILEGE_STATUS_KEYS: Record<PrivilegeStatus, string> = {
  NONE: "privilegeNone",
  ATTORNEY_CLIENT: "privilegeAttorneyClient",
  WORK_PRODUCT: "privilegeWorkProduct",
}

export const HEARSAY_CATEGORY_KEYS: Record<HearsayCategory, string> = {
  DIRECT_EVIDENCE: "hearsayDirectEvidence",
  BUSINESS_RECORD: "hearsayBusinessRecord",
  PRESENT_SENSE_IMPRESSION: "hearsayPresentSenseImpression",
  EXCITED_UTTERANCE: "hearsayExcitedUtterance",
  OTHER_EXCEPTION: "hearsayOtherException",
  NOT_APPLICABLE: "hearsayNotApplicable",
}

function EvidenceRowPills({
  matrixItem,
  witnesses,
}: {
  matrixItem: SnapshotEvidenceMatrixItem | undefined
  witnesses: Witness[]
}) {
  const { t } = useTranslation("terminal")
  const custodyCount = matrixItem?.custodyEvents.length ?? 0
  const sponsoringWitness = matrixItem?.sponsoringWitnessId
    ? witnesses.find((w) => w.id === matrixItem.sponsoringWitnessId)
    : undefined

  return (
    <div className="flex w-full flex-wrap items-center gap-1">
      {matrixItem && matrixItem.privilegeStatus !== "NONE" ? (
        <Badge tone="warning">
          {t(PRIVILEGE_STATUS_KEYS[matrixItem.privilegeStatus])}
        </Badge>
      ) : null}
      {matrixItem && matrixItem.hearsayCategory !== "NOT_APPLICABLE" ? (
        <Badge tone="neutral">
          {t(HEARSAY_CATEGORY_KEYS[matrixItem.hearsayCategory])}
        </Badge>
      ) : null}
      <Badge tone={sponsoringWitness ? "success" : "neutral"}>
        {sponsoringWitness ? sponsoringWitness.name : t("noSponsoringWitness")}
      </Badge>
      <Badge tone={custodyCount === 0 ? "warning" : "neutral"}>
        {t("custodyEventCount", { n: custodyCount })}
      </Badge>
    </div>
  )
}

function EvidencePanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const openDocument =
    snapshot.documents.find((doc) => doc.id === openDocumentId) ?? null
  const openMatrixItem = snapshot.evidence.matrix.find(
    (m) => m.documentId === openDocumentId
  )

  return (
    <PanelBody gap="4">
      <div>
        <SectionLabel>
          {t("documents")} ({snapshot.documents.length})
        </SectionLabel>
        {snapshot.documents.length === 0 ? (
          <EmptyNote>{t("noDocuments")}</EmptyNote>
        ) : (
          <ul className="space-y-1">
            {snapshot.documents.map((doc) => {
              const matrixItem = snapshot.evidence.matrix.find(
                (m) => m.documentId === doc.id
              )
              return (
                <li key={doc.id}>
                  <button
                    type="button"
                    onClick={() => setOpenDocumentId(doc.id)}
                    className="flex w-full flex-col items-start gap-1 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
                        {doc.name}
                      </span>
                      <TerminalRagBadge status={doc.ragStatus} />
                    </div>
                    <EvidenceRowPills
                      matrixItem={matrixItem}
                      witnesses={snapshot.witnesses}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div>
        <SectionLabel>{t("timeline")}</SectionLabel>
        <CaseTimelineView caseId={caseId} fill={false} />
      </div>

      <EvidenceDetailDrawer
        open={!!openDocumentId}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setOpenDocumentId(null)
        }}
        caseId={caseId}
        document={openDocument}
        matrixItem={openMatrixItem}
        witnesses={snapshot.witnesses}
      />
    </PanelBody>
  )
}

// Split out of EvidencePanel into its own pane — the underlying data (EvidenceContradiction
// rows, scanned via regex + an LLM pass through chat-wonder-v2-api) already existed; this is
// purely giving it dedicated screen space instead of competing with Documents/Timeline for it.
function ContradictionsPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const scan = useScanContradictionsMutation(caseId)
  const contradictions = snapshot.evidence.contradictions

  return (
    <PanelBody gap="4">
      <button
        type="button"
        onClick={() => scan.mutate()}
        disabled={scan.isPending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-gold text-[11px] font-semibold tracking-[1.4px] text-brand-navy-950 uppercase transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        {scan.isPending ? t("scanning") : t("scan")}
      </button>

      {contradictions.length === 0 ? (
        <EmptyNote>{t("noContradictions")}</EmptyNote>
      ) : (
        <div>
          <SectionLabel>{t("contradictions")}</SectionLabel>
          <ul className="space-y-3">
            {contradictions.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-orange-400/20 bg-orange-500/5 px-3 py-2.5"
              >
                <p className="font-mono text-[12px] text-orange-400">
                  {contradictionHeadline(item)}
                </p>
                {item.leftExcerpt ? (
                  <p className="mt-2 text-[12px] leading-5 text-foreground/80">
                    “{item.leftExcerpt}”
                  </p>
                ) : null}
                {item.rightExcerpt ? (
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                    “{item.rightExcerpt}”
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </PanelBody>
  )
}

function LawPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const check = useCheckCitationMutation(caseId)
  const [quotedText, setQuotedText] = useState("")
  const [officialText, setOfficialText] = useState("")

  return (
    <PanelBody gap="4">
      <SectionLabel>{t("citations")}</SectionLabel>
      {snapshot.law.citations.length === 0 ? (
        <EmptyNote>{t("noCitations")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {snapshot.law.citations.map((citation) => (
            <li
              key={citation.id}
              className="rounded-md border border-border p-3"
            >
              <p className="line-clamp-3 text-sm leading-5">
                {citation.quotedText}
              </p>
              <p className="mt-2 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                {citation.status}
              </p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const quote = quotedText.trim()
          if (!quote) return
          check.mutate({
            quotedText: quote,
            officialText: officialText.trim() || undefined,
          })
          setQuotedText("")
          setOfficialText("")
        }}
      >
        <textarea
          value={quotedText}
          onChange={(e) => setQuotedText(e.target.value)}
          placeholder={t("quote")}
          rows={2}
          className="rounded-md border border-border bg-muted px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-foreground/30 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
        />
        <input
          value={officialText}
          onChange={(e) => setOfficialText(e.target.value)}
          placeholder={t("officialText")}
          className={fieldClass}
        />
        <button
          type="submit"
          disabled={check.isPending}
          className={`${primaryBtnClass} self-start`}
        >
          {t("verify")}
        </button>
      </form>
    </PanelBody>
  )
}

// Opposing counsel's own adversarial read of the case — generated from the case's structured
// findings (Legal Issues, Weaknesses, Contradictions, Witnesses, Damages), not raw documents.
// No manual edit, unlike Case Reconstruction: this is meant to be read as their commentary.
function RedTeamPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const generate = useGenerateRedTeamMutation(caseId)
  const content = snapshot.redTeamAssessment?.content ?? ""

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("redTeamAssessment")}</SectionLabel>
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 disabled:opacity-50"
        >
          {generate.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {generate.isPending
            ? t("generating")
            : content
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>

      {!content && !generate.isPending ? (
        <EmptyNote>{t("noRedTeam")}</EmptyNote>
      ) : content ? (
        <LegalMarkdown content={content} />
      ) : null}
    </PanelBody>
  )
}

function ProcedurePanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const deadlinesProvisional =
    getStatus(tenantCode, "deadlines") === "available-provisional"
  const rules = useProcedureRulesQuery()
  const createDeadline = useCreateDeadlineMutation(caseId)
  const confirmDeadline = useConfirmDeadlineMutation(caseId)
  const recomputeDeadline = useRecomputeDeadlineMutation(caseId)
  const createItem = useCreateProcedureItemMutation(caseId)
  const updateItem = useUpdateProcedureItemMutation(caseId)
  const [ruleCode, setRuleCode] = useState("")
  const [triggerDate, setTriggerDate] = useState("")
  const [sourceTimelineEventId, setSourceTimelineEventId] = useState("")
  const [todoLabel, setTodoLabel] = useState("")

  const timelineEventOptions = snapshot.timeline.filter(
    (event) => event.occurredOn
  )

  const items = snapshot.procedure.items
  const approachItems = items.filter(
    (item) => item.kind.toUpperCase() === "STRATEGY"
  )
  const todoItems = items.filter(
    (item) => item.kind.toUpperCase() !== "STRATEGY"
  )
  const fallbackApproach = snapshot.risks.slice(0, 3).map((risk) => risk.title)
  const overall = snapshot.riskAnalysis?.overall ?? EMPTY_METER
  const liability = snapshot.riskAnalysis?.liability ?? EMPTY_METER

  return (
    <PanelBody gap="5">
      <div>
        <SectionLabel>{t("recommendedApproach")}</SectionLabel>
        {approachItems.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-5 text-foreground">
            {approachItems.map((item) => (
              <li key={item.id}>{item.label}</li>
            ))}
          </ul>
        ) : fallbackApproach.length > 0 ? (
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] leading-5 text-foreground">
            {fallbackApproach.map((title) => (
              <li key={title}>{t("focusOn", { issue: title })}</li>
            ))}
          </ul>
        ) : (
          <EmptyNote>{t("noApproach")}</EmptyNote>
        )}
      </div>

      <div>
        <SectionLabel>{t("criticalTodos")}</SectionLabel>
        {todoItems.length === 0 ? (
          <EmptyNote>{t("noTodos")}</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {todoItems.map((item) => (
              <li key={item.id}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() =>
                      updateItem.mutate({ id: item.id, done: !item.done })
                    }
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-muted accent-brand-gold"
                  />
                  <span
                    className={`text-[13px] leading-5 ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const value = todoLabel.trim()
            if (!value) return
            createItem.mutate({ kind: "TODO", label: value })
            setTodoLabel("")
          }}
        >
          <input
            value={todoLabel}
            onChange={(e) => setTodoLabel(e.target.value)}
            placeholder={t("addTodo")}
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={createItem.isPending}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </form>
      </div>

      <div>
        <SectionLabel>{t("riskAnalysis")}</SectionLabel>
        <div className="space-y-3">
          <RiskMeter
            label={t("overallRisk")}
            score={overall.score}
            level={overall.level}
            drivers={overall.drivers}
          />
          <RiskMeter
            label={t("liabilityRisk")}
            score={liability.score}
            level={liability.level}
            drivers={liability.drivers}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <SectionLabel>{t("deadlines")}</SectionLabel>
          {deadlinesProvisional && (
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-[1px] text-amber-700 uppercase dark:text-amber-400">
              {t("deadlinesProvisional")}
            </span>
          )}
        </div>
        {snapshot.procedure.deadlines.length === 0 ? (
          <EmptyNote>{t("computeDeadline")}</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {snapshot.procedure.deadlines.map((deadline) => {
              const confirms = (deadline.confirmations ?? []).filter(
                (c) => c.confirmed
              ).length
              const stale = snapshot.staleness.find(
                (s) =>
                  s.nodeType === "PROCEDURAL_DEADLINE" &&
                  s.refId === deadline.id
              )
              return (
                <li
                  key={deadline.id}
                  className="rounded-md border border-border p-3"
                >
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{deadline.label}</p>
                    {stale && (
                      <span
                        title={stale.staleReason}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold tracking-[1px] text-amber-700 uppercase dark:text-amber-400"
                      >
                        {t("staleBadge")}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {formatDate(deadline.computedDueDate)}
                    </span>{" "}
                    · {confirms}/{snapshot.procedure.requiredConfirmations}{" "}
                    {t("confirmed")}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => confirmDeadline.mutate(deadline.id)}
                      disabled={confirmDeadline.isPending}
                      className="text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase hover:underline disabled:opacity-50"
                    >
                      {t("confirmDeadline")}
                    </button>
                    {stale && (
                      <button
                        type="button"
                        onClick={() => recomputeDeadline.mutate(deadline.id)}
                        disabled={recomputeDeadline.isPending}
                        className="text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase hover:underline disabled:opacity-50"
                      >
                        {t("recomputeDeadline")}
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!ruleCode || !triggerDate) return
            createDeadline.mutate({
              ruleCode,
              triggerDate,
              sourceTimelineEventId: sourceTimelineEventId || undefined,
            })
          }}
        >
          <select
            value={ruleCode}
            onChange={(e) => setRuleCode(e.target.value)}
            className={fieldClass}
          >
            <option value="">{t("computeDeadline")}</option>
            {(rules.data ?? []).map((rule) => (
              <option key={rule.code} value={rule.code}>
                {rule.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={triggerDate}
            onChange={(e) => setTriggerDate(e.target.value)}
            aria-label={t("triggerDate")}
            className={fieldClass}
          />
          <select
            value={sourceTimelineEventId}
            onChange={(e) => setSourceTimelineEventId(e.target.value)}
            className={fieldClass}
          >
            <option value="">{t("noTimelineLink")}</option>
            {timelineEventOptions.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-muted-foreground">
            {t("linkToTimelineEvent")}
          </p>
          <button
            type="submit"
            disabled={createDeadline.isPending}
            className={`${primaryBtnClass} self-start`}
          >
            {t("computeDeadline")}
          </button>
        </form>
      </div>
    </PanelBody>
  )
}

function TeamAuditPanel({ snapshot }: { snapshot: CaseSnapshot }) {
  const { t } = useTranslation("terminal")
  return (
    <PanelBody gap="3">
      <SectionLabel>{t("audit")}</SectionLabel>
      {snapshot.teamAudit.audit.length === 0 ? (
        <EmptyNote>{t("noAudit")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {snapshot.teamAudit.audit.map((event) => (
            <li
              key={event.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <span>{event.action}</span>
              <span className="shrink-0 text-[10px] tracking-wider text-muted-foreground uppercase">
                {formatDate(event.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </PanelBody>
  )
}

// Backs Legal Issues / Weaknesses / Strengths / Attack Strategies / Defense Strategies — one
// CaseFinding table filtered by category (see lib/terminal/mutations.ts), same as the backend.
const FINDING_ADD_LABEL_KEYS: Record<FindingCategory, string> = {
  LEGAL_ISSUE: "addLegalIssue",
  WEAKNESS: "addWeakness",
  STRENGTH: "addStrength",
  ATTACK_STRATEGY: "addAttackStrategy",
  DEFENSE_STRATEGY: "addDefenseStrategy",
}

function CaseFindingPanel({
  snapshot,
  caseId,
  category,
}: {
  snapshot: CaseSnapshot
  caseId: string
  category: FindingCategory
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateFindingMutation(caseId)
  const del = useDeleteFindingMutation(caseId)
  const [label, setLabel] = useState("")
  const items = snapshot.findings.filter((f) => f.category === category)

  return (
    <PanelBody gap="4">
      {items.length === 0 ? (
        <EmptyNote>{t("noFindings")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="leading-5 text-foreground">{item.label}</p>
                {item.notes === "AI" && (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    {t("aiGenerated")}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => del.mutate(item.id)}
                disabled={del.isPending}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 disabled:opacity-50"
                aria-label={t("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-auto flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = label.trim()
          if (!value) return
          create.mutate({ category, label: value })
          setLabel("")
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t(FINDING_ADD_LABEL_KEYS[category])}
          className={`flex-1 ${fieldClass}`}
        />
        <button
          type="submit"
          disabled={create.isPending}
          className={primaryBtnClass}
        >
          {t("add")}
        </button>
      </form>
    </PanelBody>
  )
}

function WitnessPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateWitnessMutation(caseId)
  const del = useDeleteWitnessMutation(caseId)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")

  return (
    <PanelBody gap="4">
      {snapshot.witnesses.length === 0 ? (
        <EmptyNote>{t("noWitnesses")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {snapshot.witnesses.map((w) => (
            <li
              key={w.id}
              className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{w.name}</p>
                {w.role ? (
                  <p className="text-[11px] tracking-wider text-muted-foreground uppercase">
                    {w.role}
                  </p>
                ) : null}
                {w.contact ? (
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {w.contact}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => del.mutate(w.id)}
                disabled={del.isPending}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 disabled:opacity-50"
                aria-label={t("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = name.trim()
          if (!value) return
          create.mutate({ name: value, role: role.trim() || undefined })
          setName("")
          setRole("")
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("witnessName")}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("witnessRole")}
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </div>
      </form>
    </PanelBody>
  )
}

const DAMAGE_CATEGORY_KEYS: Record<DamageCategory, string> = {
  ACTUAL: "damageActual",
  MORAL: "damageMoral",
  EXEMPLARY: "damageExemplary",
  ATTORNEYS_FEES: "damageAttorneysFees",
  OTHER: "damageOther",
}

function DamagePanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateDamageMutation(caseId)
  const del = useDeleteDamageMutation(caseId)
  const [category, setCategory] = useState<DamageCategory>("ACTUAL")
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")

  const total = snapshot.damages.reduce((sum, d) => sum + (d.amount ?? 0), 0)

  return (
    <PanelBody gap="4">
      {snapshot.damages.length === 0 ? (
        <EmptyNote>{t("noDamages")}</EmptyNote>
      ) : (
        <>
          <ul className="space-y-2">
            {snapshot.damages.map((d) => (
              <li
                key={d.id}
                className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                    {t(DAMAGE_CATEGORY_KEYS[d.category])}
                  </p>
                  {d.description ? (
                    <p className="mt-0.5 leading-5 text-foreground">
                      {d.description}
                    </p>
                  ) : null}
                  {d.amount != null ? (
                    <p className="mt-1 font-mono text-[13px] text-foreground">
                      {d.amount.toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(d.id)}
                  disabled={del.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-red-500 disabled:opacity-50"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-xs font-semibold tracking-wider text-foreground uppercase">
            <span>{t("damageTotal")}</span>
            <span className="font-mono">{total.toLocaleString()}</span>
          </div>
        </>
      )}
      <form
        className="mt-auto flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const parsedAmount = amount.trim() ? Number(amount) : undefined
          create.mutate({
            category,
            description: description.trim() || undefined,
            amount: parsedAmount,
          })
          setDescription("")
          setAmount("")
        }}
      >
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as DamageCategory)}
          className={fieldClass}
        >
          {(Object.keys(DAMAGE_CATEGORY_KEYS) as DamageCategory[]).map((c) => (
            <option key={c} value={c}>
              {t(DAMAGE_CATEGORY_KEYS[c])}
            </option>
          ))}
        </select>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("damageDescription")}
          className={fieldClass}
        />
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={t("damageAmount")}
            className={`flex-1 ${fieldClass}`}
          />
          <button
            type="submit"
            disabled={create.isPending}
            className={primaryBtnClass}
          >
            {t("add")}
          </button>
        </div>
      </form>
    </PanelBody>
  )
}

type ReconstructionRegister = "general" | "court" | "opposing"

const REGISTER_TAB_KEYS: Record<ReconstructionRegister, string> = {
  general: "registerGeneral",
  court: "registerCourt",
  opposing: "registerOpposing",
}

function registerText(
  reconstruction: CaseSnapshot["reconstruction"],
  register: ReconstructionRegister
): string {
  if (!reconstruction) return ""
  if (register === "general") return reconstruction.narrative
  if (register === "court") return reconstruction.narrativeCourt ?? ""
  return reconstruction.narrativeOpposing ?? ""
}

function buildUpdatePayload(
  register: ReconstructionRegister,
  text: string
): UpdateReconstructionPayload {
  if (register === "general") return { narrative: text }
  if (register === "court") return { narrativeCourt: text }
  return { narrativeOpposing: text }
}

function CaseReconstructionPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const queryClient = useQueryClient()
  const reconstruction = snapshot.reconstruction
  const narrative = reconstruction?.narrative ?? ""

  const [activeRegister, setActiveRegister] =
    useState<ReconstructionRegister>("general")
  const [drafts, setDrafts] = useState<Record<ReconstructionRegister, string>>({
    general: registerText(reconstruction, "general"),
    court: registerText(reconstruction, "court"),
    opposing: registerText(reconstruction, "opposing"),
  })
  const [dirty, setDirty] = useState<Record<ReconstructionRegister, boolean>>({
    general: false,
    court: false,
    opposing: false,
  })
  const [audioPolling, setAudioPolling] = useState(false)

  const generate = useGenerateReconstructionMutation(caseId)
  const update = useUpdateReconstructionMutation(caseId)
  const generateAudio = useGenerateReconstructionAudioMutation(caseId)

  // Polls a Polly async job while one is in flight — same "caller drives the loop" contract
  // as the Transcription feature's job polling, just scoped locally to this panel instead of
  // a cross-page store, since there's only ever one audio job per reconstruction.
  useEffect(() => {
    if (!audioPolling) return
    const interval = setInterval(() => {
      pollReconstructionAudio(caseId)
        .then((result) => {
          if (result.status === "IN_PROGRESS") return
          setAudioPolling(false)
          queryClient.invalidateQueries({
            queryKey: terminalKeys.snapshot(caseId),
          })
        })
        .catch(() => setAudioPolling(false))
    }, 3000)
    return () => clearInterval(interval)
  }, [audioPolling, caseId, queryClient])

  const activeDraft = drafts[activeRegister]
  const activeDirty = dirty[activeRegister]
  const activeText = registerText(reconstruction, activeRegister)

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("reconstructionNarrative")}</SectionLabel>
        <button
          type="button"
          onClick={() =>
            generate.mutate(undefined, {
              onSuccess: (data) => {
                setDrafts({
                  general: data.narrative,
                  court: data.narrativeCourt ?? "",
                  opposing: data.narrativeOpposing ?? "",
                })
                setDirty({ general: false, court: false, opposing: false })
              },
            })
          }
          disabled={generate.isPending}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 disabled:opacity-50"
        >
          {generate.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {generate.isPending
            ? t("generating")
            : narrative
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(Object.keys(REGISTER_TAB_KEYS) as ReconstructionRegister[]).map(
          (register) => (
            <button
              key={register}
              type="button"
              onClick={() => setActiveRegister(register)}
              className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
                activeRegister === register
                  ? "border-b-2 border-brand-gold text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(REGISTER_TAB_KEYS[register])}
            </button>
          )
        )}
      </div>

      {!narrative && !generate.isPending ? (
        <EmptyNote>{t("noReconstruction")}</EmptyNote>
      ) : activeRegister !== "general" && !activeText && !activeDirty ? (
        <EmptyNote>{t("registerNotGenerated")}</EmptyNote>
      ) : (
        <textarea
          key={activeRegister}
          value={activeDraft}
          onChange={(e) => {
            setDrafts((prev) => ({ ...prev, [activeRegister]: e.target.value }))
            setDirty((prev) => ({ ...prev, [activeRegister]: true }))
          }}
          rows={16}
          className="flex-1 rounded-md border border-border bg-muted px-3 py-2.5 text-[13px] leading-6 text-foreground outline-none focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
        />
      )}

      {activeDirty && (
        <button
          type="button"
          onClick={() =>
            update.mutate(buildUpdatePayload(activeRegister, activeDraft), {
              onSuccess: () =>
                setDirty((prev) => ({ ...prev, [activeRegister]: false })),
            })
          }
          disabled={update.isPending}
          className={`inline-flex items-center gap-1.5 self-end ${primaryBtnClass}`}
        >
          {update.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-3 w-3" aria-hidden="true" />
          )}
          {update.isPending ? t("saving") : t("save")}
        </button>
      )}

      {reconstruction && reconstruction.gaps.length > 0 && (
        <div>
          <SectionLabel>{t("reconstructionGaps")}</SectionLabel>
          <ul className="list-disc space-y-1 pl-4 text-[12px] leading-5 text-muted-foreground">
            {reconstruction.gaps.map((gap, index) => (
              <li key={index}>{gap}</li>
            ))}
          </ul>
        </div>
      )}

      {activeRegister === "general" && narrative && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>{t("audioNarration")}</SectionLabel>
            <button
              type="button"
              onClick={() =>
                generateAudio.mutate(undefined, {
                  onSuccess: () => {
                    setAudioPolling(true)
                    queryClient.invalidateQueries({
                      queryKey: terminalKeys.snapshot(caseId),
                    })
                  },
                })
              }
              disabled={generateAudio.isPending || audioPolling}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 disabled:opacity-50"
            >
              {generateAudio.isPending || audioPolling ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3 w-3" aria-hidden="true" />
              )}
              {generateAudio.isPending || audioPolling
                ? t("generatingAudio")
                : reconstruction?.audioFile?.fileUrl
                  ? t("regenerateAudio")
                  : t("generateAudio")}
            </button>
          </div>

          {reconstruction?.audioFile?.fileUrl && (
            <audio
              controls
              src={reconstruction.audioFile.fileUrl}
              className="h-8 w-full"
            />
          )}
          {reconstruction?.audioStaleAt && (
            <p className="text-[11px] text-muted-foreground">
              {t("audioOutOfDate")}
            </p>
          )}
        </div>
      )}
    </PanelBody>
  )
}

// Not to be confused with CaseReconstructionPanel's audio (a single narrator reading Polly's
// OutputUri directly) — this is the two-host podcast-style script from useAudioOverview (shared
// with Case Workspace's Studio panel), driven off whichever consultation is most recently
// active for this case, the same "isolated" resolution ConsultationChat does internally for
// ChatPanel/MindMapPanel above. No docked player bar here (that's Studio-specific chrome) — a
// plain native <audio controls>, same as CaseReconstructionPanel's, is enough for a Terminal pane.
function AudioOverviewPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation(["terminal", "case-portfolio"])
  const { data: caseConsultations } = useConsultationsQuery(caseId)
  const consultationId = caseConsultations?.[0]?.id ?? null
  const {
    activeAudioOverviewMessage,
    isGeneratingScript,
    generateScriptError,
    generateScript,
    audioRendering,
    audioRenderError,
    renderedAudioUrl,
    isGeneratingAudio,
  } = useAudioOverview(consultationId, caseId)

  if (!consultationId) {
    return (
      <PanelBody gap="4">
        <EmptyNote>
          {t("case-portfolio:workspace.audioOverviewNoConsultation")}
        </EmptyNote>
      </PanelBody>
    )
  }

  if (!activeAudioOverviewMessage) {
    return (
      <PanelBody gap="4">
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <Volume2
            className="h-5 w-5 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="max-w-xs text-muted-foreground">
            {isGeneratingScript
              ? t("case-portfolio:workspace.audioOverviewGenerating")
              : t("case-portfolio:workspace.audioOverviewEmpty")}
          </p>
          {isGeneratingScript ? (
            <Loader2
              className="h-4 w-4 animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          ) : (
            <button
              type="button"
              onClick={() => void generateScript()}
              className={primaryBtnClass}
            >
              {t("case-portfolio:workspace.audioOverviewGenerateCta")}
            </button>
          )}
          {generateScriptError && (
            <p className="text-xs text-red-500">
              {t("case-portfolio:workspace.audioOverviewGenerateError")}
            </p>
          )}
        </div>
      </PanelBody>
    )
  }

  const rendering = audioRendering || isGeneratingAudio

  return (
    <PanelBody gap="4">
      {audioRenderError && (
        <p className="text-center text-xs text-red-500">
          {t("case-portfolio:workspace.audioOverviewRenderError")}
        </p>
      )}
      {renderedAudioUrl ? (
        <audio
          controls
          src={renderedAudioUrl}
          className="h-8 w-full shrink-0"
        />
      ) : (
        <div className="flex shrink-0 items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-muted-foreground">
          {rendering && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          )}
          {rendering
            ? t("case-portfolio:workspace.audioOverviewRendering")
            : null}
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {activeAudioOverviewMessage.audioOverview?.turns.map((turn, i) => (
          <div key={i}>
            <p className="text-[10px] font-semibold tracking-wider text-brand-gold uppercase">
              {turn.speaker === "HOST_A"
                ? t("case-portfolio:workspace.audioOverviewHostA")
                : t("case-portfolio:workspace.audioOverviewHostB")}
            </p>
            <p className="text-[13px] leading-5 text-foreground">{turn.text}</p>
          </div>
        ))}
      </div>
    </PanelBody>
  )
}
