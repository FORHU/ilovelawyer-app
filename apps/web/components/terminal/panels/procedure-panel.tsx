import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import {
  useConfirmDeadlineMutation,
  useCreateDeadlineMutation,
  useCreateProcedureItemMutation,
  useProcedureRulesQuery,
  useRecomputeDeadlineMutation,
  useUpdateProcedureItemMutation,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot } from "@/lib/terminal/types"
import { useAuthStore } from "@/lib/store/auth.store"
import { getStatus } from "@/config/tenant-codes/capabilities"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  fieldClass,
  formatDate,
  primaryBtnClass,
} from "@/components/terminal/panel-kit"

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
      ? "bg-danger"
      : level === "MEDIUM"
        ? "bg-riskmed"
        : "bg-ok"
  const badgeTone = level === "HIGH" ? "danger" : level === "MEDIUM" ? "warning" : "success"
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
        <Badge tone={badgeTone}>
          {level} · {score}
        </Badge>
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

export function ProcedurePanel({
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
                    <span className="truncate" title={t("groundedIn", { doc: item.sourceLabel })}>
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
                        <span className="truncate" title={t("groundedIn", { doc: item.sourceLabel })}>
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
            aria-label={t("addTodo")}
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
        <MutationError show={createItem.isError || updateItem.isError} />
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
            <Badge tone="caution" shape="pill">
              {t("deadlinesProvisional")}
            </Badge>
          )}
        </div>
        {snapshot.procedure.deadlines.length === 0 ? (
          <EmptyNote>{t("computeDeadline")}</EmptyNote>
        ) : (
          <PanelRowList>
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
                <PanelRow key={deadline.id} className="flex-col items-start gap-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium">{deadline.label}</p>
                    {stale && (
                      <Badge tone="caution" shape="pill" title={stale.staleReason}>
                        {t("staleBadge")}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">
                      {formatDate(deadline.computedDueDate)}
                    </span>{" "}
                    · {confirms}/{snapshot.procedure.requiredConfirmations}{" "}
                    {t("confirmed")}
                  </p>
                  <div className="flex items-center gap-3">
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
                </PanelRow>
              )
            })}
          </PanelRowList>
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
            aria-label={t("computeDeadline")}
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
            aria-label={t("linkToTimelineEvent")}
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
        <MutationError show={confirmDeadline.isError || recomputeDeadline.isError || createDeadline.isError} />
      </div>
    </PanelBody>
  )
}
