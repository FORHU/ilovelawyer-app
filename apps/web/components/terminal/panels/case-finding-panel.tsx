import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Sparkles, Trash2 } from "lucide-react"
import { useCreateFindingMutation, useDeleteFindingMutation } from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type { CaseSnapshot, FindingCategory } from "@/lib/terminal/types"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

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
export function LegalIssuesPanel({ caseId }: { caseId: string }) {
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
        <PanelRowList>
          {items.map((node) => {
            const item = node.data as {
              label: string
              notes?: string | null
              sourceLabel?: string | null
            }
            return (
              <PanelRow key={node.id} className="items-start justify-between">
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
              </PanelRow>
            )
          })}
        </PanelRowList>
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
      {items.length === 0 ? (
        <EmptyNote>{t("noFindings")}</EmptyNote>
      ) : (
        <PanelRowList>
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
            </PanelRow>
          ))}
        </PanelRowList>
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
