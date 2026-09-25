import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Sparkles, Trash2 } from "lucide-react"
import { useCreateFindingMutation, useDeleteFindingMutation } from "@/lib/terminal/mutations"
import type { CaseSnapshot, FindingCategory } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// Backs Weaknesses / Strengths / Attack Strategies / Defense Strategies — one CaseFinding table
// filtered by category (see lib/terminal/mutations.ts), same as the backend. Legal Issues has its
// own panel (legal-issues-panel.tsx).
const FINDING_ADD_LABEL_KEYS: Record<FindingCategory, string> = {
  LEGAL_ISSUE: "addLegalIssue",
  WEAKNESS: "addWeakness",
  STRENGTH: "addStrength",
  ATTACK_STRATEGY: "addAttackStrategy",
  DEFENSE_STRATEGY: "addDefenseStrategy",
}

export function CaseFindingPanel({
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
      <PanelRowList empty={<EmptyNote>{t("noFindings")}</EmptyNote>}>
        {items.map((item) => (
          <PanelRow key={item.id} className="items-start justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-5 text-foreground">{item.label}</p>
              {item.notes === "AI" && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-brand-gold uppercase">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {t("aiGenerated")}
                </span>
              )}
              {item.sourceLabel && (
                <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <FileText className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="truncate" title={item.sourceLabel}>
                    {t("groundedIn", { doc: item.sourceLabel })}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => del.mutate(item.id)}
              disabled={del.isPending}
              className={dangerIconBtnClass}
              aria-label={t("delete")}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </PanelRow>
        ))}
      </PanelRowList>
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
          aria-label={t(FINDING_ADD_LABEL_KEYS[category])}
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
      <MutationError show={create.isError || del.isError} />
    </PanelBody>
  )
}
