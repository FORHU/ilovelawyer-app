import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { FileText, Loader2, Paperclip, Sparkles, Trash2 } from "lucide-react"
import { useCreateFindingMutation, useDeleteFindingMutation, useUpdateFindingMutation } from "@/lib/terminal/mutations"
import { useCaseDocumentUpload } from "@/lib/terminal/use-case-document-upload"
import { ALLOWED_EXTENSIONS } from "@/lib/cases/upload-batch"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import type { CaseFinding, CaseSnapshot, FindingCategory, FindingReadiness } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, labelTextClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// Only these two categories carry readiness — see case-finding-parse.ts on the backend.
const READINESS_CATEGORIES: FindingCategory[] = ["ATTACK_STRATEGY", "DEFENSE_STRATEGY"]

const READINESSES: FindingReadiness[] = ["READY", "DRAFTING", "BLOCKED"]
const READINESS_STYLE: Record<FindingReadiness, { badge: string; bar: string; label: string }> = {
  READY: { badge: "border-emerald-500/50 bg-emerald-500/10 text-emerald-500", bar: "bg-emerald-500", label: "readinessReady" },
  DRAFTING: { badge: "border-amber-500/50 bg-amber-500/10 text-amber-500", bar: "bg-amber-400", label: "readinessDrafting" },
  BLOCKED: { badge: "border-red-400/50 bg-red-400/10 text-red-400", bar: "bg-red-400", label: "readinessBlocked" },
}
// Mirrors STRATEGY_READINESS_JEV_MIN_CONFIDENCE in the API (strategy-readiness-jev.ts): below it Jev's read is noise.
const JEV_MIN_CONFIDENCE = 0.7

function ReadinessSummaryHeader({ items }: { items: CaseFinding[] }) {
  const { t } = useTranslation("terminal")
  const counts: Record<FindingReadiness, number> = { READY: 0, DRAFTING: 0, BLOCKED: 0 }
  items.forEach((item) => {
    counts[item.readiness ?? "DRAFTING"] += 1
  })
  const total = items.length
  const readyPct = total ? Math.round((counts.READY / total) * 100) : 0
  const ringR = 15.9155
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r={ringR} fill="none" strokeWidth="3" className="stroke-border" />
          <circle
            cx="18"
            cy="18"
            r={ringR}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            className="stroke-emerald-500"
            strokeDasharray={`${readyPct} 100`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
          {readyPct}%
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
          {READINESSES.map((r) => (counts[r] ? <div key={r} className={READINESS_STYLE[r].bar} style={{ flexGrow: counts[r] }} /> : null))}
        </div>
        <div className={`mt-1.5 flex flex-wrap gap-x-3 ${labelTextClass}`}>
          {READINESSES.map((r) => (
            <span key={r} className="inline-flex items-center gap-1">
              {t(READINESS_STYLE[r].label)} <span>{counts[r]}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
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
      <PanelRowList empty={<EmptyNote>{t("noFindings")}</EmptyNote>}>
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
                    <span className="truncate" title={item.sourceLabel}>
                      {t("groundedIn", { doc: item.sourceLabel })}
                    </span>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => del.mutate(node.refId)}
                disabled={del.isPending}
                className={dangerIconBtnClass}
                aria-label={t("delete")}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </PanelRow>
          )
        })}
      </PanelRowList>
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
          aria-label={t(FINDING_ADD_LABEL_KEYS.LEGAL_ISSUE)}
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
  const update = useUpdateFindingMutation(caseId)
  const del = useDeleteFindingMutation(caseId)
  const [label, setLabel] = useState("")
  const items = snapshot.findings.filter((f) => f.category === category)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useCaseDocumentUpload(caseId)
  const hasReadiness = READINESS_CATEGORIES.includes(category)

  return (
    <PanelBody gap="4">
      {hasReadiness && items.length > 0 ? <ReadinessSummaryHeader items={items} /> : null}
      <PanelRowList empty={<EmptyNote>{t("noFindings")}</EmptyNote>}>
        {items.map((item) => {
          const readiness = item.readiness ?? "DRAFTING"
          const nextReadiness = READINESSES[(READINESSES.indexOf(readiness) + 1) % READINESSES.length]!
          const jevDisagrees =
            hasReadiness && item.jevReadiness && (item.jevConfidence ?? 0) >= JEV_MIN_CONFIDENCE && item.jevReadiness !== readiness
          const jevAgrees =
            hasReadiness && item.jevReadiness && (item.jevConfidence ?? 0) >= JEV_MIN_CONFIDENCE && item.jevReadiness === readiness
          return (
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
                {hasReadiness && item.readinessNote && (
                  <p className={`mt-1 ${labelTextClass}`}>{item.readinessNote}</p>
                )}
                {jevAgrees && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase">
                    <Sparkles size={10} aria-hidden="true" />
                    {t("jevAgrees")}
                  </p>
                )}
                {jevDisagrees && (
                  <button
                    type="button"
                    onClick={() => update.mutate({ id: item.id, readiness: item.jevReadiness! })}
                    disabled={update.isPending}
                    className="mt-1 flex items-center gap-1.5 rounded-md border border-brand-gold/40 bg-brand-gold/10 px-2 py-1 text-left text-[11px] text-foreground transition-colors hover:bg-brand-gold/20 focus-visible:ring-2 focus-visible:ring-brand-gold/40 focus-visible:outline-none disabled:opacity-50"
                  >
                    <Sparkles size={11} className="shrink-0 text-brand-gold" aria-hidden="true" />
                    <span>
                      {t("jevSuggestsReadiness", {
                        readiness: t(READINESS_STYLE[item.jevReadiness!].label),
                        pct: Math.round((item.jevConfidence ?? 0) * 100),
                      })}
                    </span>
                    <span className="font-semibold text-brand-gold uppercase">{t("jevApply")}</span>
                  </button>
                )}
              </div>
              {hasReadiness && (
                <button
                  type="button"
                  onClick={() => update.mutate({ id: item.id, readiness: nextReadiness })}
                  disabled={update.isPending}
                  title={t("findingCycleReadiness")}
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] disabled:opacity-50 ${READINESS_STYLE[readiness].badge}`}
                >
                  {t(READINESS_STYLE[readiness].label)}
                </button>
              )}
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
          )
        })}
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
        {/* Uploads go to the case's one document pool (same as the Evidence pane), which the
            automatic analysis then reads — findings aren't stored per-document. */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ""
            if (files.length > 0) upload(files)
          }}
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          aria-label={t("uploadDocuments")}
          title={t("uploadDocuments")}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground disabled:cursor-wait disabled:opacity-60"
        >
          {isUploading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>
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
      <MutationError show={create.isError || del.isError || update.isError} />
    </PanelBody>
  )
}
