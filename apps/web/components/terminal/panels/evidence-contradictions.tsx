import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { DocumentLink } from "@/components/shared/document-viewer"
import {
  useAiJobStatus,
  useUpdateContradictionMutation,
  type ContradictionStatus,
  usePaneRegenerate,
} from "@/lib/terminal/mutations"
import { graphViewKeys, useGraphViewQuery } from "@/lib/graph-view/mutations"
import {
  EmptyNote,
  MutationError,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TonePill,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  type Tone,
  RegenerateButton,
  PaneRegenerateNote,
} from "@/components/terminal/panel-kit"
import { dateLocale } from "@/lib/i18n/date-locale"
import { formatMoney } from "@/lib/terminal/damages-format"
import { useAuthStore } from "@/lib/store/auth.store"

type ContradictionMetadata = {
  kind: string
  factKey: string
  leftValue: string
  rightValue: string
  leftExcerpt: string
  rightExcerpt: string
  confidence?: number
  status?: ContradictionStatus
  resolutionNote?: string | null
  /** Jev's classification (USE_JEV_CONTRADICTIONS); null/absent when it wasn't run. */
  nature?: "DIRECT" | "INFERENTIAL" | "NOT_A_CONFLICT" | null
  natureConfidence?: number | null
  /** Where in the document each side sits, e.g. "D13 p.2" — set by the full-bundle scan. */
  leftLocator?: string | null
  rightLocator?: string | null
}

// The severity tag is Jev's DIRECT/INFERENTIAL/NOT_A_CONFLICT read when the scan had it, else the
// scan's own confidence banded HIGH/MEDIUM/LOW — never a label nothing measured.
type Severity = "DIRECT" | "INFERENTIAL" | "NOT_A_CONFLICT" | "HIGH" | "MEDIUM" | "LOW"
const SEVERITY_ORDER: Severity[] = ["DIRECT", "HIGH", "INFERENTIAL", "MEDIUM", "LOW", "NOT_A_CONFLICT"]
const SEVERITY_STYLE: Record<Severity, { tone: Tone; label: string }> = {
  DIRECT: { tone: "danger", label: "contradictionDirect" },
  HIGH: { tone: "danger", label: "contradictionHigh" },
  INFERENTIAL: { tone: "riskmed", label: "contradictionInferential" },
  MEDIUM: { tone: "riskmed", label: "contradictionMedium" },
  LOW: { tone: "warn", label: "contradictionLow" },
  NOT_A_CONFLICT: { tone: "neutral", label: "contradictionNotAConflict" },
}

function severityOf(m: ContradictionMetadata): Severity {
  if (m.nature) return m.nature
  const c = m.confidence ?? 0.5
  if (c >= 0.75) return "HIGH"
  if (c >= 0.5) return "MEDIUM"
  return "LOW"
}

function formatContradictionValue(kind: string, value: string) {
  if (kind === "amount_mismatch" && /^\d+(\.\d+)?$/.test(value)) {
    // A bare amount carries no currency — it is the tenant's (₱ on the PH site, £ on the UK site).
    return formatMoney(Number(value), useAuthStore.getState().organization?.tenantCode === "UK" ? "GBP" : "PHP")
  }
  // Full-bundle scan values: "GBP4500.00", "2023-11-14", "11d".
  const money = value.match(/^([A-Z]{3})(\d+(?:\.\d+)?)$/)
  if (money) {
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: money[1] }).format(Number(money[2]))
    } catch {
      return value
    }
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00Z`)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  }
  const days = value.match(/^(\d+)d$/)
  if (days) return `${days[1]} days`
  return value
}

function contradictionHeadline(item: ContradictionMetadata) {
  const left = formatContradictionValue(item.kind, item.leftValue)
  const right = formatContradictionValue(item.kind, item.rightValue)
  // The full scan's fact keys are just the value kind ("date") — the values already say that.
  const label =
    item.factKey && !["other", "date", "amount", "duration"].includes(item.factKey)
      ? item.factKey.replace(/_/g, " ")
      : null
  return label ? `${label}: ${left} vs ${right}` : `${left} vs ${right}`
}

// The Contradictions section of Evidence & Timeline. It used to be its own pane; that pane was
// retired, and only the part a lawyer acts on came here: reading each conflict, and resolving or
// dismissing it (a dismissed one is a false positive). The scan itself runs in every analysis
// refresh, so there is no Scan button. Reads the graph-view projection (view_type=contradictions)
// instead of slicing CaseSnapshot, which carries no status for these rows.
export function EvidenceContradictions({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const update = useUpdateContradictionMutation(caseId)
  const job = useAiJobStatus(caseId, "contradictions")
  // This section's own Rescan; the case analysis rescans too, in its first wave.
  const regen = usePaneRegenerate(caseId, "contradictions")
  const graphView = useGraphViewQuery(caseId, "contradictions")
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)

  // The scan is queued; useAiJobStatus only refreshes the snapshot when it finishes, and this
  // panel reads the graph view — refresh that too on the IN_PROGRESS -> DONE transition.
  const prevJobStatus = useRef(job.data?.status)
  useEffect(() => {
    if (prevJobStatus.current === "IN_PROGRESS" && job.data?.status === "DONE") {
      queryClient.invalidateQueries({ queryKey: graphViewKeys.all(caseId) })
    }
    prevJobStatus.current = job.data?.status
  }, [job.data?.status, caseId, queryClient])
  const [note, setNote] = useState("")

  const docName = new Map((graphView.data?.nodes ?? []).map((n) => [n.id, n.label]))
  const rows = (graphView.data?.edges ?? [])
    .map((edge) => {
      const m = edge.metadata as ContradictionMetadata
      return { edge, m, severity: severityOf(m), handled: (m.status ?? "OPEN") !== "OPEN" }
    })
    // Open ones first, most severe first; resolved/dismissed sink to the bottom.
    .sort(
      (a, b) =>
        Number(a.handled) - Number(b.handled) ||
        SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
    )
  const handledCount = rows.filter((r) => r.handled).length

  const toggle = (id: string) => {
    setOpen(open === id ? null : id)
    setNote("")
  }
  const setStatus = (id: string, status: ContradictionStatus) => {
    update.mutate({ id, status, resolutionNote: status === "OPEN" ? null : note.trim() || null })
    setNote("")
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={labelTextClass}>{t("contradictionsTitle")}</p>
        <div className="flex items-baseline gap-3">
          {rows.length > 0 ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {t("contradictionHandled", { done: handledCount, total: rows.length })}
            </span>
          ) : null}
          <RegenerateButton regen={regen} label={t("regenerateContradictions")} hint={t("regenerateContradictionsHint")} />
        </div>
      </div>
      <PaneRegenerateNote regen={regen} />
      <p className="text-[13px] text-muted-foreground">{t("contradictionsIntro")}</p>
      <MutationError show={update.isError} />

      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("noContradictions")}</EmptyNote>}>
          {rows.map(({ edge, m, severity, handled }) => {
            const style = SEVERITY_STYLE[severity]
            const tone = TONE_STYLE[style.tone]
            const status = m.status ?? "OPEN"
            const leftDoc = docName.get(edge.source) ?? t("unknownDocument")
            const rightDoc = docName.get(edge.target) ?? t("unknownDocument")
            // Inside one merged bundle the locators ("D13 p.2") are what tell the two sides apart.
            const left = m.leftLocator ?? leftDoc
            const right = m.rightLocator ?? rightDoc
            const sources =
              m.leftLocator || m.rightLocator
                ? `${left} vs. ${right}`
                : edge.source === edge.target
                  ? t("contradictionSameDocument", { doc: leftDoc })
                  : `${leftDoc} vs. ${rightDoc}`
            const isOpen = open === edge.id
            return (
              <PanelRow
                key={edge.id}
                className={`flex-col items-stretch gap-2 border-l-[3px] ${handled ? "border-l-border" : `${tone.edge} ${tone.tint}`}`}
              >
                <button
                  type="button"
                  onClick={() => toggle(edge.id)}
                  aria-expanded={isOpen}
                  className={`flex w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 text-left ${handled ? "opacity-60" : ""}`}
                >
                  {/* 8rem floor: in a narrow pane the status and pill drop under the headline instead of squeezing it. */}
                  <span className="min-w-0 flex-[1_1_8rem]">
                    <span className="block text-[13px] font-medium text-foreground first-letter:uppercase">
                      {contradictionHeadline(m)}
                    </span>
                    <span className={`mt-0.5 block truncate ${labelTextClass}`}>{sources}</span>
                  </span>
                  {handled ? (
                    <span className={`shrink-0 ${labelTextClass}`}>
                      {t(status === "RESOLVED" ? "contradictionResolved" : "contradictionDismissed")}
                    </span>
                  ) : null}
                  <TonePill
                    tone={style.tone}
                    title={
                      m.nature
                        ? t("contradictionJevConfidence", { pct: Math.round((m.natureConfidence ?? 0) * 100) })
                        : t("contradictionConfidence", { pct: Math.round((m.confidence ?? 0.5) * 100) })
                    }
                  >
                    {t(style.label)}
                  </TonePill>
                </button>
                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px]">
                    {[
                      { doc: left, docId: edge.source, excerpt: m.leftExcerpt, value: m.leftValue },
                      { doc: right, docId: edge.target, excerpt: m.rightExcerpt, value: m.rightValue },
                    ].map((side, i) => (
                      <div key={i}>
                        <p className={labelTextClass}>
                          <DocumentLink docId={side.docId}>{side.doc}</DocumentLink> · <span className={tone.text}>{formatContradictionValue(m.kind, side.value)}</span>
                        </p>
                        <p className="mt-0.5 leading-5 text-foreground">
                          {side.excerpt ? `“${side.excerpt}”` : t("contradictionNoExcerpt")}
                        </p>
                      </div>
                    ))}
                    <p className="text-muted-foreground">
                      {m.nature
                        ? t("contradictionJevSays", {
                            nature: t(style.label),
                            pct: Math.round((m.natureConfidence ?? 0) * 100),
                          })
                        : t("contradictionConfidence", { pct: Math.round((m.confidence ?? 0.5) * 100) })}
                    </p>
                    <div className="flex flex-col gap-1.5 border-t border-border pt-2">
                      {handled ? (
                        <>
                          {m.resolutionNote ? <p className="text-foreground">“{m.resolutionNote}”</p> : null}
                          <button
                            type="button"
                            onClick={() => setStatus(edge.id, "OPEN")}
                            disabled={update.isPending}
                            className={`self-start ${ghostBtnClass}`}
                          >
                            {t("contradictionReopen")}
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder={t("contradictionNotePlaceholder")}
                            aria-label={t("contradictionNotePlaceholder")}
                            className={fieldClass}
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setStatus(edge.id, "RESOLVED")}
                              disabled={update.isPending}
                              className={ghostBtnClass}
                              title={t("contradictionResolveHint")}
                            >
                              {t("contradictionResolve")}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStatus(edge.id, "DISMISSED")}
                              disabled={update.isPending}
                              className={ghostBtnClass}
                              title={t("contradictionDismissHint")}
                            >
                              {t("contradictionDismiss")}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ) : null}
              </PanelRow>
            )
          })}
        </PanelRowList>
      </div>
    </div>
  )
}
