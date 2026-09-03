import { useMutation } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"

// Wire values the API accepts for `category` (juris.ph dataset names).
export type LawCategoryParam = "jurisprudence" | "republic-acts"

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
