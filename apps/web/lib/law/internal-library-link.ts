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
