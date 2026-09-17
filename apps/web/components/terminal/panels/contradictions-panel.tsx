import { useTranslation } from "react-i18next"
import { Search } from "lucide-react"
import { Badge } from "@workspace/ui/components/badge"
import { useAiJobStatus, useScanContradictionsMutation } from "@/lib/terminal/mutations"
import { useGraphViewQuery } from "@/lib/graph-view/mutations"
import { EmptyNote, PanelBody, PanelRow, PanelRowList, SectionLabel } from "@/components/terminal/panel-kit"

function formatContradictionValue(kind: string, value: string) {
  if (kind === "amount_mismatch" && /^\d+(\.\d+)?$/.test(value)) {
    return `₱${Number(value).toLocaleString()}`
  }
  return value
}

function contradictionHeadline(item: {
  kind: string
  factKey: string
  leftValue: string
  rightValue: string
}) {
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
  const job = useAiJobStatus(caseId, "contradictions")
  const graphView = useGraphViewQuery(caseId, "contradictions")
  const isScanning = scan.isPending || job.data?.status === "IN_PROGRESS"
  const contradictions = graphView.data?.edges ?? []

  return (
    <PanelBody gap="4">
      <button
        type="button"
        onClick={() => scan.mutate()}
        disabled={isScanning}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-brand-gold text-[11px] font-semibold tracking-[1.4px] text-brand-navy-950 uppercase transition-colors hover:bg-brand-gold/85 disabled:opacity-50"
      >
        <Search className="h-3.5 w-3.5" aria-hidden="true" />
        {isScanning ? t("scanning") : t("scan")}
      </button>

      {contradictions.length === 0 ? (
        <EmptyNote>{t("noContradictions")}</EmptyNote>
      ) : (
        <div>
          <SectionLabel>{t("contradictions")}</SectionLabel>
          <PanelRowList>
            {contradictions.map((edge) => {
              const metadata = edge.metadata as {
                kind: string
                factKey: string
                leftValue: string
                rightValue: string
                leftExcerpt: string
                rightExcerpt: string
              }
              return (
                <PanelRow key={edge.id} className="flex-col items-start gap-1.5">
                  <div className="flex w-full items-center gap-2">
                    <p className="min-w-0 flex-1 font-mono text-[12px] text-orange-400">
                      {contradictionHeadline(metadata)}
                    </p>
                    {/* Substitutes the mock's fabricated "Direct/Inferential" tag with the real
                     * contradiction-kind field instead of inventing a classification. */}
                    <Badge tone="neutral" shape="pill">
                      {metadata.kind}
                    </Badge>
                  </div>
                  {metadata.leftExcerpt ? (
                    <p className="text-[12px] leading-5 text-foreground/80">
                      “{metadata.leftExcerpt}”
                    </p>
                  ) : null}
                  {metadata.rightExcerpt ? (
                    <p className="text-[12px] leading-5 text-muted-foreground">
                      “{metadata.rightExcerpt}”
                    </p>
                  ) : null}
                </PanelRow>
              )
            })}
          </PanelRowList>
        </div>
      )}
    </PanelBody>
  )
}
