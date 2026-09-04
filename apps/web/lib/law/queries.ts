import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

// Wire values the API accepts for `category` (juris.ph dataset names).
export type LawCategoryParam = "jurisprudence" | "republic-acts"

// Facet vocabularies the API accepts for /api/law/browse — mirror the juris.ph browse pages.
// `caseType` is jurisprudence-only.
export const LAW_CASE_TYPES = [
  "Criminal",
  "Civil",
  "Administrative",
  "Labor",
  "Constitutional",
  "Commercial",
] as const
export const LAW_TOPICS = [
  "criminal",
  "civil",
  "labor",
  "constitutional",
  "administrative",
  "taxation",
  "family",
  "election",
  "environmental",
  "corporate",
] as const
export type LawCaseType = (typeof LAW_CASE_TYPES)[number]
export type LawTopic = (typeof LAW_TOPICS)[number]

// ── A hit from GET /api/law/search (juris.ph item shape + our annotations) ────
// Same payload the admin panel consumes — the app route (law.route.ts) is just a
// non-admin, PH-tenant-gated entry point to the same LawSvc.search.
export interface LawSearchItem {
  id: string
  score?: number
  year?: number | null
  tags?: string[]
  url: string
  pdf_url?: string | null
  source_url?: string | null
  // jurisprudence
  case_number?: string
  case_title?: string
  case_type?: string
  division?: string
  ponente?: string
  decision_date?: string
  facts?: string
  disposition?: string
  legal_rules_cited?: string[]
  // republic-acts
  ra_number?: string
  title?: string
  summary?: string
  // our annotations
  stored_id: string
  stored: boolean
}

export interface LawSearchResult {
  items: LawSearchItem[]
  meta: {
    dataset: LawCategoryParam
    query: string
    limit: number
    count: number
    /** "cache" — served from our own stored rows; "juris.ph" — fetched live and written through. */
    source: "juris.ph" | "cache"
  }
  notice: string
}

export interface LawBrowseResult {
  items: LawSearchItem[]
  meta: {
    dataset: LawCategoryParam
    limit: number
    count: number
    hasMore: boolean
  }
  /** Opaque token for the next page, or null at the end of results. */
  cursor: string | null
  notice: string
}

/**
 * Facet browse over juris.ph (no free-text query) — the default Library view. 20 rows per
 * page, "Load more" follows the opaque cursor. PH-tenant only (API answers 501 otherwise);
 * pass `enabled: false` for non-PH orgs and while a search is showing.
 */
export function useLawBrowseInfiniteQuery(params: {
  category: LawCategoryParam
  caseType?: LawCaseType
  topics: LawTopic[]
  year?: number
  enabled: boolean
}) {
  const { category, caseType, topics, year, enabled } = params
  const sortedTopics = [...topics].sort()

  return useInfiniteQuery({
    queryKey: [
      "law",
      "browse",
      { category, caseType, topics: sortedTopics, year },
    ],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => {
      const p = new URLSearchParams({ category })
      if (caseType) p.set("caseType", caseType)
      if (sortedTopics.length) p.set("topics", sortedTopics.join(","))
      if (year) p.set("year", String(year))
      if (pageParam) p.set("cursor", pageParam)
      return apiFetch<LawBrowseResult>(`/api/law/browse?${p.toString()}`)
    },
    getNextPageParam: (last) => last.cursor ?? undefined,
    enabled,
  })
}

// ── One document (GET /api/law/document) — the detail page ───────────────────
export interface LawSection {
  title?: string
  summary?: string
}

export interface LawDocument {
  item: {
    id: string
    stored_id: string
    dataset: LawCategoryParam
    title: string
    reference: string | null
    year: number | null
    tags: string[]
    case_type: string | null
    division: string | null
    ponente: string | null
    decision_date: string | null
    facts: string | null
    disposition: string | null
    summary: string | null
    legal_rules_cited: string[]
    pdf_url: string | null
    source_url: string | null
    juris_url: string
  }
  detail: {
    /** false only when juris.ph was unreachable and we fell back to a base row without detail. */
    fetched: boolean
    keywords: string[]
    sections: LawSection[] | null
    key_provisions: string[]
    date_enacted: string | null
    legislative_agenda_purpose: string | null
    affected_laws_amendments: string | null
    principal_authors: string | null
    co_authors: string | null
    procedural_history: string | null
    court_reasoning: string | null
    legal_issues: string[]
    parties: unknown[] | null
    judges: { name?: string; role?: string }[] | null
    sanctions_and_penalties: unknown[] | null
    related_cases_cited: string[]
    cited_gr_numbers: string[]
    cited_ra_numbers: string[]
  }
  source: "juris.ph" | "cache"
  notice: string
}

/**
 * One law document by its juris id. Local-first *with detail* on the API: a stored row that
 * already has its full `retrieve` payload is served from the DB, otherwise juris.ph fills it
 * in and stores it. PH-tenant only (501 otherwise).
 */
export function useLawDocumentQuery(params: {
  category: LawCategoryParam
  id: string
}) {
  const { category, id } = params
  return useQuery({
    queryKey: ["law", "document", category, id],
    queryFn: () =>
      apiFetch<LawDocument>(
        `/api/law/document?category=${category}&id=${encodeURIComponent(id)}`
      ),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Local-first Philippine law search: the API checks our stored rows first and only calls
 * juris.ph on a miss (writing any new hit through to the DB). PH-tenant only — the caller
 * is responsible for not invoking this for a non-PH org (the API answers 501 if it does).
 */
export function useLawSearchMutation() {
  return useMutation({
    mutationFn: ({
      category,
      q,
      limit = 5,
    }: {
      category: LawCategoryParam
      q: string
      limit?: number
    }) => {
      const params = new URLSearchParams({ category, q, limit: String(limit) })
      return apiFetch<LawSearchResult>(`/api/law/search?${params.toString()}`)
    },
  })
}
