import { useMemo, useState, type ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ArrowDown, ArrowUp, Plus } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import { useCreateRiskMutation } from "@/lib/terminal/mutations"
import { useTerminalDisplayStore } from "@/lib/store/terminal-display.store"
import type { CaseSnapshot, SnapshotRisk } from "@/lib/terminal/types"
import {
  CASE_SUMMARY_SAMPLE,
  buildSummaryView,
  relativeLabel,
  sampleSummaryView,
  type Kpi,
} from "@/lib/terminal/case-summary-view"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  SectionLabel,
  bodyTextClass,
  fieldClass,
  labelTextClass,
  primaryBtnClass,
  secondaryTextClass,
} from "@/components/terminal/panel-kit"
import { BAND_BADGE, BAND_TONE, ConfidenceMeter, OutlookGauge, Sparkline } from "@/components/terminal/panels/summary-visuals"

const RISK_TIER: Record<SnapshotRisk["severity"], { label: string; tone: "danger" | "warning" | "success" }> = {
  FATAL: { label: "HIGH", tone: "danger" },
  MAJOR: { label: "HIGH", tone: "danger" },
  UNVERIFIED: { label: "MEDIUM", tone: "warning" },
  DEADLINE: { label: "MEDIUM", tone: "warning" },
  MISSING_EVIDENCE: { label: "LOW", tone: "success" },
}

function KpiTile({
  label,
  value,
  unit,
  kpi,
  upIsGood,
  foot,
  footUrgent,
}: {
  label: string
  value: ReactNode
  unit?: string
  kpi?: Kpi | null
  upIsGood?: boolean
  foot?: ReactNode
  footUrgent?: boolean
}) {
  const { t } = useTranslation("terminal")
  const delta = kpi?.delta ?? null
  const good = delta !== null && delta !== 0 && delta > 0 === !!upIsGood
  const trendTone = delta === null || delta === 0 ? "text-muted-foreground" : good ? "text-ok" : "text-danger"
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border border-border p-3">
      <p className={labelTextClass}>{label}</p>
      <div className="flex items-end justify-between gap-2">
        <p className="flex items-baseline gap-1 text-foreground">
          <span className="text-2xl leading-none font-semibold tabular-nums">{value}</span>
          {unit ? <span className="text-xs text-muted-foreground">{unit}</span> : null}
        </p>
        {kpi ? <Sparkline points={kpi.trend} className={trendTone} /> : null}
      </div>
      {delta !== null ? (
        <p className={cn("inline-flex items-center gap-1 text-[11px]", trendTone)}>
          {delta === 0 ? null : delta > 0 ? <ArrowUp className="size-3" aria-hidden="true" /> : <ArrowDown className="size-3" aria-hidden="true" />}
          <span className="tabular-nums">{delta > 0 ? `+${delta}` : delta}</span> {t("thisWeek")}
        </p>
      ) : foot ? (
        <p className={cn("text-[11px]", footUrgent ? "text-danger" : "text-muted-foreground")}>{foot}</p>
      ) : null}
    </div>
  )
}

export function CommandPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t, i18n } = useTranslation("terminal")
  const dense = useTerminalDisplayStore((state) => state.highDensity)
  const createRisk = useCreateRiskMutation(caseId)
  const [title, setTitle] = useState("")
  const [adding, setAdding] = useState(false)
  // Sample mode only: risks added in the preview stay local so the fake case never writes to a real one.
  const [localRisks, setLocalRisks] = useState<SnapshotRisk[]>([])
  const view = useMemo(() => (CASE_SUMMARY_SAMPLE ? sampleSummaryView() : buildSummaryView(snapshot)), [snapshot])
  const risks = [...view.risks, ...localRisks]
  const { outlook, deadline } = view

  const overdue = deadline ? deadline.days < 0 : false
  const dueLabel = deadline
    ? new Date(deadline.dueISO).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })
    : null

  return (
    <PanelBody gap="4">
      <div className={cn("@container flex flex-col", dense ? "gap-2.5" : "gap-4")}>
        {CASE_SUMMARY_SAMPLE ? (
          <Badge tone="caution" className="self-start">
            {t("sampleData")}
          </Badge>
        ) : null}

        <section className="rounded-2xl border border-border p-4">
          {outlook ? (
            <div className="grid items-center gap-x-6 gap-y-3 @md:grid-cols-[auto_1fr]">
              <div className="flex flex-col items-center gap-1">
                <OutlookGauge band={outlook.band} label={`${t(`band_${outlook.band}`)}, ${t(`confidence_${outlook.confidence}`)}`} />
                <div className="flex w-40 justify-between font-mono text-[9px] tracking-[1px] text-muted-foreground uppercase">
                  <span>{t("band_UNFAVORABLE")}</span>
                  <span>{t("band_FAVORABLE")}</span>
                </div>
                <p className="mt-1 inline-flex items-center gap-2 text-[15px] leading-tight font-semibold text-foreground">
                  <ConfidenceMeter level={outlook.confidence} label={t(`confidence_${outlook.confidence}`)} />
                  {t(`confidence_${outlook.confidence}`)}
                </p>
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className={labelTextClass}>{t("outlook")}</p>
                  <Badge tone={BAND_BADGE[outlook.band]} shape="pill" className="border border-current/40">
                    {t(`band_${outlook.band}`)}
                  </Badge>
                </div>
                {view.outlookHistory.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {view.outlookHistory.map((h, i) => (
                      <li key={h.createdAt} className="flex items-baseline justify-between gap-3 py-1.5 text-[13px]">
                        <span className="text-muted-foreground">
                          {i === 0 ? t("previousReview") : relativeLabel(h.createdAt, i18n.language)}
                        </span>
                        <span className={cn("font-semibold", BAND_TONE[h.band])}>{t(`band_${h.band}`)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <p className={cn("@md:col-span-2", secondaryTextClass)}>{outlook.rationale}</p>
              <p className="text-[11px] text-muted-foreground @md:col-span-2">{t("outlookDisclaimer")}</p>
            </div>
          ) : (
            <div>
              <SectionLabel>{t("outlook")}</SectionLabel>
              <p className={bodyTextClass}>{t("outlookEmpty")}</p>
              <p className={secondaryTextClass}>{t("outlookEmptyHint")}</p>
            </div>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2 @xl:grid-cols-4">
          {view.health ? (
            <KpiTile label={t("kpiHealth")} value={view.health.value} unit="/100" kpi={view.health} upIsGood />
          ) : null}
          <KpiTile
            label={t("kpiDeadline")}
            value={deadline ? Math.abs(deadline.days) : "-"}
            unit={deadline ? `${t("dayCount", { count: Math.abs(deadline.days) })}${overdue ? ` ${t("overdue")}` : ""}` : undefined}
            foot={
              deadline
                ? `${dueLabel}${deadline.confirmed === null ? "" : ` · ${t(deadline.confirmed ? "confirmed" : "unconfirmed")}`}`
                : t("noDeadline")
            }
            footUrgent={!!deadline && deadline.days <= 3}
          />
          <KpiTile label={t("kpiOpenIssues")} value={view.openIssues.value} unit={t("unitOpen")} kpi={view.openIssues} />
          <KpiTile label={t("kpiEvidence")} value={view.evidence.value} unit={t("unitDocs")} kpi={view.evidence} upIsGood />
        </div>

        {view.parties.length > 0 ? (
          <div className="grid grid-cols-1 gap-2 @md:grid-cols-2">
            {view.parties.map((party) => (
              <div key={party.id} className="rounded-2xl border border-border p-3">
                {party.designation ? <p className={labelTextClass}>{party.designation}</p> : null}
                <p className="mt-1 text-[13px] leading-snug font-semibold text-foreground">{party.name}</p>
                {party.descriptor ? <p className={cn("mt-0.5", secondaryTextClass)}>{party.descriptor}</p> : null}
              </div>
            ))}
          </div>
        ) : null}

        {view.claims || view.posture ? (
          <div className="grid gap-x-6 gap-y-3 @md:grid-cols-2">
            {view.claims ? (
              <div>
                <SectionLabel>{t("claims")}</SectionLabel>
                <p className="text-[13px] leading-snug text-foreground">{view.claims}</p>
              </div>
            ) : null}
            {view.posture ? (
              <div>
                <SectionLabel>{t("posture")}</SectionLabel>
                <p className="text-[13px] leading-snug text-foreground">{view.posture}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className={labelTextClass}>
              {t("keyIssues")} · {risks.length}
            </p>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              aria-expanded={adding}
              className="inline-flex items-center gap-1 rounded text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase transition-colors hover:text-brand-gold/80 focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none"
            >
              <Plus className="size-3" aria-hidden="true" />
              {t("add")}
            </button>
          </div>
          <PanelRowList bare empty={<EmptyNote>{t("noKeyIssues")}</EmptyNote>}>
            {risks.map((risk) => {
              const tier = RISK_TIER[risk.severity]
              return (
                <PanelRow key={risk.id} className="px-0 py-1.5">
                  <Badge tone={tier.tone} shape="pill">
                    {tier.label}
                  </Badge>
                  <span className="min-w-0 flex-1 text-[13px] leading-5 text-foreground">{risk.title}</span>
                  {risk.confidence ? (
                    <ConfidenceMeter level={risk.confidence} label={t(`confidence_${risk.confidence}`)} />
                  ) : null}
                </PanelRow>
              )
            })}
          </PanelRowList>
          {adding ? (
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const value = title.trim()
                if (!value) return
                if (CASE_SUMMARY_SAMPLE) {
                  setLocalRisks((prev) => [
                    ...prev,
                    { id: `local-${prev.length}`, title: value, description: null, severity: "MAJOR", status: "OPEN", pageNumber: null },
                  ])
                } else {
                  createRisk.mutate({ title: value, severity: "MAJOR" })
                }
                setTitle("")
              }}
            >
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("addRisk")}
                aria-label={t("addRisk")}
                className={`flex-1 ${fieldClass}`}
              />
              <button type="submit" disabled={createRisk.isPending} className={primaryBtnClass}>
                {t("add")}
              </button>
            </form>
          ) : null}
          <MutationError show={createRisk.isError} />
        </div>
      </div>
    </PanelBody>
  )
}
