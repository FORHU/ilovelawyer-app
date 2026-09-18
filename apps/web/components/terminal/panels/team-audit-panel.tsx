import { useTranslation } from "react-i18next"
import type { CaseSnapshot } from "@/lib/terminal/types"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, SectionLabel, formatDate } from "@/components/terminal/panel-kit"

export function TeamAuditPanel({ snapshot }: { snapshot: CaseSnapshot }) {
  const { t } = useTranslation("terminal")
  return (
    <PanelBody gap="3">
      <SectionLabel>{t("audit")}</SectionLabel>
      {snapshot.teamAudit.audit.length === 0 ? (
        <EmptyNote>{t("noAudit")}</EmptyNote>
      ) : (
        <PanelRowList>
          {snapshot.teamAudit.audit.map((event) => (
            <PanelRow key={event.id} className="justify-between gap-2">
              <span className="min-w-0 flex-1 text-[13px] text-foreground">{event.action}</span>
              {/* No display name is available for actorId here (id only, no user lookup in this
               * snapshot) — showing the timestamp only rather than fabricating an actor label. */}
              <span className="shrink-0 text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                {formatDate(event.createdAt)}
              </span>
            </PanelRow>
          ))}
        </PanelRowList>
      )}
    </PanelBody>
  )
}
