"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderPlus,
  Info,
  MapPin,
  MessageSquareWarning,
  Pencil,
  Plus,
  Quote,
  RotateCcw,
  Search,
  Trash2,
  Sparkles,
  Loader2,
  Save,
  Volume2,
} from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
import { CitationMap } from "@/components/citation-map"
import { CaseTimelineView } from "@/components/cases/case-timeline"
import { EvidenceDetailDrawer } from "@/components/terminal/evidence-detail-drawer"
import DeleteDocumentModal from "@/components/terminal/delete-document-modal"
import AttributedMarkdown, {
  AttributedTextLegend,
} from "@/components/shared/attributed-text"
import {
  DecisionConfidenceBadge,
  DecisionDetailBody,
} from "@/components/shared/decision-detail"
import { AnnotationThread } from "@/components/shared/annotation-thread"
import { TheoriesPanel } from "@/components/terminal/theories-panel"
import { AudioOverviewPlayerBar } from "@/components/audio-overview-player"
import { Badge } from "@workspace/ui/components/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip"
import { useConsultationsQuery } from "@/lib/chat/mutations"
import { useUploadCaseDocumentsMutation, useDeleteCaseDocumentMutation } from "@/lib/cases/mutations"
import { useFileDrop } from "@/hooks/use-file-drop"
import { useAudioOverview } from "@/lib/chat/use-audio-overview"
import { useAudioOverviewPlayer } from "@/lib/chat/use-audio-overview-player"
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
  useDisputeDecisionMutation,
  useReactivateDecisionMutation,
  useGenerateReconstructionAudioMutation,
  useGenerateReconstructionMutation,
  useGenerateReconstructionScenesMutation,
  useGenerateTableReadMutation,
  useGenerateRedTeamMutation,
  useProcedureRulesQuery,
  useScanContradictionsMutation,
  useUpdateProcedureItemMutation,
  useUpdateReconstructionMutation,
  useAiJobStatus,
} from "@/lib/terminal/mutations"
import type { UpdateReconstructionPayload } from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type {
  CaseSnapshot,
  DamageCategory,
  DecisionRecord,
  FindingCategory,
  HearsayCategory,
  PanelId,
  PrivilegeStatus,
  SceneDetail,
  SnapshotDocument,
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

function contradictionHeadline(item: {
  kind: string
  factKey: string
  leftValue: string
  rightValue: string
}) {
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

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10px] font-semibold tracking-[1.4px] text-muted-foreground uppercase">
      {children}
    </p>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
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

export function PanelBody({
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
      return <WitnessPanel caseId={caseId} />
    case "damages":
      return <DamagePanel snapshot={snapshot} caseId={caseId} />
    case "caseReconstruction":
      return <CaseReconstructionPanel snapshot={snapshot} caseId={caseId} />
    case "audioOverview":
      return <AudioOverviewPanel caseId={caseId} />
    case "decisions":
      return <DecisionsPanel snapshot={snapshot} caseId={caseId} />
    case "theories":
      return <TheoriesPanel snapshot={snapshot} caseId={caseId} />
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
      showSuggestedPrompts
      showRelatedCases
      showTopicNavigator
      // enableFileChips deliberately stays off (see its own doc comment) — Case Documents
      // has its own dedicated surface; this links out to it instead of duplicating chip UI.
      filesLinkHref={`/homepage/case-portfolio/${caseId}`}
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

function CitationMapPanel({ caseId }: { caseId: string }) {
  return (
    <div className="min-h-0 flex-1 p-2">
      <CitationMap caseId={caseId} />
    </div>
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

// Sentinel key for documents with no category — never a real folder name (Workspace's own
// "+ New folder" flow trims and requires a non-empty name before it'll let you drop into one),
// so this can't collide with an actual category a lawyer named.
const UNCATEGORIZED_KEY = "__uncategorized__"

/** Groups a flat document list into the same "folders" the Workspace document browser derives
 * from `category` (see DocumentFolderBrowser) — no separate folder concept, just this field.
 * Sorted alphabetically by folder name, with the uncategorized bucket pinned last since it's a
 * fallback, not a real category; documents keep the order the snapshot already returned them in
 * (this only groups, it doesn't introduce a second sort). */
function groupDocumentsByFolder(documents: SnapshotDocument[]): { key: string; label: string | null; docs: SnapshotDocument[] }[] {
  const groups = new Map<string, SnapshotDocument[]>()
  for (const doc of documents) {
    const key = doc.category?.trim() || UNCATEGORIZED_KEY
    const bucket = groups.get(key)
    if (bucket) bucket.push(doc)
    else groups.set(key, [doc])
  }
  const named = [...groups.entries()]
    .filter(([key]) => key !== UNCATEGORIZED_KEY)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, docs]) => ({ key, label: key, docs }))
  const uncategorized = groups.get(UNCATEGORIZED_KEY)
  return uncategorized ? [...named, { key: UNCATEGORIZED_KEY, label: null, docs: uncategorized }] : named
}

function DocumentRow({
  doc,
  matrixItem,
  witnesses,
  onOpen,
  onDelete,
  isDeleting,
}: {
  doc: SnapshotDocument
  matrixItem: SnapshotEvidenceMatrixItem | undefined
  witnesses: Witness[]
  onOpen: () => void
  onDelete: () => void
  isDeleting: boolean
}) {
  const { t } = useTranslation("terminal")
  return (
    <li className="group flex w-full items-start gap-1 rounded-md transition-colors hover:bg-muted dark:hover:bg-overlay-hover">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 flex-col items-start gap-1 rounded-md px-1 py-1.5 text-left"
      >
        <div className="flex w-full items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">
            {doc.name}
          </span>
          <TerminalRagBadge status={doc.ragStatus} />
        </div>
        <EvidenceRowPills matrixItem={matrixItem} witnesses={witnesses} />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onDelete}
            aria-label={t("removeDocument", { documentName: doc.name })}
            className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-600 disabled:opacity-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:text-red-400"
          >
            {isDeleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{t("removeDocument", { documentName: doc.name })}</TooltipContent>
      </Tooltip>
    </li>
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
  const [deletingDoc, setDeletingDoc] = useState<SnapshotDocument | null>(null)
  // Collapsed by default (empty set) — a folder's document count is visible without opening it,
  // and this panel also has the Timeline section below the document list that several
  // auto-expanded folders would otherwise push well down the pane. Not persisted across
  // reloads — resets collapsed every time this panel mounts.
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  // Folders a lawyer just created but hasn't dropped a file into yet. A folder only really
  // exists once a document actually carries its name as `category` (see groupDocumentsByFolder
  // below) — same model as Workspace's DocumentFolderBrowser, whose "+ New folder" just opens an
  // empty view and waits for a drop. Tracked here purely so the empty folder is visible at all
  // until that first upload lands and it becomes a real group.
  const [pendingFolders, setPendingFolders] = useState<string[]>([])
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Which category the next file-picker selection uploads into — set right before opening the
  // OS picker (a plain ref, not state: it's read once in the picker's own onChange, never
  // rendered, so it doesn't need to trigger a re-render).
  const uploadTargetRef = useRef<string | undefined>(undefined)

  const uploadDocuments = useUploadCaseDocumentsMutation()
  const upload = (files: File[], category?: string) => {
    uploadDocuments.mutate({ files, caseId, category })
    // The pending placeholder's only job was to keep an empty folder visible until a real
    // document lands in it — once that upload is in flight, groupDocumentsByFolder will pick
    // the category up for real as soon as the snapshot refetches.
    if (category) setPendingFolders((prev) => prev.filter((name) => name !== category))
  }
  const { isDragOver, hoverTarget, dragHandlers } = useFileDrop(upload, undefined)

  const { mutate: deleteDocument, isPending: isDeleting, variables: deletingVars } = useDeleteCaseDocumentMutation()

  const openDocument =
    snapshot.documents.find((doc) => doc.id === openDocumentId) ?? null
  const openMatrixItem = snapshot.evidence.matrix.find(
    (m) => m.documentId === openDocumentId
  )

  // A document only gets AI-categorized as part of extraction (see DocumentExtractionSvc.process
  // on the backend), which finishes around the same time it flips to READY — so a still-indexing
  // (or failed) document almost always has no category yet, not because a lawyer or the AI put
  // it there deliberately. Folding it into "Uncategorized" would bury it inside a
  // collapsed-by-default folder instead of showing it as the in-progress upload it actually is —
  // so it renders as a loose row above the folders instead, same as any other document, until it
  // resolves to READY and (if categorized) joins a real folder on the next snapshot refetch.
  const indexingDocuments = snapshot.documents.filter((doc) => doc.ragStatus !== "READY")
  const readyDocuments = snapshot.documents.filter((doc) => doc.ragStatus === "READY")
  const realFolders = groupDocumentsByFolder(readyDocuments)
  const realFolderNames = new Set(realFolders.map((f) => f.label))
  const folders = [
    ...realFolders,
    ...pendingFolders
      .filter((name) => !realFolderNames.has(name))
      .map((name) => ({ key: name, label: name as string | null, docs: [] as SnapshotDocument[] })),
  ].sort((a, b) => {
    if (a.label === null) return 1
    if (b.label === null) return -1
    return a.label.localeCompare(b.label)
  })

  const toggleFolder = (key: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const triggerUpload = (category?: string) => {
    uploadTargetRef.current = category
    fileInputRef.current?.click()
  }

  return (
    <PanelBody gap="4">
      <div {...dragHandlers} className="relative rounded-lg">
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionLabel>
            {t("documents")} ({snapshot.documents.length})
          </SectionLabel>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={uploadDocuments.isPending}
                onClick={() => triggerUpload(undefined)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-2 py-1 text-[11px] font-semibold text-brand-gold transition-colors hover:border-brand-gold/50 hover:bg-brand-gold/15 disabled:cursor-wait disabled:opacity-60"
              >
                {uploadDocuments.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-3 w-3" aria-hidden="true" />
                )}
                {uploadDocuments.isPending ? t("uploading") : t("addDocument")}
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("dropToUpload")}</TooltipContent>
          </Tooltip>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (files.length > 0) upload(files, uploadTargetRef.current)
          }}
        />
        {uploadDocuments.data && uploadDocuments.data.failed.length > 0 && (
          <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{t("uploadError")}</p>
        )}
        {snapshot.documents.length === 0 && folders.length === 0 ? (
          <EmptyNote>{t("noDocuments")}</EmptyNote>
        ) : (
          <div className="space-y-1">
            {indexingDocuments.length > 0 && (
              <ul className="space-y-1">
                {indexingDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    matrixItem={snapshot.evidence.matrix.find((m) => m.documentId === doc.id)}
                    witnesses={snapshot.witnesses}
                    onOpen={() => setOpenDocumentId(doc.id)}
                    onDelete={() => setDeletingDoc(doc)}
                    isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                  />
                ))}
              </ul>
            )}
            {folders.map((folder) => {
              const expanded = expandedFolders.has(folder.key)
              return (
                <div
                  key={folder.key}
                  data-drop-target={folder.label ?? undefined}
                  className={`rounded-md ${hoverTarget === folder.label ? "bg-primary/10 ring-1 ring-primary/40" : ""}`}
                >
                  <div className="flex w-full items-center gap-1 rounded-md py-1 pr-0.5 pl-1 transition-colors hover:bg-muted dark:hover:bg-overlay-hover">
                    <button
                      type="button"
                      onClick={() => toggleFolder(folder.key)}
                      aria-expanded={expanded}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      <ChevronRight
                        className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[1px] text-foreground uppercase">
                        {folder.label ?? t("uncategorizedFolder")}
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{folder.docs.length}</span>
                    </button>
                    {folder.label && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => triggerUpload(folder.label ?? undefined)}
                            aria-label={t("addDocument")}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
                          >
                            <Plus className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("addDocument")}</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  {expanded &&
                    (folder.docs.length === 0 ? (
                      <p className="py-2 pl-5 text-[11px] text-muted-foreground">{t("emptyFolder")}</p>
                    ) : (
                      <ul className="space-y-1 pl-5">
                        {folder.docs.map((doc) => (
                          <DocumentRow
                            key={doc.id}
                            doc={doc}
                            matrixItem={snapshot.evidence.matrix.find((m) => m.documentId === doc.id)}
                            witnesses={snapshot.witnesses}
                            onOpen={() => setOpenDocumentId(doc.id)}
                            onDelete={() => setDeletingDoc(doc)}
                            isDeleting={isDeleting && deletingVars?.documentId === doc.id}
                          />
                        ))}
                      </ul>
                    ))}
                </div>
              )
            })}
            {creatingFolder ? (
              <div className="flex items-center gap-2 rounded-md px-1 py-1">
                <FolderPlus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <input
                  autoFocus
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const trimmed = newFolderName.trim()
                      if (trimmed) {
                        setPendingFolders((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]))
                        setExpandedFolders((prev) => new Set(prev).add(trimmed))
                      }
                      setCreatingFolder(false)
                      setNewFolderName("")
                    }
                    if (e.key === "Escape") {
                      setCreatingFolder(false)
                      setNewFolderName("")
                    }
                  }}
                  placeholder={t("folderNamePrompt")}
                  className="h-6 flex-1 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                />
                <button
                  type="button"
                  onClick={() => {
                    setCreatingFolder(false)
                    setNewFolderName("")
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  {t("cancel")}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left text-[11px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
              >
                <FolderPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t("newFolder")}
              </button>
            )}
          </div>
        )}
        {isDragOver && !hoverTarget && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-card/90">
            <span className="text-sm font-semibold text-primary">{t("dropToUpload")}</span>
          </div>
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

      {deletingDoc && (
        <DeleteDocumentModal
          key={deletingDoc.id}
          doc={deletingDoc}
          isDeleting={isDeleting && deletingVars?.documentId === deletingDoc.id}
          onConfirm={() => {
            deleteDocument({ documentId: deletingDoc.id, caseId })
            setDeletingDoc(null)
          }}
          onClose={() => setDeletingDoc(null)}
        />
      )}
    </PanelBody>
  )
}

// Split out of EvidencePanel into its own pane — the underlying data (EvidenceContradiction
// rows, scanned via regex + an LLM pass through chat-wonder-v2-api) already existed; this is
// purely giving it dedicated screen space instead of competing with Documents/Timeline for it.
// Reads the graph-view projection (view_type=contradictions) instead of slicing CaseSnapshot,
// so a scan triggered from any mounted panel refreshes this one via the shared query cache.
function ContradictionsPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const scan = useScanContradictionsMutation(caseId)
  const job = useAiJobStatus(caseId, "contradictions")
  const graphView = useGraphViewQuery(caseId, "contradictions")
  const isScanning = scan.isPending || job.data?.status === "IN_PROGRESS"
  const contradictions = graphView.data?.edges ?? []

  return (
    <PanelBody gap="4">
      <button
        type="button"
        onClick={() => scan.mutate()}
        disabled={isScanning}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-gold text-[11px] font-semibold tracking-[1.4px] text-brand-navy-950 uppercase transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        {isScanning ? t("scanning") : t("scan")}
      </button>

      {contradictions.length === 0 ? (
        <EmptyNote>{t("noContradictions")}</EmptyNote>
      ) : (
        <div>
          <SectionLabel>{t("contradictions")}</SectionLabel>
          <ul className="space-y-3">
            {contradictions.map((edge) => {
              const metadata = edge.metadata as {
                kind: string
                factKey: string
                leftValue: string
                rightValue: string
                leftExcerpt: string
                rightExcerpt: string
              }
              return (
                <li
                  key={edge.id}
                  className="rounded-md border border-orange-400/20 bg-orange-500/5 px-3 py-2.5"
                >
                  <p className="font-mono text-[12px] text-orange-400">
                    {contradictionHeadline(metadata)}
                  </p>
                  {metadata.leftExcerpt ? (
                    <p className="mt-2 text-[12px] leading-5 text-foreground/80">
                      “{metadata.leftExcerpt}”
                    </p>
                  ) : null}
                  {metadata.rightExcerpt ? (
                    <p className="mt-1 text-[12px] leading-5 text-muted-foreground">
                      “{metadata.rightExcerpt}”
                    </p>
                  ) : null}
                </li>
              )
            })}
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
  const [citedReference, setCitedReference] = useState("")
  const [officialText, setOfficialText] = useState("")
  const [pinpoint, setPinpoint] = useState("")

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
              {citation.citedReference && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {citation.citedReference}
                  {citation.pinpoint && `, ${citation.pinpoint}`}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                  {citation.status}
                </p>
                {citation.propositionType && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                    <Quote size={10} />
                    {t(`propositionType.${citation.propositionType}`)}
                  </p>
                )}
                {citation.pinpoint && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                    <MapPin size={10} />
                    {citation.pinpoint}
                  </p>
                )}
              </div>
              {citation.citedReference &&
                (citation.resolvedAuthority ? (
                  <a
                    href={citation.resolvedAuthority.jurisUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-emerald-600 uppercase hover:underline dark:text-emerald-400"
                  >
                    <CheckCircle2 size={11} />
                    {t("authorityVerified")}
                    <ExternalLink size={10} />
                  </a>
                ) : (
                  <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-amber-600 uppercase dark:text-amber-400">
                    <AlertTriangle size={11} />
                    {t("authorityNotVerified")}
                  </p>
                ))}
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
            citedReference: citedReference.trim() || undefined,
            officialText: officialText.trim() || undefined,
            pinpoint: pinpoint.trim() || undefined,
          })
          setQuotedText("")
          setCitedReference("")
          setOfficialText("")
          setPinpoint("")
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
          value={citedReference}
          onChange={(e) => setCitedReference(e.target.value)}
          placeholder={t("citedReference")}
          className={fieldClass}
        />
        <input
          value={pinpoint}
          onChange={(e) => setPinpoint(e.target.value)}
          placeholder={t("pinpoint")}
          className={fieldClass}
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
  const job = useAiJobStatus(caseId, "redTeam")
  const isGenerating = generate.isPending || job.data?.status === "IN_PROGRESS"
  const content = snapshot.redTeamAssessment?.content ?? ""
  const claims = snapshot.redTeamAssessment?.claims ?? []

  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("redTeamAssessment")}</SectionLabel>
        <button
          type="button"
          onClick={() => generate.mutate()}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating
            ? t("generating")
            : content
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>

      {!content && !isGenerating ? (
        <EmptyNote>{t("noRedTeam")}</EmptyNote>
      ) : content ? (
        <>
          {claims.length > 0 && <AttributedTextLegend />}
          <AttributedMarkdown content={content} claims={claims} />
        </>
      ) : null}
    </PanelBody>
  )
}

// The "Why?" behind one conclusion in a legal answer — every rule[].url and evidence*[].docId
// was already verified against that turn's retrieved sources by chat-wonder-v2-api before this
// row was ever written, so `verified` here is read-only, never re-derived client-side (see
// DecisionRecordPayload in lib/terminal/types.ts). Populated automatically per legal chat turn;
// unlike Red Team / Case Reconstruction there is no "Generate" action on this panel.
function DecisionsPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const dispute = useDisputeDecisionMutation(caseId)
  const reactivate = useReactivateDecisionMutation(caseId)
  const decisions = snapshot.decisions ?? []

  if (decisions.length === 0) {
    return (
      <PanelBody gap="3">
        <EmptyNote>{t("noDecisions")}</EmptyNote>
      </PanelBody>
    )
  }

  return (
    <PanelBody gap="3">
      <ul className="space-y-3">
        {decisions.map((decision) => (
          <DecisionCard
            key={decision.id}
            caseId={caseId}
            decision={decision}
            onDispute={(note) => dispute.mutate({ id: decision.id, note })}
            onReactivate={() => reactivate.mutate({ id: decision.id })}
            isPending={dispute.isPending || reactivate.isPending}
          />
        ))}
      </ul>
    </PanelBody>
  )
}

function DecisionCard({
  caseId,
  decision,
  onDispute,
  onReactivate,
  isPending,
}: {
  caseId: string
  decision: DecisionRecord
  onDispute: (note?: string) => void
  onReactivate: () => void
  isPending: boolean
}) {
  const { t } = useTranslation("terminal")
  const [disputing, setDisputing] = useState(false)
  const [note, setNote] = useState("")
  const [showAnnotations, setShowAnnotations] = useState(false)
  const p = decision.payload
  const disputed = decision.status === "DISPUTED"

  return (
    <li
      className={`rounded-md border px-3 py-2.5 ${disputed ? "border-orange-500/40 bg-orange-500/5" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 leading-5 font-medium text-foreground">
          {p.conclusion}
        </p>
        <DecisionConfidenceBadge confidence={p.confidence} />
      </div>

      {disputed && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-orange-400 uppercase">
          <MessageSquareWarning className="h-3 w-3" aria-hidden="true" />
          {t("decisionStatusDisputed")}
          {decision.disputeNote ? `: ${decision.disputeNote}` : ""}
        </p>
      )}

      <div className="mt-2 space-y-2">
        <DecisionDetailBody payload={p} />
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setShowAnnotations((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground"
        >
          {t("notes")}
        </button>
        {disputed ? (
          <button
            type="button"
            onClick={onReactivate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
            {t("decisionReactivate")}
          </button>
        ) : disputing ? (
          <form
            className="flex w-full flex-col gap-1.5"
            onSubmit={(e) => {
              e.preventDefault()
              onDispute(note.trim() || undefined)
              setDisputing(false)
              setNote("")
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("decisionDisputeNotePlaceholder")}
              className={fieldClass}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDisputing(false)
                  setNote("")
                }}
                className={ghostBtnClass}
              >
                {t("cancel")}
              </button>
              <button
                type="submit"
                disabled={isPending}
                className={primaryBtnClass}
              >
                {t("decisionDispute")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setDisputing(true)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"
          >
            <MessageSquareWarning className="h-3 w-3" aria-hidden="true" />
            {t("decisionDispute")}
          </button>
        )}
      </div>

      {showAnnotations && (
        <div className="mt-2.5 border-t border-border pt-2.5">
          <AnnotationThread
            caseId={caseId}
            targetType="DECISION"
            targetId={decision.id}
          />
        </div>
      )}
    </li>
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
              <li key={item.id}>
                {item.label}
                {item.sourceLabel && (
                  <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {t("groundedIn", { doc: item.sourceLabel })}
                    </span>
                  </span>
                )}
              </li>
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
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[13px] leading-5 ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {item.label}
                    </span>
                    {item.sourceLabel && (
                      <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <FileText
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span className="truncate">
                          {t("groundedIn", { doc: item.sourceLabel })}
                        </span>
                      </span>
                    )}
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

// Legal Issues is the one CaseFinding category the case graph tracks as its own node type
// (view_type=issues also carries CLAIM nodes) — reads the graph-view projection instead of
// slicing CaseSnapshot, unlike the other four category panels below which stay snapshot-driven.
function LegalIssuesPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const create = useCreateFindingMutation(caseId)
  const del = useDeleteFindingMutation(caseId)
  const [label, setLabel] = useState("")
  const graphView = useGraphViewQuery(caseId, "issues")
  const items = (graphView.data?.nodes ?? []).filter(
    (node) => node.type === "FINDING"
  )

  return (
    <PanelBody gap="4">
      {items.length === 0 ? (
        <EmptyNote>{t("noFindings")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {items.map((node) => {
            const item = node.data as {
              label: string
              notes?: string | null
              sourceLabel?: string | null
            }
            return (
              <li
                key={node.id}
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
                  {item.sourceLabel && (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <FileText
                        className="h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {t("groundedIn", { doc: item.sourceLabel })}
                      </span>
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => del.mutate(node.refId)}
                  disabled={del.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-red-500 disabled:opacity-50"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form
        className="mt-auto flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const value = label.trim()
          if (!value) return
          create.mutate({ category: "LEGAL_ISSUE", label: value })
          setLabel("")
        }}
      >
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t(FINDING_ADD_LABEL_KEYS.LEGAL_ISSUE)}
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
                {item.sourceLabel && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {t("groundedIn", { doc: item.sourceLabel })}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => del.mutate(item.id)}
                disabled={del.isPending}
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-red-500 disabled:opacity-50"
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

// Reads the graph-view projection (view_type=witnesses) instead of slicing CaseSnapshot, so a
// witness added/removed from any mounted panel refreshes this one via the shared query cache.
function WitnessPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const create = useCreateWitnessMutation(caseId)
  const del = useDeleteWitnessMutation(caseId)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const graphView = useGraphViewQuery(caseId, "witnesses")
  const witnesses = graphView.data?.nodes ?? []

  return (
    <PanelBody gap="4">
      {witnesses.length === 0 ? (
        <EmptyNote>{t("noWitnesses")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {witnesses.map((node) => {
            const w = node.data as {
              name: string
              role?: string | null
              contact?: string | null
            }
            return (
              <li
                key={node.id}
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
                  onClick={() => del.mutate(node.refId)}
                  disabled={del.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-red-500 disabled:opacity-50"
                  aria-label={t("delete")}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            )
          })}
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
                  className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-red-500 disabled:opacity-50"
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
  // General-register-only: the narrative is claim-attributed (see backend's [CLAIMS] block), so
  // it defaults to a read-only highlighted view; editing is a deliberate switch, same tradeoff
  // Red Team avoids by not being editable at all. Court/Opposing have no claims and stay
  // textarea-only, same as before this feature.
  const [isEditingGeneral, setIsEditingGeneral] = useState(false)
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
  const [viewMode, setViewMode] = useState<
    "narrative" | "scenes" | "storyboard"
  >("narrative")

  const generate = useGenerateReconstructionMutation(caseId)
  const update = useUpdateReconstructionMutation(caseId)
  const generateAudio = useGenerateReconstructionAudioMutation(caseId)
  const generateJob = useAiJobStatus(caseId, "caseReconstruction")
  const isGenerating =
    generate.isPending || generateJob.data?.status === "IN_PROGRESS"

  // Generate is queued server-side (AiGenerationQueue / SQS) — the mutation's response is just
  // the AiGenerationJob row, not the finished narrative, so drafts can no longer be set from its
  // onSuccess. Instead: note the IN_PROGRESS -> DONE transition, then resync drafts once
  // `reconstruction` itself reflects the refetched snapshot — which may land a render or two
  // after the transition, once useAiJobStatus's own invalidate resolves — hence the two effects
  // rather than reading `reconstruction` directly in the one that watches job status.
  const prevGenerateJobStatus = useRef(generateJob.data?.status)
  const pendingDraftSyncRef = useRef(false)
  useEffect(() => {
    if (
      prevGenerateJobStatus.current === "IN_PROGRESS" &&
      generateJob.data?.status === "DONE"
    ) {
      pendingDraftSyncRef.current = true
    }
    prevGenerateJobStatus.current = generateJob.data?.status
  }, [generateJob.data?.status])
  useEffect(() => {
    if (!pendingDraftSyncRef.current) return
    pendingDraftSyncRef.current = false
    setDrafts({
      general: registerText(reconstruction, "general"),
      court: registerText(reconstruction, "court"),
      opposing: registerText(reconstruction, "opposing"),
    })
    setDirty({ general: false, court: false, opposing: false })
    setIsEditingGeneral(false)
  }, [reconstruction])

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
          onClick={() => generate.mutate()}
          disabled={isGenerating}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
        >
          {isGenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGenerating
            ? t("generating")
            : narrative
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {(["narrative", "scenes", "storyboard"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            className={`px-2.5 py-1.5 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
              viewMode === mode
                ? "border-b-2 border-brand-gold text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(RECONSTRUCTION_VIEW_MODE_KEYS[mode])}
          </button>
        ))}
      </div>

      {viewMode === "scenes" && (
        <ScenesView caseId={caseId} reconstruction={reconstruction} />
      )}
      {viewMode === "storyboard" && (
        <StoryboardView
          reconstruction={reconstruction}
          documents={snapshot.documents}
        />
      )}

      {viewMode === "narrative" && (
        <>
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
          ) : activeRegister === "general" && !isEditingGeneral ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                {reconstruction?.claims?.length ? (
                  <AttributedTextLegend />
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => setIsEditingGeneral(true)}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover"
                >
                  <Pencil className="h-3 w-3" aria-hidden="true" />
                  {t("edit")}
                </button>
              </div>
              <div className="flex-1 rounded-md border border-border bg-muted px-3 py-2.5">
                <AttributedMarkdown
                  content={activeDraft}
                  claims={reconstruction?.claims ?? []}
                />
              </div>
            </div>
          ) : (
            <textarea
              key={activeRegister}
              value={activeDraft}
              onChange={(e) => {
                setDrafts((prev) => ({
                  ...prev,
                  [activeRegister]: e.target.value,
                }))
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
                  onSuccess: () => {
                    setDirty((prev) => ({ ...prev, [activeRegister]: false }))
                    if (activeRegister === "general") setIsEditingGeneral(false)
                  },
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
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
                >
                  {generateAudio.isPending || audioPolling ? (
                    <Loader2
                      className="h-3 w-3 animate-spin"
                      aria-hidden="true"
                    />
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
        </>
      )}
    </PanelBody>
  )
}

const RECONSTRUCTION_VIEW_MODE_KEYS = {
  narrative: "viewModeNarrative",
  scenes: "viewModeScenes",
  storyboard: "viewModeStoryboard",
} as const

function SceneConfidenceBadge({
  confidence,
}: {
  confidence: SceneDetail["confidence"]
}) {
  const { t } = useTranslation("terminal")
  const cls =
    confidence === "high"
      ? "bg-emerald-500/15 text-emerald-400"
      : confidence === "medium"
        ? "bg-orange-500/15 text-orange-400"
        : "bg-red-500/15 text-red-300"
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[1px] uppercase ${cls}`}
    >
      {t(
        confidence === "high"
          ? "decisionConfidenceHigh"
          : confidence === "medium"
            ? "decisionConfidenceMedium"
            : "decisionConfidenceLow"
      )}
    </span>
  )
}

function ScenesView({
  caseId,
  reconstruction,
}: {
  caseId: string
  reconstruction: CaseSnapshot["reconstruction"]
}) {
  const { t } = useTranslation("terminal")
  const scenes = reconstruction?.scenes ?? null

  const generateScenes = useGenerateReconstructionScenesMutation(caseId)
  const scenesJob = useAiJobStatus(caseId, "caseReconstructionScenes")
  const isGeneratingScenes =
    generateScenes.isPending || scenesJob.data?.status === "IN_PROGRESS"

  const generateTableRead = useGenerateTableReadMutation(caseId)
  const tableReadJob = useAiJobStatus(caseId, "caseReconstructionTableRead")
  const isGeneratingTableRead =
    generateTableRead.isPending || tableReadJob.data?.status === "IN_PROGRESS"

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{t("scenesLabel")}</SectionLabel>
        <button
          type="button"
          onClick={() => generateScenes.mutate()}
          disabled={isGeneratingScenes}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
        >
          {isGeneratingScenes ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3 w-3" aria-hidden="true" />
          )}
          {isGeneratingScenes
            ? t("generating")
            : scenes?.length
              ? t("regenerateScenes")
              : t("generateScenes")}
        </button>
      </div>

      {!scenes || scenes.length === 0 ? (
        <EmptyNote>{t("noScenes")}</EmptyNote>
      ) : (
        <>
          <ul className="space-y-2">
            {scenes.map((scene) => (
              <li
                key={scene.index}
                className="rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 flex-1 text-[12px] font-semibold text-foreground">
                    {[scene.time, scene.location].filter(Boolean).join(" · ") ||
                      t("sceneUntitled", { n: scene.index + 1 })}
                  </p>
                  <SceneConfidenceBadge confidence={scene.confidence} />
                </div>
                {scene.actors.length > 0 && (
                  <p className="mt-1 text-[10px] tracking-wider text-muted-foreground uppercase">
                    {scene.actors.join(" · ")}
                  </p>
                )}
                <p className="mt-1.5 text-[12px] leading-4 text-foreground">
                  {scene.action}
                </p>
                {scene.dialogue.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {scene.dialogue.map((d, i) => (
                      <li
                        key={i}
                        className="text-[12px] leading-4 text-muted-foreground"
                      >
                        <span className="font-semibold text-foreground">
                          {d.actor}:{" "}
                        </span>
                        {d.line}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  {t("sourcesVerifiedCount", { n: scene.sourceRefs.length })}
                </p>
                {scene.unresolved.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {scene.unresolved.map((u, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-1.5 text-[11px] leading-4 text-orange-400"
                      >
                        <AlertTriangle
                          className="mt-0.5 h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {u}{" "}
                          <span className="text-muted-foreground">
                            ({t("addedAsWeakness")})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          <div className="border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>{t("tableRead")}</SectionLabel>
              <button
                type="button"
                onClick={() => generateTableRead.mutate()}
                disabled={isGeneratingTableRead}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-[10px] font-semibold tracking-[1px] text-foreground uppercase transition-colors hover:bg-muted/70 dark:hover:bg-overlay-hover disabled:opacity-50"
              >
                {isGeneratingTableRead ? (
                  <Loader2
                    className="h-3 w-3 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Volume2 className="h-3 w-3" aria-hidden="true" />
                )}
                {isGeneratingTableRead
                  ? t("generatingAudio")
                  : reconstruction?.tableReadFile?.fileUrl
                    ? t("regenerateTableRead")
                    : t("generateTableRead")}
              </button>
            </div>
            {reconstruction?.tableReadFile?.fileUrl ? (
              <audio
                controls
                src={reconstruction.tableReadFile.fileUrl}
                className="mt-2 h-8 w-full"
              />
            ) : (
              <EmptyNote>{t("noTableRead")}</EmptyNote>
            )}
            {reconstruction?.tableReadStaleAt && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {t("tableReadOutOfDate")}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StoryboardView({
  reconstruction,
  documents,
}: {
  reconstruction: CaseSnapshot["reconstruction"]
  documents: CaseSnapshot["documents"]
}) {
  const { t } = useTranslation("terminal")
  const scenes = reconstruction?.scenes ?? null
  const docNameById = new Map(documents.map((d) => [d.id, d.name]))

  if (!scenes || scenes.length === 0) {
    return <EmptyNote>{t("noScenes")}</EmptyNote>
  }

  return (
    <ul className="space-y-3">
      {scenes.map((scene) => (
        <li
          key={scene.index}
          className="rounded-md border border-border px-3 py-2.5"
        >
          <p className="text-[12px] font-semibold text-foreground">
            {[scene.time, scene.location].filter(Boolean).join(" · ") ||
              t("sceneUntitled", { n: scene.index + 1 })}
          </p>
          {scene.sourceRefs.length === 0 ? (
            <EmptyNote>{t("noExhibitsForScene")}</EmptyNote>
          ) : (
            <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {scene.sourceRefs.map((ref, i) => (
                <li
                  key={i}
                  className="rounded-md border border-border bg-muted px-2.5 py-2 text-[12px]"
                >
                  <p className="flex items-center gap-1.5 font-medium text-foreground">
                    <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {docNameById.get(ref.docId) ?? ref.docId}
                    </span>
                    {ref.page != null && (
                      <span className="shrink-0 text-muted-foreground">
                        · p.{ref.page}
                      </span>
                    )}
                  </p>
                  {ref.quote && (
                    <blockquote className="mt-1 flex items-start gap-1 border-l-2 border-border pl-2 text-muted-foreground italic">
                      <Quote
                        className="mt-0.5 h-2.5 w-2.5 shrink-0"
                        aria-hidden="true"
                      />
                      {ref.quote}
                    </blockquote>
                  )}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  )
}

// Not to be confused with CaseReconstructionPanel's audio (a single narrator reading Polly's
// OutputUri directly) — this is the two-host podcast-style script from useAudioOverview (shared
// with Case Workspace's Studio panel), driven off whichever consultation is most recently
// active for this case, the same "isolated" resolution ConsultationChat does internally for
// ChatPanel/MindMapPanel above. Uses the same docked AudioOverviewPlayerBar as Studio (see
// use-audio-overview-player.tsx) instead of a plain native <audio controls> — the two surfaces
// used to ship two different player UIs for the same data.
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
  const audioOverviewMessageId = activeAudioOverviewMessage?.id
  const {
    audioElement,
    isPlaying,
    playbackTime,
    playbackDuration,
    playbackRate,
    playerBarDismissed,
    setPlayerBarDismissed,
    togglePlayback,
    seek,
    skip,
    cycleRate,
    formatDuration,
  } = useAudioOverviewPlayer(renderedAudioUrl, audioOverviewMessageId)

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
      {!renderedAudioUrl && (
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
      {renderedAudioUrl && !playerBarDismissed && (
        <AudioOverviewPlayerBar
          title={t("case-portfolio:workspace.audioOverviewTile")}
          isPlaying={isPlaying}
          currentTime={playbackTime}
          duration={playbackDuration}
          playbackRate={playbackRate}
          onTogglePlay={togglePlayback}
          onSeek={seek}
          onSkip={skip}
          onCycleRate={cycleRate}
          onClose={() => setPlayerBarDismissed(true)}
          formatDuration={formatDuration}
        />
      )}
      {audioElement}
    </PanelBody>
  )
}
