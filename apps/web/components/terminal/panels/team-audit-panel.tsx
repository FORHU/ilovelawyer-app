import { useTranslation } from "react-i18next"
import type { CaseSnapshot } from "@/lib/terminal/types"
import { auditEventText } from "@/lib/terminal/audit-label"
import { useLiveAudit } from "@/lib/terminal/mutations"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, SectionLabel, TonePill } from "@/components/terminal/panel-kit"

// Today's events show a clock time, older ones a short date — the log is newest-first and spans days.
function formatEventTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" })
}

export function TeamAuditPanel({ snapshot }: { snapshot: CaseSnapshot }) {
  const { t } = useTranslation("terminal")
  const { team, audit } = snapshot.teamAudit
  const live = useLiveAudit(snapshot.case.id)
  return (
    <PanelBody gap="3">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>
          {t("team")} · {team.length}
        </SectionLabel>
        {live && (
          <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[1px] text-ok uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
            {t("live")}
          </span>
        )}
      </div>
      {team.length === 0 ? (
        <EmptyNote>{t("noTeam")}</EmptyNote>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {team.map((member) => (
            <li
              key={member.userId}
              title={member.name}
              className="flex items-center gap-2 rounded-full border border-border bg-muted py-1 pr-2.5 pl-1"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[9px] font-bold tracking-[0.4px] text-foreground">
                {member.initials}
              </span>
              <span className="text-[10px] font-semibold tracking-[1.2px] text-muted-foreground uppercase">
                {t(`teamRole${member.role}`)} · {member.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      <SectionLabel>{t("auditReadOnly")}</SectionLabel>
      <PanelRowList empty={<EmptyNote>{t("noAudit")}</EmptyNote>}>
        {audit.map((event) => {
          const label = auditEventText(event)
          return (
            <PanelRow key={event.id} className="gap-2.5" title={label}>
              <span className="w-12 shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatEventTime(event.createdAt)}</span>
              <span className="flex w-24 shrink-0">
                <TonePill tone="neutral" title={event.actorName ?? undefined}>
                  <span className="block max-w-20 truncate">{event.actorName ?? t("auditSystem")}</span>
                </TonePill>
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{label}</span>
            </PanelRow>
          )
        })}
      </PanelRowList>
    </PanelBody>
  )
}
