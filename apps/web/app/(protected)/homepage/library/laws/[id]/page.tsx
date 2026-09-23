"use client"
import React, { Suspense } from "react"
import Link from "next/link"
import { useParams, useSearchParams } from "next/navigation"
import { ArrowLeft, ExternalLink, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { PageShell } from "@/components/page-shell"
import { LawPdfViewer } from "@/components/library/law-pdf-viewer"
import {
  type LawCategoryParam,
  type LawDocument,
  useLawDocumentQuery,
} from "@/lib/law/queries"
import { getLibraryConfig } from "@/lib/law/library-config"
import { API_BASE_URL } from "@/lib/fetch"
import { useAuthStore } from "@/lib/store/auth.store"
import { useTenantCodeFeatureGuard } from "@/components/tenant-code-feature-guard"

export default function LawDocumentPage() {
  return (
    <Suspense fallback={null}>
      <LawDocumentPageContent />
    </Suspense>
  )
}

/** Collapses near-duplicate citation strings — citations_network sometimes returns both a
 * zero-padded and an unpadded form, e.g. "[2026] UKFTT 01281 (GRC)" and "[2026] UKFTT 1281 (GRC)". */
function dedupeCitations(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const key = raw.toLowerCase().replace(/\s+/g, " ").replace(/\b0+(\d)/g, "$1").trim()
    if (key && !seen.has(key)) {
      seen.add(key)
      out.push(raw)
    }
  }
  return out
}

function LawDocumentPageContent() {
  const guard = useTenantCodeFeatureGuard("legalSearch", "library", {
    eyebrow: "Research · Library",
    heading: "Not available for your jurisdiction",
    body: (displayName) =>
      `The legal research library isn't available for ${displayName} organizations yet.`,
  })
  const { t } = useTranslation("library")
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const category = (searchParams.get("category") ??
    "jurisprudence") as LawCategoryParam

  const { data, isLoading, isError } = useLawDocumentQuery({
    category,
    id: params.id,
  })

  if (guard) return guard

  return (
    <PageShell activeTab="library">
      <main className="flex w-full flex-1 flex-col pt-16">
        <div className="mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-6 py-8 md:px-10">
          <Link
            href="/homepage/library"
            className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("lawDoc.back")}
          </Link>

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("lawDoc.loading")}
            </div>
          )}

          {isError && (
            <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">
              {t("lawDoc.error")}
            </div>
          )}

          {data && <DocumentBody doc={data} />}
        </div>
      </main>
    </PageShell>
  )
}

function DocumentBody({ doc }: { doc: LawDocument }) {
  const { t } = useTranslation("library")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const cfg = getLibraryConfig(tenantCode)
  const { item, detail } = doc
  const isRa = cfg.isLegislation(item.dataset)
  const isUk = tenantCode === "UK"
  // legislation.gov.uk and the TNA judgment site both send X-Frame-Options: DENY, so their PDFs
  // can't be iframed directly — UK docs load through our same-origin `/api/law/:id/pdf` proxy.
  // PH keeps using juris.ph's `pdf_url` (juris.ph allows framing). The proxy 502s (blank frame +
  // "open in a new tab" link) if the upstream is unreachable.
  const pdfSrc = isUk ? `${API_BASE_URL}/api/law/${item.stored_id}/pdf` : item.pdf_url
  const pdfSourceLink = item.pdf_url || item.source_url || item.juris_url
  const hasPdf = isUk || !!item.pdf_url

  const sections = isRa ? (
    <>
      <Prose label={t("lawDoc.summary")} text={item.summary} />
      <Prose
        label={t("lawDoc.purpose")}
        text={detail.legislative_agenda_purpose}
      />
      <Prose
        label={t("lawDoc.affectedLaws")}
        text={detail.affected_laws_amendments}
      />
      {detail.sections && detail.sections.length > 0 && (
        <Card label={t("lawDoc.sections")}>
          <ol className="flex flex-col gap-3">
            {detail.sections.map((s, i) => (
              <li
                key={i}
                className="flex flex-col gap-1 border-l-2 border-border pl-3"
              >
                {s.title && (
                  <span className="text-sm font-semibold text-foreground">
                    {s.title}
                  </span>
                )}
                {s.summary && (
                  <span className="text-sm leading-relaxed text-muted-foreground">
                    {s.summary}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </Card>
      )}
      <ListBlock
        label={t("lawDoc.keyProvisions")}
        items={detail.key_provisions}
      />
    </>
  ) : (
    <>
      <Prose label={t("lawDoc.facts")} text={item.facts} />
      <Prose
        label={t("lawDoc.proceduralHistory")}
        text={detail.procedural_history}
      />
      <ListBlock label={t("lawDoc.legalIssues")} items={detail.legal_issues} />
      <Prose label={t("lawDoc.courtReasoning")} text={detail.court_reasoning} />
      <Prose label={t("lawDoc.disposition")} text={item.disposition} />
      <ListBlock
        label={t("lawDoc.legalRulesCited")}
        items={item.legal_rules_cited}
      />
      <ListBlock
        label={t("lawDoc.relatedCases")}
        items={dedupeCitations(detail.related_cases_cited)}
      />
      {/* PH only — for UK these are the same citations as "Related cases cited" above. */}
      {!isUk && (
        <ListBlock
          label={t("lawDoc.citedNumbers")}
          items={[...detail.cited_gr_numbers, ...detail.cited_ra_numbers]}
        />
      )}
    </>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header (full width) ──────────────────────────────────────────── */}
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          {item.reference && (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
              {item.reference}
            </span>
          )}
          {item.case_type && (
            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {item.case_type}
            </span>
          )}
          {item.division && (
            <span className="rounded-md border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {item.division}
            </span>
          )}
          {item.year != null && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {item.year}
            </span>
          )}
        </div>

        <h1 className="max-w-4xl font-['Libre_Caslon_Text',serif] text-2xl leading-snug text-foreground md:text-3xl">
          {item.title || t("lawSearch.untitled")}
        </h1>

        {item.ponente && (
          <p className="text-xs text-muted-foreground">
            {t(cfg.leadActorLabelKey)}: {item.ponente}
          </p>
        )}
        {detail.date_enacted && (
          <p className="text-xs text-muted-foreground">
            {t("lawDoc.dateEnacted")}: {detail.date_enacted}
          </p>
        )}

        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {item.source_url && (
          <a
            href={item.source_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs text-blue-900 hover:underline dark:text-blue-400"
          >
            {t("lawDoc.viewSource")}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </header>

      {!detail.fetched && (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          {t("lawDoc.detailUnavailable")}
        </p>
      )}

      {/* ── Body: sections (above, in a card grid) + document (below, full width) ──
       * Used to sit side by side sharing the row's width with the document; moved to a
       * stacked layout instead so the document (the thing people actually came to read) gets
       * the page's full width rather than splitting it with a sidebar. */}
      {hasPdf ? (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {sections}
            {detail.keywords.length > 0 && (
              <Card label={t("lawDoc.keywords")}>
                <div className="flex flex-wrap gap-1.5">
                  {detail.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <section className="flex h-[75vh] flex-col gap-2 rounded-lg border border-border bg-card p-3 lg:h-[calc(100vh-7rem)]">
            <h2 className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
              {t("lawDoc.document")}
            </h2>
            <div className="min-h-0 flex-1">
              <LawPdfViewer url={pdfSrc!} sourceUrl={pdfSourceLink} />
            </div>
          </section>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {sections}
          {detail.keywords.length > 0 && (
            <Card label={t("lawDoc.keywords")}>
              <div className="flex flex-wrap gap-1.5">
                {detail.keywords.map((k) => (
                  <span
                    key={k}
                    className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                  >
                    {k}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      <p className="border-t border-border pt-4 text-xs text-muted-foreground">
        {doc.notice}
      </p>
    </div>
  )
}

function Card({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
      <h2 className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </h2>
      {children}
    </section>
  )
}

function Prose({ label, text }: { label: string; text: string | null }) {
  if (!text) return null
  return (
    <Card label={label}>
      <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">
        {text}
      </p>
    </Card>
  )
}

function ListBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <Card label={label}>
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-foreground/90">
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </Card>
  )
}
