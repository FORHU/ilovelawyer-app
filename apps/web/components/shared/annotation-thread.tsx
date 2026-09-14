"use client"

import { useState } from "react"
import { useTranslation } from "react-i18next"
import { CheckCircle2, RotateCcw } from "lucide-react"
import {
  useAnnotationsQuery,
  useCreateAnnotationMutation,
  useResolveAnnotationMutation,
  useReopenAnnotationMutation,
} from "@/lib/terminal/mutations"
import type { Annotation, AnnotationKind, AnnotationTargetType } from "@/lib/terminal/types"

const KIND_KEYS: Record<AnnotationKind, string> = {
  NOTE: "annotationKindNote",
  DISPUTE: "annotationKindDispute",
  ALTERNATIVE_READING: "annotationKindAlternativeReading",
}

const fieldClass =
  "h-8 min-w-0 flex-1 rounded-md border border-border bg-muted px-2.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-foreground/20 focus:border-brand-gold/60 focus:ring-2 focus:ring-brand-gold/20"
const submitBtnClass =
  "h-8 shrink-0 rounded-md bg-brand-gold px-3 text-[10px] font-semibold uppercase tracking-[1px] text-brand-navy-950 transition-colors hover:bg-brand-gold/85 disabled:opacity-50"

function AnnotationRow({
  annotation,
  onToggleResolved,
}: {
  annotation: Annotation
  onToggleResolved: () => void
}) {
  const { t } = useTranslation("terminal")
  const resolved = !!annotation.resolvedAt
  return (
    <li
      className={`rounded-md border px-2.5 py-2 text-[12px] ${annotation.kind === "DISPUTE" ? "border-orange-500/40 bg-orange-500/5" : "border-border"} ${resolved ? "opacity-60" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="mr-1.5 text-[9px] font-semibold tracking-[1px] text-muted-foreground uppercase">
            {t(KIND_KEYS[annotation.kind])}
          </span>
          <p className="text-foreground">{annotation.body}</p>
        </div>
        <button
          type="button"
          onClick={onToggleResolved}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground"
          aria-label={t(resolved ? "reopen" : "resolveAnnotation")}
        >
          {resolved ? (
            <RotateCcw className="h-3 w-3" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          )}
        </button>
      </div>
    </li>
  )
}

/** Generic comment/dispute/alternative-reading thread attachable to any case element — a
 * decision, a graph node, an edge, a document chunk (differentiation program, Phase 2). Any
 * caller supplies `targetType`/`targetId`; this component owns nothing about what that target
 * means. See docs/plans/differentiation-program.md Workstream B. */
export function AnnotationThread({
  caseId,
  targetType,
  targetId,
}: {
  caseId: string
  targetType: AnnotationTargetType
  targetId: string
}) {
  const { t } = useTranslation("terminal")
  const { data: annotations, isLoading } = useAnnotationsQuery(caseId, targetType, targetId)
  const create = useCreateAnnotationMutation(caseId)
  const resolve = useResolveAnnotationMutation(caseId)
  const reopen = useReopenAnnotationMutation(caseId)
  const [body, setBody] = useState("")

  const items = annotations ?? []

  return (
    <div className="flex flex-col gap-2">
      {isLoading ? null : items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">{t("noAnnotations")}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((a) => (
            <AnnotationRow
              key={a.id}
              annotation={a}
              onToggleResolved={() =>
                (a.resolvedAt ? reopen : resolve).mutate({ id: a.id, targetType, targetId })
              }
            />
          ))}
        </ul>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault()
          const value = body.trim()
          if (!value) return
          create.mutate({ targetType, targetId, kind: "NOTE", body: value })
          setBody("")
        }}
      >
        <input value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("addNote")} className={fieldClass} />
        <button type="submit" disabled={create.isPending} className={submitBtnClass}>
          {t("add")}
        </button>
      </form>
    </div>
  )
}
