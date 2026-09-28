import { useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Check, ChevronRight, Pencil, Scale, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import gsap from "gsap"
import { useGSAP } from "@gsap/react"
import { Badge } from "@workspace/ui/components/badge"
import { cn } from "@workspace/ui/lib/utils"
import {
  useAiJobStatus,
  useCreateDamageMutation,
  useDeleteDamageMutation,
  useProposeDamagesMutation,
  useUpdateDamageMutation,
} from "@/lib/terminal/mutations"
import type { CaseSnapshot, DamageClaim, DamageHeadSummary, DamageStatus, PanelId } from "@/lib/terminal/types"
import { formatMoney, formatMoneyCompact, formatShare, sortDamageHeads } from "@/lib/terminal/damages-format"
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

// Below this Jev's answer is spread across options, so the row says "uncertain" rather than
// presenting the flag as settled. Mirrors UNCERTAIN_SCORE_CONFIDENCE in the API's red-team-jev.ts.
const JEV_UNCERTAIN_CONFIDENCE = 0.5

/** What Jev flags on a head, if anything worth showing: its quote not bearing out the figures,
 * or the head being unlikely to be awarded. Null when Jev hasn't rated it (flag off) or is happy. */
function jevFlags(d: DamageClaim) {
  const support = d.jevSupport === "UNSUPPORTED" || d.jevSupport === "CONTRADICTED" ? d.jevSupport : null
  const unlikely = d.jevAwardability != null && d.jevAwardability <= 1
  if (!support && !unlikely) return null
  return { support, unlikely, uncertain: d.jevConfidence != null && d.jevConfidence < JEV_UNCERTAIN_CONFIDENCE }
}

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
  // Runs on its own after documents finish extracting, or from "Propose from documents" — see
  // DamagesExtractSvc. useAiJobStatus refreshes the snapshot when it finishes.
  const extractJob = useAiJobStatus(caseId, "damagesExtract")
  const updating = propose.isPending || extractJob.data?.status === "IN_PROGRESS"
  const [openId, setOpenId] = useState<string | null>(null)
  const [quoteOpenId, setQuoteOpenId] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditorTarget>(null)

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
    return months != null
      ? t("damageBasisRateText", { rate: money(basis.monthlyRate), months })
      : t("damageBasisRateDates", {
          rate: money(basis.monthlyRate),
          from: new Date(basis.fromDate!).toLocaleDateString(),
          until: new Date(basis.untilDate!).toLocaleDateString(),
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
      {updating ? (
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground" role="status">
          <Sparkles className="h-3.5 w-3.5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          {t("damagesUpdating")}
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
            <button type="button" onClick={() => setEditing("new")} className={primaryBtnClass}>
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
          const quoteOpen = quoteOpenId === d.id
          const flags = jevFlags(d)
          const aiPending = d.source === "AI" && d.status === "PROVISIONAL"
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
                  {status === "PROVISIONAL" ? (
                    <span className="text-warn" title={t("damageStatusProvisional")}>
                      <span aria-hidden="true">*</span>
                      <span className="sr-only">{t("damageStatusProvisional")}</span>
                    </span>
                  ) : null}
                  {d.source === "AI" ? <Badge className="shrink-0">{t("damageAiChip")}</Badge> : null}
                  {flags ? (
                    <span className="shrink-0 text-riskmed" title={t("damageJevFlag")}>
                      <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">{t("damageJevFlag")}</span>
                    </span>
                  ) : null}
                </span>
                <span className="font-mono text-[12px] text-foreground tabular-nums">
                  {amount != null ? money(amount) : "—"}
                </span>
                <span className="text-right font-mono text-[11px] text-muted-foreground tabular-nums">
                  {formatShare(computed?.share ?? 0)}
                </span>
              </button>

              {open ? (
                <div id={`damage-detail-${d.id}`} className="flex flex-col gap-2 border-t border-border px-3 py-2.5 pl-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[status]}>{t(DAMAGE_STATUS_KEYS[status])}</Badge>
                    {basis ? <span className="font-mono text-[12px] text-foreground">{basis}</span> : null}
                  </div>
                  {flags ? (
                    <div className="flex flex-col gap-1.5 rounded-md bg-muted px-2.5 py-2">
                      {flags.support ? (
                        <p className="flex items-start gap-1.5 text-[12px] text-foreground">
                          <Badge tone={flags.support === "CONTRADICTED" ? "danger" : "warning"}>{t("damageJevLabel")}</Badge>
                          <span>
                            {t(flags.support === "CONTRADICTED" ? "damageJevContradicted" : "damageJevUnsupported")}
                            {flags.uncertain ? ` ${t("damageJevUncertain")}` : ""}
                          </span>
                        </p>
                      ) : null}
                      {flags.unlikely ? (
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-foreground">
                          <Badge tone="caution">{t("damageJevLabel")}</Badge>
                          <span>
                            {t("damageJevUnlikely")}
                            {flags.uncertain ? ` ${t("damageJevUncertain")}` : ""}
                          </span>
                          {d.amountLow !== 0 ? (
                            <button
                              type="button"
                              onClick={() => update.mutate({ id: d.id, amountLow: 0 })}
                              disabled={update.isPending}
                              className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                            >
                              {t("damageApplySuggestedLow", { amount: money(0) })}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
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
                    <p className={labelTextClass}>
                      {sourceDoc ? t("damageFoundIn", { doc: sourceDoc }) : t("damageFoundByAi")}
                      {d.sourceQuote ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => setQuoteOpenId(quoteOpen ? null : d.id)}
                            aria-expanded={quoteOpen}
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {t("damageShowQuote")}
                          </button>
                        </>
                      ) : null}
                      {onJumpToPanel && d.sourceDocumentId ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            onClick={() => onJumpToPanel("evidence")}
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {t("damageOpenInEvidence")}
                          </button>
                        </>
                      ) : null}
                    </p>
                  ) : null}
                  {d.source === "AI" && quoteOpen && d.sourceQuote ? (
                    <blockquote className="border-l-2 border-border pl-2 text-[12px] text-foreground italic">
                      {d.sourceQuote}
                    </blockquote>
                  ) : null}
                  <div className="flex items-center justify-end gap-1">
                    {aiPending ? (
                      <button
                        type="button"
                        onClick={() => update.mutate({ id: d.id, status: "SUPPORTED" })}
                        disabled={update.isPending}
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
          key={editing}
          head={editorHead}
          summary={summary}
          pending={saving}
          onCancel={() => setEditing(null)}
          onSave={(body) => {
            const done = { onSuccess: () => setEditing(null) }
            if (editorHead) update.mutate({ id: editorHead.id, ...body }, done)
            else create.mutate(body, done)
          }}
        />
      ) : heads.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditing("new")} className={ghostBtnClass}>
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

      <MutationError show={create.isError || update.isError || del.isError || propose.isError} />
    </PanelBody>
  )
}
