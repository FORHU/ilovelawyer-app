import type { LawCategoryParam } from "./queries"

/**
 * Whether a citation href points at the app's own Library detail route rather than an external
 * source. ilovelawyer-api's legal-citation-link-rewrite.ts rewrites a citation's href to this
 * exact shape when it resolves the citation to a Library item (both for inline chat prose and
 * for Related Cases); anything else is a genuine external reference. Shared by
 * components/chat/assistant-message.tsx and components/case-workspace/sources-panel.tsx so both
 * surfaces agree on what counts as "internal."
 */
export const INTERNAL_LIBRARY_HREF_RE = /^\/homepage\/library\/laws\//

export function isInternalLibraryHref(href: string | null | undefined): href is string {
  return !!href && INTERNAL_LIBRARY_HREF_RE.test(href)
}

const LIBRARY_CATEGORIES: readonly LawCategoryParam[] = ["jurisprudence", "republic-acts", "uk-case-law", "uk-legislation"]

/**
 * Splits an internal Library href back into the `(category, id)` pair GET /api/law/preview and
 * /api/law/document take — the inverse of legal-citation-link-rewrite.ts's `libraryHref`. `id` is
 * the juris.ph id for PH and `Law.id` for UK, exactly as the API wrote it into the path. Null for
 * anything that isn't a Library href or carries an unknown `?category=`; a missing category
 * defaults to "jurisprudence", matching the detail page's own fallback.
 */
export function parseLibraryHref(href: string): { category: LawCategoryParam; id: string } | null {
  if (!isInternalLibraryHref(href)) return null
  const url = new URL(href, "http://localhost")
  const segment = url.pathname.slice("/homepage/library/laws/".length).split("/")[0]
  if (!segment) return null
  const category = (url.searchParams.get("category") ?? "jurisprudence") as LawCategoryParam
  if (!LIBRARY_CATEGORIES.includes(category)) return null
  return { category, id: decodeURIComponent(segment) }
}
