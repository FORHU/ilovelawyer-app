import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@workspace/ui/components/badge"
import { useCreateRiskMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, SnapshotRisk } from "@/lib/terminal/types"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, SectionLabel, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

const RISK_SEVERITY_TONE: Record<SnapshotRisk["severity"], "danger" | "warning" | "caution" | "neutral"> = {
  FATAL: "danger",
  MAJOR: "warning",
  UNVERIFIED: "caution",
  MISSING_EVIDENCE: "neutral",
  DEADLINE: "neutral",
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
          <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
            {snapshot.case.parties.map((party) => (
              <div key={party.id} className="rounded-lg border border-border p-2.5">
                {party.designation ? (
                  <p className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                    {party.designation}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[13px] leading-snug font-medium text-foreground">
                  {party.name}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>{t("keyIssues")}</SectionLabel>
        {snapshot.risks.length === 0 ? (
          <EmptyNote>{t("noKeyIssues")}</EmptyNote>
        ) : (
          <PanelRowList>
            {snapshot.risks.map((risk) => (
              <PanelRow key={risk.id}>
                <Badge tone={RISK_SEVERITY_TONE[risk.severity]} shape="pill">
                  {risk.severity}
                </Badge>
                <span className="min-w-0 flex-1 text-[13px] leading-5 text-foreground">
                  {risk.title}
                </span>
              </PanelRow>
            ))}
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
