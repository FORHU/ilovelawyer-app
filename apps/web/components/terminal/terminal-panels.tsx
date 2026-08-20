"use client"

import { useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { AlertTriangle, Info, Search } from "lucide-react"
import ConsultationChat from "@/components/chat/consultation-chat"
import { CaseTimelineView } from "@/components/cases/case-timeline"
import {
  useCheckCitationMutation,
  useConfirmDeadlineMutation,
  useCreateDeadlineMutation,
  useCreateProcedureItemMutation,
  useCreateRiskMutation,
  useProcedureRulesQuery,
  useScanContradictionsMutation,
  useUpdateProcedureItemMutation,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot, PanelId, SnapshotContradiction, SnapshotRisk } from "@/lib/terminal/types"

function formatDate(value: string | Date | null | undefined) {
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
  const label = item.factKey && item.factKey !== "other" ? item.factKey.replace(/_/g, " ") : null
  return label ? `${label}: ${left} vs ${right}` : `${left} vs ${right}`
}

const fieldClass =
  "h-8 min-w-0 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-ring focus:ring-2 focus:ring-ring/20"
const primaryBtnClass =
  "h-8 shrink-0 rounded-md bg-blue-600 px-3 text-[10px] font-semibold uppercase tracking-[1px] text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
const ghostBtnClass =
  "h-8 shrink-0 rounded-md border border-border bg-muted px-3 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:opacity-50"

type RiskLevel = "HIGH" | "MEDIUM" | "LOW"

const EMPTY_METER = { score: 0, level: "LOW" as const, drivers: [] as { code: string; count: number }[] }

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
    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[1.4px] text-muted-foreground">{children}</p>
  )
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rounded-md bg-muted px-3 py-4 text-center text-xs text-muted-foreground">{children}</p>
}

function TerminalRagBadge({ status }: { status: string | null }) {
  const { t } = useTranslation("terminal")
  if (status === "READY") {
    return <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1px] text-emerald-400">{t("ragReady")}</span>
  }
  if (status === "FAILED") {
    return <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1px] text-red-400">{t("ragFailed")}</span>
  }
  return <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{t("ragPending")}</span>
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
  const barColor = level === "HIGH" ? "bg-red-500" : level === "MEDIUM" ? "bg-orange-400" : "bg-emerald-400"
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
        <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">{label}</span>
        <span className={`rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[1px] ${badge}`}>
          {level} · {score}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${width}%` }} />
      </div>
      {driverText ? <p className="text-[11px] leading-4 text-muted-foreground">{driverText}</p> : null}
    </div>
  )
}

export function FatalRiskBanner({ risks }: { risks: SnapshotRisk[] }) {
  const { t } = useTranslation("terminal")
  if (risks.length === 0) return null
  return (
    <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-xs text-red-300">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{t("fatalBanner")}</span> {risks.map((r) => r.title).join(" · ")}
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
    <button type="button" onClick={onClick} disabled={pending} className={className ?? ghostBtnClass}>
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
      return <RedTeamPanel />
    case "procedure":
      return <ProcedurePanel snapshot={snapshot} caseId={caseId} />
    case "teamAudit":
      return <TeamAuditPanel snapshot={snapshot} />
    default:
      return null
  }
}

function ChatPanel({ caseId, caseName }: { caseId: string; caseName: string }) {
  const { t } = useTranslation("terminal")
  return (
    <ConsultationChat
      embedded
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
      mindMapOnly
      basePath={`/homepage/terminal/${caseId}`}
      caseId={caseId}
    />
  )
}

function CommandPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const createRisk = useCreateRiskMutation(caseId)
  const [title, setTitle] = useState("")
  const statusLabel = snapshot.case.actionType?.trim() || snapshot.case.jurisdiction?.trim() || null

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-4 text-sm text-foreground">
      <div>
        <SectionLabel>{t("parties")}</SectionLabel>
        {snapshot.case.parties.length === 0 ? (
          <p className="text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.case.parties.map((party) => (
              <li key={party.id}>
                <p className="text-[15px] font-medium leading-snug text-foreground">{party.name}</p>
                {party.designation ? (
                  <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] text-muted-foreground">
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
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
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
          <button type="submit" disabled={createRisk.isPending} className={primaryBtnClass}>
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
    </div>
  )
}

function EvidencePanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const scan = useScanContradictionsMutation(caseId)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 text-sm text-foreground">
      <div>
        <SectionLabel>
          {t("documents")} ({snapshot.documents.length})
        </SectionLabel>
        {snapshot.documents.length === 0 ? (
          <EmptyNote>{t("noDocuments")}</EmptyNote>
        ) : (
          <ul className="space-y-1">
            {snapshot.documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 rounded-md px-1 py-1.5">
                <span className="truncate text-[13px] text-foreground">{doc.name}</span>
                <TerminalRagBadge status={doc.ragStatus} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => scan.mutate()}
        disabled={scan.isPending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-blue-600 text-[11px] font-semibold uppercase tracking-[1.4px] text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        {scan.isPending ? t("scanning") : t("scan")}
      </button>

      {snapshot.evidence.contradictions.length > 0 && (
        <div>
          <SectionLabel>{t("contradictions")}</SectionLabel>
          <ul className="space-y-3">
            {snapshot.evidence.contradictions.map((item) => (
              <li key={item.id} className="rounded-md border border-orange-400/20 bg-orange-500/5 px-3 py-2.5">
                <p className="font-mono text-[12px] text-orange-400">
                  {contradictionHeadline(item)}
                </p>
                {item.leftExcerpt ? (
                  <p className="mt-2 text-[12px] leading-5 text-foreground/80">“{item.leftExcerpt}”</p>
                ) : null}
                {item.rightExcerpt ? (
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">“{item.rightExcerpt}”</p>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <SectionLabel>{t("timeline")}</SectionLabel>
        <CaseTimelineView caseId={caseId} fill={false} />
      </div>
    </div>
  )
}

function LawPanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const check = useCheckCitationMutation(caseId)
  const [quotedText, setQuotedText] = useState("")
  const [officialText, setOfficialText] = useState("")

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4 text-sm text-foreground">
      <SectionLabel>{t("citations")}</SectionLabel>
      {snapshot.law.citations.length === 0 ? (
        <EmptyNote>{t("noCitations")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {snapshot.law.citations.map((citation) => (
            <li key={citation.id} className="rounded-md border border-border p-3">
              <p className="line-clamp-3 text-sm leading-5">{citation.quotedText}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[1px] text-muted-foreground">{citation.status}</p>
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
          check.mutate({ quotedText: quote, officialText: officialText.trim() || undefined })
          setQuotedText("")
          setOfficialText("")
        }}
      >
        <textarea
          value={quotedText}
          onChange={(e) => setQuotedText(e.target.value)}
          placeholder={t("quote")}
          rows={2}
          className="rounded-md border border-border bg-muted px-2.5 py-2 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-blue-500/70 focus:ring-2 focus:ring-blue-500/20"
        />
        <input
          value={officialText}
          onChange={(e) => setOfficialText(e.target.value)}
          placeholder={t("officialText")}
          className={fieldClass}
        />
        <button type="submit" disabled={check.isPending} className={`${primaryBtnClass} self-start`}>
          {t("verify")}
        </button>
      </form>
    </div>
  )
}

function RedTeamPanel() {
  const { t } = useTranslation("terminal")
  return (
    <div className="p-4">
      <EmptyNote>{t("redTeamParked")}</EmptyNote>
    </div>
  )
}

function ProcedurePanel({ snapshot, caseId }: { snapshot: CaseSnapshot; caseId: string }) {
  const { t } = useTranslation("terminal")
  const rules = useProcedureRulesQuery()
  const createDeadline = useCreateDeadlineMutation(caseId)
  const confirmDeadline = useConfirmDeadlineMutation(caseId)
  const createItem = useCreateProcedureItemMutation(caseId)
  const updateItem = useUpdateProcedureItemMutation(caseId)
  const [ruleCode, setRuleCode] = useState("")
  const [triggerDate, setTriggerDate] = useState("")
  const [todoLabel, setTodoLabel] = useState("")

  const items = snapshot.procedure.items
  const approachItems = items.filter((item) => item.kind.toUpperCase() === "STRATEGY")
  const todoItems = items.filter((item) => item.kind.toUpperCase() !== "STRATEGY")
  const fallbackApproach = snapshot.risks.slice(0, 3).map((risk) => risk.title)
  const overall = snapshot.riskAnalysis?.overall ?? EMPTY_METER
  const liability = snapshot.riskAnalysis?.liability ?? EMPTY_METER

  return (
    <div className="flex h-full min-h-0 flex-col gap-5 overflow-y-auto p-4 text-sm text-foreground">
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
                    onChange={() => updateItem.mutate({ id: item.id, done: !item.done })}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border bg-muted accent-blue-500"
                  />
                  <span className={`text-[13px] leading-5 ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
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
          <button type="submit" disabled={createItem.isPending} className={primaryBtnClass}>
            {t("add")}
          </button>
        </form>
      </div>

      <div>
        <SectionLabel>{t("riskAnalysis")}</SectionLabel>
        <div className="space-y-3">
          <RiskMeter label={t("overallRisk")} score={overall.score} level={overall.level} drivers={overall.drivers} />
          <RiskMeter label={t("liabilityRisk")} score={liability.score} level={liability.level} drivers={liability.drivers} />
        </div>
      </div>

      <div>
        <SectionLabel>{t("deadlines")}</SectionLabel>
        {snapshot.procedure.deadlines.length === 0 ? (
          <EmptyNote>{t("computeDeadline")}</EmptyNote>
        ) : (
          <ul className="space-y-2">
            {snapshot.procedure.deadlines.map((deadline) => {
              const confirms = (deadline.confirmations ?? []).filter((c) => c.confirmed).length
              return (
                <li key={deadline.id} className="rounded-md border border-border p-3">
                  <p className="font-medium">{deadline.label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(deadline.computedDueDate)} · {confirms}/2 {t("confirmed")}
                  </p>
                  <button
                    type="button"
                    onClick={() => confirmDeadline.mutate(deadline.id)}
                    disabled={confirmDeadline.isPending}
                    className="mt-2 text-[10px] font-semibold uppercase tracking-[1px] text-blue-400 hover:underline disabled:opacity-50"
                  >
                    {t("confirmDeadline")}
                  </button>
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
            createDeadline.mutate({ ruleCode, triggerDate })
          }}
        >
          <select value={ruleCode} onChange={(e) => setRuleCode(e.target.value)} className={fieldClass}>
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
          <button type="submit" disabled={createDeadline.isPending} className={`${primaryBtnClass} self-start`}>
            {t("computeDeadline")}
          </button>
        </form>
      </div>
    </div>
  )
}

function TeamAuditPanel({ snapshot }: { snapshot: CaseSnapshot }) {
  const { t } = useTranslation("terminal")
  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4 text-sm text-foreground">
      <SectionLabel>{t("audit")}</SectionLabel>
      {snapshot.teamAudit.audit.length === 0 ? (
        <EmptyNote>{t("noAudit")}</EmptyNote>
      ) : (
        <ul className="space-y-2">
          {snapshot.teamAudit.audit.map((event) => (
            <li key={event.id} className="flex items-start justify-between gap-2 rounded-md border border-border px-3 py-2">
              <span>{event.action}</span>
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{formatDate(event.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
