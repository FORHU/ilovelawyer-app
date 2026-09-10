"use client"
import { useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import { useExpandCitationMutation, useCitationEdgesQuery } from "@/lib/citation-map/mutations"
import type { CitationEdge } from "@/lib/citation-map/types"
import type { LawCategoryParam } from "@/lib/law/queries"

/** Wire `?category=` for the law an edge resolves to, so the link lands on the right tab. */
function edgeCategory(edge: CitationEdge, tenantCode: string | null | undefined): LawCategoryParam {
  if (tenantCode === "UK") {
    return edge.citationType === "case" ? "uk-case-law" : "uk-legislation"
  }
  return edge.toLaw?.category === "REPUBLIC_ACT" ? "republic-acts" : "jurisprudence"
}

function edgeLabel(edge: CitationEdge): string {
  return (
    edge.toLaw?.caseNumber ||
    edge.toLaw?.title ||
    edge.toRawReference ||
    edge.toRawTitle ||
    "—"
  )
}

/**
 * "Cited authorities" for a law-document detail page. Fires the same
 * POST /api/law/:lawId/citations/expand + poll flow the Legal Terminal's Citation Map uses —
 * for UK rows that's a structured `citations_network` call (fast, inline); for PH it's a
 * queued PDF-fetch + LLM extraction. Behind a button so a detail view never triggers work
 * (or, for PH, a queue job) unless the reader asks for it.
 */
export function LawCitations({ lawId }: { lawId: string }) {
  const { t } = useTranslation("library")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const [started, setStarted] = useState(false)

  const expand = useExpandCitationMutation()
  const edges = useCitationEdgesQuery(lawId, started)

  const status = edges.data?.status ?? (expand.data?.status ?? null)
  const list = edges.data?.edges ?? expand.data?.edges ?? []
  const loading = expand.isPending || (started && status !== "DONE" && !edges.isError)
  const failed = expand.isError || edges.isError

  if (!started) {
    return (
      <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
          {t("lawDoc.citations")}
        </h2>
        <button
          type="button"
          onClick={() => {
            setStarted(true)
            expand.mutate(lawId)
          }}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground"
        >
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("lawDoc.showCitations")}
        </button>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {t("lawDoc.citations")}
      </h2>

      {loading && (
        <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {t("lawDoc.citationsLoading")}
        </p>
      )}

      {failed && !loading && (
        <p className="text-sm text-red-600 dark:text-red-400">{t("lawDoc.citationsError")}</p>
      )}

      {!loading && !failed && status === "DONE" && list.length === 0 && (
        <p className="text-sm text-muted-foreground">{t("lawDoc.citationsEmpty")}</p>
      )}

      {!loading && list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((edge) => {
            const badge = edge.citationType ?? edge.treatment
            const label = edgeLabel(edge)
            const inner = (
              <>
                {badge && (
                  <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                    {badge}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-foreground/90">{label}</span>
                {edge.toLaw && <ArrowRight className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />}
              </>
            )
            return (
              <li key={edge.id} className="text-sm leading-relaxed">
                {edge.toLaw ? (
                  <Link
                    href={`/homepage/library/laws/${edge.toLaw.id}?category=${edgeCategory(edge, tenantCode)}`}
                    className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-muted"
                  >
                    {inner}
                  </Link>
                ) : (
                  <span className="flex items-center gap-2 px-1 py-0.5 text-muted-foreground">{inner}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
