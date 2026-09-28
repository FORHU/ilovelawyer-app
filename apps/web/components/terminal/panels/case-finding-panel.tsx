import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, CircleCheck, FileText, Loader2, Paperclip, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import {
  useCreateFindingMutation,
  useCreateProcedureItemMutation,
  useCreateRiskMutation,
  useDeleteFindingMutation,
} from "@/lib/terminal/mutations"
import { useCaseDocumentUpload } from "@/lib/terminal/use-case-document-upload"
import { ALLOWED_EXTENSIONS } from "@/lib/cases/upload-batch"
import type { CaseSnapshot, FindingCategory } from "@/lib/terminal/types"
import { EmptyNote, MutationError, PanelBody, PanelRow, PanelRowList, dangerIconBtnClass, fieldClass, primaryBtnClass } from "@/components/terminal/panel-kit"

// Backs Attack Strategies / Defense Strategies — one CaseFinding table filtered by category (see
// lib/terminal/mutations.ts), same as the backend. Legal Issues, Weaknesses and Strengths have
// their own panels on RatedFindingPanel (rated-finding-panel.tsx).
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
  const sendToChecklist = useCreateProcedureItemMutation(caseId)
  const flagRisk = useCreateRiskMutation(caseId)
  // Ids already sent from this panel this session, so a second click can't double-add.
  const [sentToChecklist, setSentToChecklist] = useState<Set<string>>(new Set())
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [label, setLabel] = useState("")
  const items = snapshot.findings.filter((f) => f.category === category)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { upload, isUploading } = useCaseDocumentUpload(caseId)

  return (
    <PanelBody gap="4">
      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden, so letting
          it shrink clips the rows instead of scrolling PanelBody. */}
      <div className="shrink-0">
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
                <div className="mt-1.5 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={sentToChecklist.has(item.id) || sendToChecklist.isPending}
                    onClick={() =>
                      sendToChecklist.mutate(
                        { kind: "TODO", label: item.label, sourceLabel: t(`findingCategory.${category}`) },
                        { onSuccess: () => setSentToChecklist((prev) => new Set(prev).add(item.id)) }
                      )
                    }
                    title={t("toChecklistHint")}
                    className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase hover:text-foreground disabled:opacity-60"
                  >
                    {sentToChecklist.has(item.id) ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <CircleCheck className="h-3 w-3" aria-hidden="true" />
                    )}
                    {sentToChecklist.has(item.id) ? t("addedToChecklist") : t("toChecklist")}
                  </button>
                  <button
                    type="button"
                    disabled={flagged.has(item.id) || flagRisk.isPending}
                    onClick={() =>
                      flagRisk.mutate(
                        { title: item.label, severity: "UNVERIFIED" },
                        { onSuccess: () => setFlagged((prev) => new Set(prev).add(item.id)) }
                      )
                    }
                    title={t("flagRiskHint")}
                    className="flex items-center gap-1 text-[10px] font-semibold tracking-[1px] text-muted-foreground uppercase hover:text-riskmed disabled:opacity-60"
                  >
                    {flagged.has(item.id) ? (
                      <Check className="h-3 w-3" aria-hidden="true" />
                    ) : (
                      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    )}
                    {flagged.has(item.id) ? t("riskFlagged") : t("flagRisk")}
                  </button>
                </div>
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
      </div>
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
      <MutationError show={create.isError || del.isError} />
    </PanelBody>
  )
}
