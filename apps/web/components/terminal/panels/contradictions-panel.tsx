import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2, Search } from "lucide-react"
import {
  useAiJobStatus,
  useScanContradictionsMutation,
  useUpdateContradictionMutation,
  type ContradictionStatus,
} from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import {
  EmptyNote,
  MutationError,
  PanelBody,
  PanelRow,
  PanelRowList,
  fieldClass,
  ghostBtnClass,
  labelTextClass,
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
}

// The severity tag is Jev's DIRECT/INFERENTIAL/NOT_A_CONFLICT read when the scan had it, else the
// scan's own confidence banded HIGH/MEDIUM/LOW — never a label nothing measured.
type Severity = "DIRECT" | "INFERENTIAL" | "NOT_A_CONFLICT" | "HIGH" | "MEDIUM" | "LOW"
const SEVERITY_ORDER: Severity[] = ["DIRECT", "HIGH", "INFERENTIAL", "MEDIUM", "LOW", "NOT_A_CONFLICT"]
const RED = { badge: "border-red-400/50 bg-red-400/10 text-red-400", bar: "bg-red-400", edge: "border-l-red-400", row: "bg-red-400/[0.06]", text: "text-red-400" }
const ORANGE = { badge: "border-orange-400/50 bg-orange-400/10 text-orange-400", bar: "bg-orange-400", edge: "border-l-orange-400", row: "bg-orange-400/[0.05]", text: "text-orange-400" }
const AMBER = { badge: "border-amber-500/40 bg-amber-500/5 text-amber-500", bar: "bg-amber-500/70", edge: "border-l-amber-500/70", row: "", text: "text-amber-500" }
const MUTED = { badge: "border-border bg-muted text-muted-foreground", bar: "bg-muted-foreground/40", edge: "border-l-border", row: "", text: "text-muted-foreground" }
const SEVERITY_STYLE: Record<Severity, typeof RED & { label: string }> = {
  DIRECT: { ...RED, label: "contradictionDirect" },
  HIGH: { ...RED, label: "contradictionHigh" },
  INFERENTIAL: { ...ORANGE, label: "contradictionInferential" },
  MEDIUM: { ...ORANGE, label: "contradictionMedium" },
  LOW: { ...AMBER, label: "contradictionLow" },
  NOT_A_CONFLICT: { ...MUTED, label: "contradictionNotAConflict" },
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
  return value
}

function contradictionHeadline(item: ContradictionMetadata) {
  const left = formatContradictionValue(item.kind, item.leftValue)
  const right = formatContradictionValue(item.kind, item.rightValue)
  const label =
    item.factKey && item.factKey !== "other"
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
  const isScanning = scan.isPending || job.data?.status === "IN_PROGRESS"
  const [open, setOpen] = useState<string | null>(null)
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
  const present = SEVERITY_ORDER.filter((s) => counts.get(s))
  const handledCount = rows.filter((r) => r.handled).length
  const handledPct = rows.length ? Math.round((handledCount / rows.length) * 100) : 0
  const ringR = 15
  const ringC = 2 * Math.PI * ringR

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
      <MutationError show={scan.isError || update.isError} />

      {rows.length > 0 ? (
        <div className="flex items-center gap-3">
          <div
            className="relative h-10 w-10 shrink-0"
            title={t("contradictionHandled", { done: handledCount, total: rows.length })}
          >
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
                strokeDasharray={`${(handledPct / 100) * ringC} ${ringC}`}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-foreground">
              {handledPct}%
            </span>
            <span className="sr-only">{t("contradictionHandled", { done: handledCount, total: rows.length })}</span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex h-1.5 gap-px overflow-hidden rounded-full">
              {present.map((s) => (
                <div key={s} className={SEVERITY_STYLE[s].bar} style={{ flexGrow: counts.get(s) }} />
              ))}
            </div>
            <div className={`mt-1.5 flex flex-wrap gap-x-3 ${labelTextClass}`}>
              {present.map((s) => (
                <span key={s} className="inline-flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-sm ${SEVERITY_STYLE[s].bar}`} />
                  {t(SEVERITY_STYLE[s].label)} <span className={SEVERITY_STYLE[s].text}>{counts.get(s)}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Same shrink-0 wrapper as WitnessPanel: PanelRowList's <ul> is overflow-hidden. */}
      <div className="shrink-0">
        <PanelRowList empty={<EmptyNote>{t("noContradictions")}</EmptyNote>}>
          {rows.map(({ edge, m, severity, handled }) => {
            const style = SEVERITY_STYLE[severity]
            const status = m.status ?? "OPEN"
            const left = docName.get(edge.source) ?? t("unknownDocument")
            const right = docName.get(edge.target) ?? t("unknownDocument")
            const sources = edge.source === edge.target ? t("contradictionSameDocument", { doc: left }) : `${left} vs. ${right}`
            const isOpen = open === edge.id
            return (
              <PanelRow
                key={edge.id}
                className={`flex-col items-stretch gap-2 border-l-[3px] ${handled ? "border-l-border" : `${style.edge} ${style.row}`}`}
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
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[1.2px] ${style.badge}`}
                    title={
                      m.nature
                        ? t("contradictionJevConfidence", { pct: Math.round((m.natureConfidence ?? 0) * 100) })
                        : t("contradictionConfidence", { pct: Math.round((m.confidence ?? 0.5) * 100) })
                    }
                  >
                    {t(style.label)}
                  </span>
                </button>
                {isOpen ? (
                  <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-[12px]">
                    {[
                      { doc: left, excerpt: m.leftExcerpt, value: m.leftValue },
                      { doc: right, excerpt: m.rightExcerpt, value: m.rightValue },
                    ].map((side, i) => (
                      <div key={i}>
                        <p className={labelTextClass}>
                          {side.doc} · <span className={style.text}>{formatContradictionValue(m.kind, side.value)}</span>
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
