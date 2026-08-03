import { useMutation, useQuery } from "@tanstack/react-query"
import { apiFetch } from "@/lib/fetch"
import { legalRagKeys } from "@/lib/query-keys"

export interface LegalDocumentSummary {
  id: string
  title: string | null
  case_no: string | null
  year: number | null
  category: string
  subcategory: string | null
  concise_summary: string | null
  source_url: string | null
}

export interface LegalDocumentList {
  total: number
  data: LegalDocumentSummary[]
}

export interface LegalDocumentDetail {
  id: string
  title: string | null
  case_no: string | null
  year: number | null
  category: string
  subcategory: string | null
  source_url: string | null
  summary: string | null
  concise_summary: string | null
  full_text: string | null
  formatted_markdown: string | null
  metadata_json: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

export interface LegalDocumentFilters {
  page?: number
  limit?: number
  category?: string
  subcategory?: string
  year?: number
  search?: string
}

function buildQueryString(filters: LegalDocumentFilters): string {
  const params = new URLSearchParams()
  if (filters.page) params.set("page", String(filters.page))
  if (filters.limit) params.set("limit", String(filters.limit))
  if (filters.category) params.set("category", filters.category)
  if (filters.subcategory) params.set("subcategory", filters.subcategory)
  if (filters.year) params.set("year", String(filters.year))
  if (filters.search) params.set("search", filters.search)

  const query = params.toString()
  return query ? `?${query}` : ""
}

export function useLegalDocumentsQuery(filters: LegalDocumentFilters = {}) {
  return useQuery({
    queryKey: legalRagKeys.list({ ...filters }),
    queryFn: () => apiFetch<LegalDocumentList>(`/api/legal-rag${buildQueryString(filters)}`),
  })
}

export interface LibrarySectionItem {
  key: string
  mode: "browse" | "analyze"
  category: string | null
  subcategory: string | null
  query: string | null
  count: number | null
}

export interface LibrarySection {
  key: string
  items: LibrarySectionItem[]
}

export interface LibrarySectionsResponse {
  sections: LibrarySection[]
}

export function useLibrarySectionsQuery() {
  return useQuery({
    queryKey: legalRagKeys.sections(),
    queryFn: () => apiFetch<LibrarySectionsResponse>("/api/legal-rag/library-sections"),
  })
}

export function useLegalDocumentQuery(id: string | number | undefined) {
  return useQuery({
    queryKey: legalRagKeys.detail(id ?? ""),
    queryFn: () => apiFetch<LegalDocumentDetail>(`/api/legal-rag/${id}`),
    enabled: id !== undefined && id !== "",
  })
}

export interface KeywordAnalysis {
  item_id: string
  type: "keyword_analysis"
  title: string
  url: string
  text_content: string
  formatted_markdown: string
  cached: boolean
}

export function useAnalyzeKeywordMutation() {
  return useMutation({
    mutationFn: ({ keyword }: { keyword: string }) =>
      apiFetch<KeywordAnalysis>("/api/legal-source-analysis", {
        method: "POST",
        body: JSON.stringify({ keyword }),
      }),
  })
}
