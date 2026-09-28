import { useEffect, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { Loader2, Search } from "lucide-react"
import {
  useAiJobStatus,
  useScanContradictionsMutation,
  useUpdateContradictionMutation,
  type ContradictionStatus,
} from "@/lib/terminal/mutations"
import { graphViewKeys, useGraphViewQuery } from "@/lib/graph-view/mutations"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  TONE_STYLE,
  TagMixSummary,
  TonePill,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
  type Tone,
} from "@/components/terminal/panel-kit"

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
    return `₱${Number(value).toLocaleString()}`
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
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
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

// Split out of EvidencePanel into its own pane — the underlying data (EvidenceContradiction
// rows, scanned via regex + an LLM pass through chat-wonder-v2-api) already existed; this is
// purely giving it dedicated screen space instead of competing with Documents/Timeline for it.
// Reads the graph-view projection (view_type=contradictions) instead of slicing CaseSnapshot,
// so a scan triggered from any mounted panel refreshes this one via the shared query cache.
export function ContradictionsPanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation("terminal")
  const scan = useScanContradictionsMutation(caseId)
  const update = useUpdateContradictionMutation(caseId)
  const job = useAiJobStatus(caseId, "contradictions")
  const graphView = useGraphViewQuery(caseId, "contradictions")
  const queryClient = useQueryClient()
  const isScanning = scan.isPending || job.data?.status === "IN_PROGRESS"
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
  const counts = new Map<Severity, number>()
  rows.forEach((r) => counts.set(r.severity, (counts.get(r.severity) ?? 0) + 1))
  const handledCount = rows.filter((r) => r.handled).length
  const handledPct = rows.length ? Math.round((handledCount / rows.length) * 100) : 0

  const toggle = (id: string) => {
    setOpen(open === id ? null : id)
    setNote("")
  }
  const setStatus = (id: string, status: ContradictionStatus) => {
    update.mutate({ id, status, resolutionNote: status === "OPEN" ? null : note.trim() || null })
    setNote("")
  }

  return (
    <PanelBody gap="4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] text-muted-foreground">{t("contradictionsIntro")}</p>
        <button
          type="button"
          onClick={() => scan.mutate()}
          disabled={isScanning}
          className={`inline-flex shrink-0 items-center gap-1.5 ${ghostBtnClass}`}
        >
          {isScanning ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Search className="h-3 w-3" aria-hidden="true" />
          )}
          {isScanning ? t("scanning") : t("scan")}
        </button>
      </div>
      <MutationError show={scan.isError || update.isError || job.data?.status === "FAILED"}>
        {job.data?.status === "FAILED" && !scan.isError ? t("contradictionScanFailed") : undefined}
      </MutationError>

      {rows.length > 0 ? (
        <TagMixSummary
          ring={{ pct: handledPct, tone: "ok", title: t("contradictionHandled", { done: handledCount, total: rows.length }) }}
          segments={SEVERITY_ORDER.map((s) => ({
            key: s,
            label: t(SEVERITY_STYLE[s].label),
            count: counts.get(s) ?? 0,
            tone: SEVERITY_STYLE[s].tone,
          }))}
        />
      ) : null}

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
                  className={`flex w-full items-center justify-between gap-3 text-left ${handled ? "opacity-60" : ""}`}
                >
                  <span className="min-w-0 flex-1">
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
                      { doc: left, excerpt: m.leftExcerpt, value: m.leftValue },
                      { doc: right, excerpt: m.rightExcerpt, value: m.rightValue },
                    ].map((side, i) => (
                      <div key={i}>
                        <p className={labelTextClass}>
                          {side.doc} · <span className={tone.text}>{formatContradictionValue(m.kind, side.value)}</span>
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
                          <div className="flex gap-2">
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
    </PanelBody>
  )
}
