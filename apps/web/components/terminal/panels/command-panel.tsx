import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { useCreateRiskMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, SnapshotRisk } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, SectionLabel, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

const RISK_TIER: Record<SnapshotRisk["severity"], { label: string; tone: "danger" | "warning" | "success" }> = {
  FATAL: { label: "HIGH", tone: "danger" },
  MAJOR: { label: "HIGH", tone: "danger" },
  UNVERIFIED: { label: "MEDIUM", tone: "warning" },
  DEADLINE: { label: "MEDIUM", tone: "warning" },
  MISSING_EVIDENCE: { label: "LOW", tone: "success" },
}

export function CommandPanel({
  snapshot,
  caseId,
}: {
  snapshot: CaseSnapshot
  caseId: string
}) {
  const { t } = useTranslation("terminal")
  const createRisk = useCreateRiskMutation(caseId)
  const [title, setTitle] = useState("")
  const claims = snapshot.case.actionType?.trim() || null
  const posture = snapshot.case.jurisdiction?.trim() || null

  return (
    <PanelBody gap="5">
      {snapshot.case.parties.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {snapshot.case.parties.map((party) => (
            <div key={party.id} className="rounded-xl border border-border p-3">
              {party.designation ? (
                <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                  {party.designation}
                </p>
              ) : null}
              <p className="mt-1 text-[13px] leading-snug font-semibold text-foreground">
                {party.name}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {claims || posture ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {claims ? (
            <div>
              <SectionLabel>{t("claims")}</SectionLabel>
              <p className="text-[13px] leading-snug text-foreground">{claims}</p>
            </div>
          ) : null}
          {posture ? (
            <div>
              <SectionLabel>{t("posture")}</SectionLabel>
              <p className="text-[13px] leading-snug text-foreground">{posture}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>
            {t("keyIssues")} · {snapshot.risks.length}
          </SectionLabel>
        </div>
        {snapshot.risks.length === 0 ? (
          <EmptyNote>{t("noKeyIssues")}</EmptyNote>
        ) : (
          <PanelRowList>
            {snapshot.risks.map((risk) => {
              const tier = RISK_TIER[risk.severity]
              return (
                <PanelRow key={risk.id}>
                  <Badge tone={tier.tone} shape="pill">
                    {tier.label}
                  </Badge>
                  <span className="min-w-0 flex-1 text-[13px] leading-5 text-foreground">
                    {risk.title}
                  </span>
                </PanelRow>
              )
            })}
          </PanelRowList>
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
            aria-label={t("addRisk")}
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
        <MutationError show={createRisk.isError} />
      </div>
    </PanelBody>
  )
}
