import { LAW_CASE_TYPES, LAW_TOPICS, UK_COURTS, type LawCategoryParam } from "@/lib/law/queries"

/**
 * Per-tenant configuration for the Library's `<LawSearchPanel/>` and the law-document detail
 * page — the parts that differ between PH (juris.ph) and UK (UK Legal MCP): which categories
 * exist, which support faceted browse, the facet vocab, and how a result renders. Everything
 * translatable stays in the `library` i18n namespace (lawSearch / lawDoc keys); this file only
 * holds structure + i18n key names.
 */

export type LibraryFacetKind = "ph-jurisprudence" | "ph-topics" | "uk-court" | "none"

export interface LibraryCategory {
  value: LawCategoryParam
  labelKey: string
}

export interface LibraryTenantConfig {
  /** `lawSearch.*` sub-keys for the panel heading + search box. */
  titleKey: string
  subtitleKey: string
  searchAriaKey: string
  searchPlaceholderKey: string
  categories: LibraryCategory[]
  /** Which facet UI a given category shows in browse mode. */
  facetKind: (category: LawCategoryParam) => LibraryFacetKind
  /** Categories that support the faceted browse grid. Others are search-only and show
   * `searchOnlyHintKey` in place of the grid. */
  browsable: (category: LawCategoryParam) => boolean
  searchOnlyHintKey: string
  /** True when the detail page + card should render the "legislation" layout rather than the
   * "case law" one. */
  isLegislation: (category: LawCategoryParam) => boolean
  /** i18n key for the "Ponente" / "Judge" label shown under a result. */
  leadActorLabelKey: string
  /** i18n key for a result card's open-CTA, by category. */
  openLabelKey: (category: LawCategoryParam) => string
  /** Court facet options (UK case law only). */
  courts: readonly string[]
  caseTypes: readonly string[]
  topics: readonly string[]
}

const PH_CONFIG: LibraryTenantConfig = {
  titleKey: "lawSearch.title",
  subtitleKey: "lawSearch.subtitle",
  searchAriaKey: "lawSearch.searchAriaLabel",
  searchPlaceholderKey: "lawSearch.searchPlaceholder",
  categories: [
    { value: "jurisprudence", labelKey: "lawSearch.categories.jurisprudence" },
    { value: "republic-acts", labelKey: "lawSearch.categories.republicActs" },
  ],
  facetKind: (c) => (c === "jurisprudence" ? "ph-jurisprudence" : "ph-topics"),
  browsable: () => true,
  searchOnlyHintKey: "lawSearch.searchOnlyHint",
  isLegislation: (c) => c === "republic-acts",
  leadActorLabelKey: "lawSearch.ponenteLabel",
  openLabelKey: (c) => (c === "republic-acts" ? "lawSearch.openAct" : "lawSearch.openRecord"),
  courts: [],
  caseTypes: LAW_CASE_TYPES,
  topics: LAW_TOPICS,
}

const UK_CONFIG: LibraryTenantConfig = {
  titleKey: "lawSearch.ukTitle",
  subtitleKey: "lawSearch.ukSubtitle",
  searchAriaKey: "lawSearch.ukSearchAriaLabel",
  searchPlaceholderKey: "lawSearch.ukSearchPlaceholder",
  categories: [
    { value: "uk-case-law", labelKey: "lawSearch.categories.ukCaseLaw" },
    { value: "uk-legislation", labelKey: "lawSearch.categories.ukLegislation" },
  ],
  facetKind: (c) => (c === "uk-case-law" ? "uk-court" : "none"),
  browsable: (c) => c === "uk-case-law",
  searchOnlyHintKey: "lawSearch.ukLegislationSearchHint",
  isLegislation: (c) => c === "uk-legislation",
  leadActorLabelKey: "lawSearch.judgeLabel",
  openLabelKey: (c) => (c === "uk-legislation" ? "lawSearch.openLegislation" : "lawSearch.openJudgment"),
  courts: UK_COURTS,
  caseTypes: [],
  topics: [],
}

export function getLibraryConfig(tenantCode: string | null | undefined): LibraryTenantConfig {
  return tenantCode === "UK" ? UK_CONFIG : PH_CONFIG
}

/** Human label for a UK court slug — "ewca/civ" -> "EWCA (Civ)", "uksc" -> "UKSC". */
export function ukCourtLabel(slug: string): string {
  const [head = slug, ...rest] = slug.split("/")
  return rest.length
    ? `${head.toUpperCase()} (${rest.map((r) => r.charAt(0).toUpperCase() + r.slice(1)).join(" ")})`
    : head.toUpperCase()
}
