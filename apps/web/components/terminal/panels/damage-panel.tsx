import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronRight, FileText, Pencil, Scale, Trash2 } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  useAiJobStatus,
  useApplyDamageProposalMutation,
  useCreateDamageMutation,
  useDismissDamageProposalMutation,
  useDeleteDamageMutation,
  useProposeDamagesMutation,
  useUpdateDamageMutation,
} from "@/lib/terminal/mutations"
import {
  DAMAGE_AS_OF,
  type CaseSnapshot,
  type DamageBasis,
  type DamageClaim,
  type DamageHeadSummary,
  type DamageStatus,
  type PanelId,
} from "@/lib/terminal/types"
import { basisMonths, formatMoney, formatMoneyCompact, formatShare, sameFigures, sortDamageHeads } from "@/lib/terminal/damages-format"
import {
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  dangerIconBtnClass,
  ghostBtnClass,
  labelTextClass,
  primaryBtnClass,
  secondaryTextClass,
} from "@/components/terminal/panel-kit"
import { DAMAGE_TONE, DamagesRing, ExposureRange } from "@/components/terminal/panels/summary-visuals"
import { DAMAGE_CATEGORY_KEYS, DAMAGE_STATUS_KEYS, DamageHeadEditor } from "@/components/terminal/panels/damage-head-editor"
import { usePrefersReducedMotion } from "@/lib/use-reduced-motion"

const STATUS_TONE: Record<DamageStatus, "caution" | "neutral" | "success"> = {
  PROVISIONAL: "caution",
  SUPPORTED: "neutral",
  CERTIFIED: "success",
}

// Editor target: a head's id, "new" for the add form, or null when closed.
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
  const propose = useProposeDamagesMutation(caseId)
  const applyProposal = useApplyDamageProposalMutation(caseId)
  const dismissProposal = useDismissDamageProposalMutation(caseId)
  // Runs on its own after documents finish extracting, or from "Propose from documents" — see
  // DamagesExtractSvc. useAiJobStatus refreshes the snapshot when it finishes. While it runs, the
  // pane header shows a spinner (PaneActivityMark); here it only disables Propose and dims the total.
  const extractJob = useAiJobStatus(caseId, "damagesExtract")
  const updating = propose.isPending || extractJob.data?.status === "IN_PROGRESS"
  const [openId, setOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditorTarget>(null)
  // Set when the editor was opened from "Set period & accept", so saving also accepts the head.
  const [acceptOnSave, setAcceptOnSave] = useState(false)
  const openEditor = (target: EditorTarget, accept = false) => {
    setAcceptOnSave(accept)
    setEditing(target)
  }

  const summary = snapshot.damagesSummary
  const money = (value: number) => formatMoney(value, summary.currency)
  const compact = (value: number) => formatMoneyCompact(value, summary.currency)
  const heads = sortDamageHeads(snapshot.damages)
  const computedById = new Map(summary.heads.map((h) => [h.id, h]))
  const nameOf = (d: Pick<DamageClaim, "label" | "category">) => d.label || t(DAMAGE_CATEGORY_KEYS[d.category])
  const documentName = new Map(snapshot.documents.map((doc) => [doc.id, doc.name]))

  // The ring's centre total counts up to a new value instead of snapping — skipped on first mount
  // (nothing to count up from) and under reduced motion.
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

  const orderedComputed = heads
    .map((d) => computedById.get(d.id))
    .filter((h): h is DamageHeadSummary => !!h)
  const allCertified = orderedComputed.length > 0 && orderedComputed.every((h) => h.effectiveStatus === "CERTIFIED")
  const caption = t(
    summary.provisional ? "damagesCaptionProvisional" : allCertified ? "damagesCaptionCertified" : "damagesCaptionSupported",
    { count: summary.headCount },
  )
  const ringLabel = t("damagesRingLabel", {
    total: money(summary.total),
    parts: orderedComputed
      .map((h) => `${nameOf(heads.find((d) => d.id === h.id)!)} ${formatShare(h.share)}`)
      .join(", "),
  })
  const evidenceList = new Intl.ListFormat(undefined, { type: "conjunction" }).format(summary.pendingEvidence)

  const basisText = (d: DamageClaim) => {
    const basis = d.basis
    if (!basis || basis.kind === "FIXED") return null
    if (basis.kind === "PERCENT_OF") {
      return t("damageDerivedFrom", {
        percent: basis.percent,
        heads: new Intl.ListFormat(undefined, { type: "conjunction" }).format(
          basis.categories.map((c) => t(DAMAGE_CATEGORY_KEYS[c])),
        ),
      })
    }
    const months = basis.months
    if (months == null && !(basis.fromDate && basis.untilDate)) {
      return t("damageBasisRatePending", { rate: money(basis.monthlyRate) })
    }
    if (months != null) return t("damageBasisRateText", { rate: money(basis.monthlyRate), months })
    const from = new Date(basis.fromDate!).toLocaleDateString()
    if (basis.untilDate === DAMAGE_AS_OF) {
      return t("damageBasisRateAccruing", { rate: money(basis.monthlyRate), from, months: basisMonths(basis) ?? 0 })
    }
    return t("damageBasisRateDates", { rate: money(basis.monthlyRate), from, until: new Date(basis.untilDate!).toLocaleDateString() })
  }

  // Just the figures a document can state — what a suggested update is compared and described by.
  const figuresText = (basis: DamageBasis | null, amount: number | null) => {
    if (!basis || basis.kind === "FIXED") return amount != null ? money(amount) : "—"
    if (basis.kind === "RATE_X_PERIOD") return t("damageFiguresRate", { rate: money(basis.monthlyRate) })
    return t("damageFiguresPercent", {
      percent: basis.percent,
      heads: new Intl.ListFormat(undefined, { type: "conjunction" }).format(basis.categories.map((c) => t(DAMAGE_CATEGORY_KEYS[c]))),
    })
  }

  const editorHead = editing && editing !== "new" ? (snapshot.damages.find((d) => d.id === editing) ?? null) : null
  const saving = create.isPending || update.isPending

  return (
    <PanelBody gap="4">
      {summary.provisional ? (
        <p className={secondaryTextClass}>
          {summary.pendingEvidence.length > 0
            ? t("damagesNoteProvisional", { evidence: evidenceList })
            : t("damagesNoteProvisionalGeneric")}
        </p>
      ) : null}

      {heads.length === 0 && editing === null ? (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-muted/60 px-4 py-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card text-muted-foreground">
            <Scale className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <p className="font-['Libre_Caslon_Text'] text-lg font-normal tracking-[-0.02em] text-foreground">
            {t("damagesEmptyTitle")}
          </p>
          <p className={cn(secondaryTextClass, "max-w-[42ch]")}>{t("damagesEmptyBody")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => openEditor("new")} className={primaryBtnClass}>
              {t("damageEditorAdd")}
            </button>
            <button
              type="button"
              onClick={() => propose.mutate()}
              disabled={updating}
              title={t("damagesProposeHint")}
              className={ghostBtnClass}
            >
              {t("damagesPropose")}
            </button>
          </div>
        </div>
      ) : null}

      {/* Ring and heads as one block that never shrinks: PanelBody is a scrolling flex column, and
          PanelRowList's overflow-hidden would otherwise let it collapse to a hairline in a short
          pane. When the pane is wide enough, the ring sits beside the heads so both are in view
          without scrolling. */}
      <div className="@container shrink-0">
        <div className="grid gap-4 @[34rem]:grid-cols-[11rem_minmax(0,1fr)] @[34rem]:items-start">
          {heads.length > 0 ? (
            <DamagesRing
              heads={orderedComputed.map((h) => ({ id: h.id, category: h.category, share: h.share }))}
              label={ringLabel}
              eyebrow={t("damagesTotalClaim")}
              total={compact(displayTotal)}
              caption={caption}
              dimmed={updating}
            />
          ) : null}

          <PanelRowList>
            {heads.map((d) => {
              const computed = computedById.get(d.id)
              const amount = computed?.amount ?? d.amount
              const status = computed?.effectiveStatus ?? d.status
              const open = openId === d.id
              const low = computed?.low ?? null
              const high = computed?.high ?? null
              const hasRange = low != null && high != null && (low !== amount || high !== amount)
              const basis = basisText(d)
              const sourceDoc = d.sourceDocumentId ? documentName.get(d.sourceDocumentId) : undefined
              const aiPending = d.source === "AI" && d.status === "PROVISIONAL"
              // A monthly rate with no period can't be turned into a figure, so it adds nothing to the
              // total — say so rather than showing a silent "—".
              const needsPeriod = d.basis?.kind === "RATE_X_PERIOD" && amount == null
              const proposal = d.aiProposedBasis
              const proposedFigures = proposal ? figuresText(proposal.basis, proposal.amount) : null
              const currentFigures = figuresText(d.basis, d.amount)
              const unchanged = proposal ? sameFigures(d, proposal) : false
              const certifies = proposal?.satisfiesPending === true && d.status !== "CERTIFIED"
              const proposalBusy = applyProposal.isPending || dismissProposal.isPending
              return (
                <PanelRow key={d.id} className="flex-col items-stretch gap-0 p-0">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : d.id)}
                    aria-expanded={open}
                    aria-controls={`damage-detail-${d.id}`}
                    className="grid w-full grid-cols-[10px_minmax(0,1fr)_auto_2.75rem] items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted/60"
                  >
                    <span className={cn("h-2 w-2 rounded-full", DAMAGE_TONE[d.category].bg)} aria-hidden="true" />
                    <span className="flex min-w-0 items-center gap-1.5 text-[13px] text-foreground">
                      <ChevronRight
                        className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                        aria-hidden="true"
                      />
                      <span className="truncate">{nameOf(d)}</span>
                      {d.source === "AI" ? <Badge className="shrink-0">{t("damageAiChip")}</Badge> : null}
                      {proposal ? (
                        <Badge tone="success" className="shrink-0">
                          {t("damageProposalChip")}
                        </Badge>
                      ) : null}
                    </span>
                    <span className="font-mono text-[12px] text-foreground tabular-nums">
                      {amount != null ? (
                        money(amount)
                      ) : needsPeriod ? (
                        <span className="font-sans text-[11px] text-warn">{t("damageNoPeriodShort")}</span>
                      ) : (
                        "—"
                      )}
                    </span>
                    <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                      {formatShare(computed?.share ?? 0)}
                    </span>
                  </button>

                  {proposal ? (
                    <div className="mx-3 mb-2.5 flex flex-col gap-1.5 rounded-md border border-border bg-muted px-2.5 py-2 text-[12px]" role="group" aria-label={t("damageProposalTitle")}>
                      <p className="text-foreground">
                        {unchanged
                          ? t("damageProposalConfirms", { doc: proposal.documentName || t("damageProposalADocument"), evidence: d.pendingEvidence ?? "" })
                          : t("damageProposalFigures", {
                              doc: proposal.documentName || t("damageProposalADocument"),
                              to: proposedFigures,
                              from: currentFigures,
                            })}
                        {!unchanged && certifies && d.pendingEvidence
                          ? ` ${t("damageProposalIsEvidence", { evidence: d.pendingEvidence })}`
                          : ""}
                      </p>
                      <blockquote className="border-l-2 border-border pl-2 text-muted-foreground italic">{proposal.sourceQuote}</blockquote>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyProposal.mutate(d.id)}
                          disabled={proposalBusy}
                          className={primaryBtnClass}
                        >
                          {certifies ? t("damageProposalApplyCertify") : t("damageProposalApply")}
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissProposal.mutate(d.id)}
                          disabled={proposalBusy}
                          className={ghostBtnClass}
                        >
                          {t("damageProposalDismiss")}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {open ? (
                    <div id={`damage-detail-${d.id}`} className="flex flex-col gap-2 border-t border-border px-3 py-2.5 pl-8">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={STATUS_TONE[status]}>{t(DAMAGE_STATUS_KEYS[status])}</Badge>
                        {basis ? <span className="font-mono text-[12px] text-foreground">{basis}</span> : null}
                      </div>
                      {needsPeriod ? (
                        // The fix is the row's own "Set period & accept" (or Edit, once accepted) below.
                        <p className="rounded-md bg-muted px-2.5 py-2 text-[12px] text-foreground">{t("damageNoPeriod")}</p>
                      ) : null}
                      {hasRange ? (
                        <p className="font-mono text-[12px] text-muted-foreground">
                          {t("damageRange", { low: money(low!), high: money(high!) })}
                        </p>
                      ) : null}
                      {status === "PROVISIONAL" && d.pendingEvidence ? (
                        <p className={secondaryTextClass}>{t("damageWaitingOn", { evidence: d.pendingEvidence })}</p>
                      ) : null}
                      {d.legalBasis ? (
                        <p className={secondaryTextClass}>{t("damageLegalBasisUnverified", { basis: d.legalBasis })}</p>
                      ) : null}
                      {d.description ? <p className="text-[13px] text-foreground">{d.description}</p> : null}
                      {d.source === "AI" ? (
                        // Where an AI head came from: the document as its own file chip (its real name,
                        // not a label-cased caption) and the verbatim line always shown — it is the
                        // evidence for the figure, so the lawyer shouldn't have to ask for it.
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
                        {aiPending ? (
                          <button
                            type="button"
                            onClick={() => (needsPeriod ? openEditor(d.id, true) : update.mutate({ id: d.id, status: "SUPPORTED" }))}
                            disabled={update.isPending}
                            title={t(needsPeriod ? "damageSetPeriodAcceptHint" : "damageAcceptHint")}
                            className={cn(primaryBtnClass, "inline-flex items-center gap-1.5")}
                          >
                            <Check className="h-3 w-3" aria-hidden="true" />
                            {t(needsPeriod ? "damageSetPeriodAccept" : "damageAccept")}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => openEditor(d.id)} className={cn(ghostBtnClass, "inline-flex items-center gap-1.5")}>
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
        </div>
      </div>

      {heads.length > 0 ? (
        <ExposureRange
          low={summary.low}
          modeled={summary.total}
          high={summary.high}
          scaleMax={summary.scaleMax}
          format={compact}
          labels={{
            title: t("damagesExposure"),
            low: t("damagesLow"),
            modeled: t("damagesModeled"),
            high: t("damagesHigh"),
            unset: t("damagesRangeUnset"),
          }}
        />
      ) : null}

      {editing !== null ? (
        <DamageHeadEditor
          key={`${editing}:${acceptOnSave}`}
          head={editorHead}
          summary={summary}
          pending={saving}
          accept={acceptOnSave}
          onCancel={() => setEditing(null)}
          onSave={(body) => {
            const done = { onSuccess: () => setEditing(null) }
            if (editorHead) update.mutate({ id: editorHead.id, ...body }, done)
            else create.mutate(body, done)
          }}
        />
      ) : heads.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => openEditor("new")} className={ghostBtnClass}>
            {t("damageEditorAdd")}
          </button>
          <button
            type="button"
            onClick={() => propose.mutate()}
            disabled={updating}
            title={t("damagesProposeHint")}
            className={ghostBtnClass}
          >
            {t("damagesPropose")}
          </button>
        </div>
      ) : null}

      <MutationError
        show={create.isError || update.isError || del.isError || propose.isError || applyProposal.isError || dismissProposal.isError}
      />
    </PanelBody>
  )
}
