import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronRight, FileText, Pencil, Trash2 } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  useAcceptDamageMutation,
  useAiJobStatus,
  useCreateDamageMutation,
  useDeleteDamageMutation,
  useProposeDamagesMutation,
  useUpdateDamageMutation,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot, PanelId } from "@/lib/terminal/types"
import { daysUntil, formatMoney, sortDamageHeads } from "@/lib/terminal/damages-format"
import {
  CatalogPill,
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  dangerIconBtnClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  TONE_STYLE,
  type Tone,
} from "@/components/terminal/panel-kit"
import { DAMAGE_KIND_KEYS, DamageHeadEditorDialog } from "@/components/terminal/panels/damage-head-editor"
import { DamagesOverview } from "@/components/terminal/panels/damages-overview"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"
import { useLinkedTodos } from "@/lib/terminal/linked-todos"
import { ToChecklistButton } from "@/components/terminal/to-checklist-button"
import { dateLocale } from "@/lib/i18n/date-locale"

// The status pill, same look as the finding panels' (Weaknesses' Open / Material): done means
// awarded or received.
const STATUSES: { done: boolean; tone: Tone; label: string }[] = [
  { done: false, tone: "warn", label: "damagePillOpen" },
  { done: true, tone: "ok", label: "damagePillDone" },
]

// Editor target: an entry's id, "new" for the add form, or null when closed.
type EditorTarget = string | "new" | null

export function DamagePanel({
  snapshot,
  caseId,
  onJumpToPanel,
}: {
  snapshot: CaseSnapshot
  caseId: string
  onJumpToPanel?: (id: PanelId) => void
}) {
  const { t } = useTranslation("terminal")
  const create = useCreateDamageMutation(caseId)
  const update = useUpdateDamageMutation(caseId)
  const del = useDeleteDamageMutation(caseId)
  const accept = useAcceptDamageMutation(caseId)
  const propose = useProposeDamagesMutation(caseId)
  const todos = useLinkedTodos(caseId)
  // Runs on its own after documents finish extracting, or from "Propose from documents" — see
  // DamagesExtractSvc. useAiJobStatus refreshes the snapshot when it finishes. While it runs, the
  // pane header shows a spinner (PaneActivityMark); here it only disables Propose and dims the total.
  const extractJob = useAiJobStatus(caseId, "damagesExtract")
  const updating = propose.isPending || extractJob.data?.status === "IN_PROGRESS"
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditorTarget>(null)

  const summary = snapshot.damagesSummary
  const money = (value: number) => formatMoney(value, summary.currency)
  const heads = sortDamageHeads(snapshot.damages)
  const documentName = new Map(snapshot.documents.map((doc) => [doc.id, doc.name]))
  const dateText = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { timeZone: "UTC" })

  // The total counts up to a new value instead of snapping — skipped on first mount (nothing to
  // count up from) and under reduced motion.
  const total = summary.total
  const reducedMotion = usePrefersReducedMotion()
  const [displayTotal, setDisplayTotal] = useState(total)
  const totalProxyRef = useRef({ value: total })
  const mountedRef = useRef(false)
  useGSAP(
    () => {
      if (!mountedRef.current || reducedMotion) {
        mountedRef.current = true
        totalProxyRef.current.value = total
        setDisplayTotal(total)
        return
      }
      gsap.to(totalProxyRef.current, {
        value: total,
        duration: 0.4,
        ease: "power2.out",
        onUpdate: () => setDisplayTotal(Math.round(totalProxyRef.current.value)),
      })
    },
    { dependencies: [total, reducedMotion] },
  )

  const editorHead = editing && editing !== "new" ? (snapshot.damages.find((d) => d.id === editing) ?? null) : null
  const saving = create.isPending || update.isPending

  return (
    <PanelBody gap="4">
      <DamagesOverview summary={summary} heads={snapshot.damages} displayTotal={displayTotal} dimmed={updating} />

      {heads.length === 0 ? (
        <EmptyNote>{t("damagesEmpty")}</EmptyNote>
      ) : (
        <PanelRowList>
          {heads.map((d) => {
            const open = openId === d.id
            const sourceDoc = d.sourceDocumentId ? documentName.get(d.sourceDocumentId) : undefined
            const days = d.dueDate ? daysUntil(d.dueDate) : null
            const overdue = days !== null && days < 0 && !d.done
            const status = STATUSES.find((s) => s.done === d.done)!
            return (
              <PanelRow key={d.id} className="flex-col items-stretch gap-0 p-0">
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2.5 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.id)}
                    aria-expanded={open}
                    aria-controls={`damage-detail-${d.id}`}
                    className="flex min-w-0 items-center gap-1.5 text-left"
                  >
                    <ChevronRight
                      className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                      aria-hidden="true"
                    />
                    <Badge
                      className={cn(
                        "shrink-0",
                        d.kind === "REMEDY" ? "bg-kind-remedy/15 text-kind-remedy" : "bg-kind-damage/15 text-kind-damage",
                      )}
                    >
                      {t(DAMAGE_KIND_KEYS[d.kind])}
                    </Badge>
                    <span className={cn("truncate text-[13px]", d.done ? "text-muted-foreground line-through" : "text-foreground")}>
                      {d.title}
                    </span>
                    {!d.accepted ? (
                      <Badge tone="caution" className="shrink-0">
                        {t("damageAiSuggestion")}
                      </Badge>
                    ) : null}
                  </button>
                  <span className="flex flex-col items-end gap-0.5 text-right">
                    <span className="font-mono text-[12px] text-foreground tabular-nums">{d.amount != null ? money(d.amount) : d.kind === "REMEDY" ? (
                        <span className="font-sans text-[11px] text-muted-foreground">{t("damageNonMonetary")}</span>
                      ) : (
                        "—"
                      )}</span>
                    {/* An estimate is the AI's own figure, not one from the documents — always said so. */}
                    {d.amountBasis === "ESTIMATE" && d.amount != null ? (
                      <span className="text-[11px] text-warn" title={d.amountNote ?? undefined}>
                        {t("damageEstimateTag")}
                      </span>
                    ) : null}
                    {d.dueDate ? (
                      <span className={cn("text-[11px] tabular-nums", overdue ? "text-danger" : "text-muted-foreground")}>
                        {t(overdue ? "damageOverdue" : "damageDue", { date: dateText(d.dueDate) })}
                      </span>
                    ) : null}
                  </span>
                  <CatalogPill tone={status.tone} title={t("damageDoneField")}>
                    {t(status.label)}
                  </CatalogPill>
                </div>

                {open ? (
                  <div id={`damage-detail-${d.id}`} className="flex flex-col gap-2 border-t border-border px-3 py-2.5 pl-9">
                    {/* Set the status here, like a finding's pill. An AI suggestion is accepted first. */}
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("damageDoneField")}>
                      {STATUSES.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => update.mutate({ id: d.id, done: option.done })}
                          disabled={!d.accepted || update.isPending || option.done === d.done}
                          aria-pressed={option.done === d.done}
                          title={!d.accepted ? t("damageAcceptFirst") : undefined}
                          className={cn(
                            "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] transition-colors disabled:cursor-default",
                            option.done !== d.done
                              ? "border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                              : TONE_STYLE[option.tone].badge,
                          )}
                        >
                          {t(option.label)}
                        </button>
                      ))}
                    </div>
                    {d.description ? <p className="text-[13px] text-foreground">{d.description}</p> : null}
                    {d.amountBasis && d.amountNote ? (
                      <p className="text-[12px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {t(d.amountBasis === "ESTIMATE" ? "damageEstimateBasis" : "damageCalculated")}
                        </span>{" "}
                        {d.amountNote}
                      </p>
                    ) : null}
                    {d.source === "AI" ? (
                      // Where an AI entry came from: the document and the verbatim line it relied on.
                      <div className="flex flex-col gap-2 rounded-md border border-border px-2.5 py-2">
                        <p className={labelTextClass}>{t("damageSourceTitle")}</p>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <span className="inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[12px] text-foreground">
                            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <span className="truncate" title={sourceDoc}>
                              {sourceDoc ?? t("damageSourceDocGone")}
                            </span>
                          </span>
                          {onJumpToPanel && d.sourceDocumentId && sourceDoc ? (
                            <button
                              type="button"
                              onClick={() => onJumpToPanel("evidence")}
                              className="text-[12px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                            >
                              {t("damageOpenInEvidence")}
                            </button>
                          ) : null}
                        </div>
                        {d.sourceQuote ? (
                          <blockquote className="border-l-2 border-foreground/25 pl-2.5 text-[12.5px] leading-5 text-foreground">
                            “{d.sourceQuote}”
                          </blockquote>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-end gap-1">
                      {/* The entry's to-do carries its due date and ticks itself once it is awarded. */}
                      {d.accepted && !d.done ? (
                        <span className="mr-auto">
                          <ToChecklistButton
                            todos={todos}
                            source={{ kind: "DAMAGE", id: d.id }}
                            label={t("damageTodo", { title: d.title })}
                            sourceLabel={`${t("todoSource.DAMAGE")}: ${d.title}`.slice(0, 200)}
                          />
                        </span>
                      ) : null}
                      {!d.accepted ? (
                        <button
                          type="button"
                          onClick={() => accept.mutate(d.id)}
                          disabled={accept.isPending}
                          title={t("damageAcceptHint")}
                          className={cn(primaryBtnClass, "inline-flex items-center gap-1.5")}
                        >
                          <Check className="h-3 w-3" aria-hidden="true" />
                          {t("damageAccept")}
                        </button>
                      ) : null}
                      <button type="button" onClick={() => setEditing(d.id)} className={cn(ghostBtnClass, "inline-flex items-center gap-1.5")}>
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        {t("damageEdit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => del.mutate(d.id, { onSuccess: () => setOpenId(null) })}
                        disabled={del.isPending}
                        className={dangerIconBtnClass}
                        aria-label={t("delete")}
                        title={t("delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      )}

      <div className={cn("flex flex-wrap gap-2", heads.length === 0 && "justify-center")}>
        {/* The main action while the list is empty; an ordinary one once it has entries. */}
        <button type="button" onClick={() => setEditing("new")} className={heads.length > 0 ? ghostBtnClass : primaryBtnClass}>
          {t("damageEditorAdd")}
        </button>
        <button type="button" onClick={() => propose.mutate()} disabled={updating} title={t("damagesProposeHint")} className={ghostBtnClass}>
          {t("damagesPropose")}
        </button>
      </div>

      {editing !== null ? (
        <DamageHeadEditorDialog
          key={editing}
          head={editorHead}
          pending={saving}
          onCancel={() => setEditing(null)}
          onSave={(body) => {
            const done = { onSuccess: () => setEditing(null) }
            if (editorHead) update.mutate({ id: editorHead.id, ...body }, done)
            else create.mutate(body, done)
          }}
        />
      ) : null}

      <MutationError show={create.isError || update.isError || del.isError || accept.isError || propose.isError || todos.isError} />
    </PanelBody>
  )
}
