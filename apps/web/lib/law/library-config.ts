import { KR_COURTS, LAW_CASE_TYPES, LAW_TOPICS, UK_COURTS, type LawCategoryParam } from "@/lib/law/queries"
import type { TenantCode } from "@/lib/tenant-code/resolve-host"

/**
 * Per-tenant configuration for the Library's `<LawSearchPanel/>` and the law-document detail
 * page — the parts that differ between PH (juris.ph), UK (UK Legal MCP) and KR (Korean Law MCP): which categories
 * exist, which support faceted browse, the facet vocab, and how a result renders. Everything
 * translatable stays in the `library` i18n namespace (lawSearch / lawDoc keys); this file only
 * holds structure + i18n key names.
 */

/** `court`: a court filter (UK and KR case law), kept on screen while searching too. */
export type LibraryFacetKind = "ph-jurisprudence" | "ph-topics" | "court" | "none"

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
  /** Court facet options (UK and KR case law). */
  courts: readonly string[]
  /** A court filter chip's label, in the page's language (`language` is i18next's). */
  courtLabel: (court: string, language: string) => string
  /** `lawDoc.*` keys that replace the case-law detail headings, for a site whose decisions have
   * named sections of their own (KR: 판시사항, 판결요지 …). */
  docLabelKeys?: Partial<Record<"legalIssues" | "courtReasoning" | "disposition" | "legalRulesCited" | "relatedCases", string>>
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
  courtLabel: (c) => c,
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
  facetKind: (c) => (c === "uk-case-law" ? "court" : "none"),
  browsable: (c) => c === "uk-case-law",
  searchOnlyHintKey: "lawSearch.ukLegislationSearchHint",
  isLegislation: (c) => c === "uk-legislation",
  leadActorLabelKey: "lawSearch.judgeLabel",
  openLabelKey: (c) => (c === "uk-legislation" ? "lawSearch.openLegislation" : "lawSearch.openJudgment"),
  courts: UK_COURTS,
  courtLabel: (c) => ukCourtLabel(c),
  caseTypes: [],
  topics: [],
}

/** English names for KR_COURTS, shown when the page is in English; Korean shows the name itself. */
const KR_COURT_NAMES_EN: Record<string, string> = {
  대법원: "Supreme Court",
  서울고등법원: "Seoul High Court",
  부산고등법원: "Busan High Court",
  대구고등법원: "Daegu High Court",
  광주고등법원: "Gwangju High Court",
  대전고등법원: "Daejeon High Court",
  수원고등법원: "Suwon High Court",
  특허법원: "Patent Court",
  서울행정법원: "Seoul Administrative Court",
  서울가정법원: "Seoul Family Court",
  서울중앙지방법원: "Seoul Central District Court",
  서울동부지방법원: "Seoul Eastern District Court",
  수원지방법원: "Suwon District Court",
  인천지방법원: "Incheon District Court",
  부산지방법원: "Busan District Court",
}

/** A KR court's name in the page's language: English names in English, the Korean name otherwise. */
export function krCourtLabel(court: string, language: string): string {
  return language.startsWith("en") ? (KR_COURT_NAMES_EN[court] ?? court) : court
}

/** Korea: law.go.kr through the Korean Law MCP. 판례 browses newest first by court; 법령 is searched
 * by name (law.go.kr has no list of statutes to browse). */
const KR_CONFIG: LibraryTenantConfig = {
  titleKey: "lawSearch.krTitle",
  subtitleKey: "lawSearch.krSubtitle",
  searchAriaKey: "lawSearch.krSearchAriaLabel",
  searchPlaceholderKey: "lawSearch.krSearchPlaceholder",
  categories: [
    { value: "kr-case-law", labelKey: "lawSearch.categories.krCaseLaw" },
    { value: "kr-legislation", labelKey: "lawSearch.categories.krLegislation" },
  ],
  facetKind: (c) => (c === "kr-case-law" ? "court" : "none"),
  browsable: (c) => c === "kr-case-law",
  searchOnlyHintKey: "lawSearch.krLegislationSearchHint",
  isLegislation: (c) => c === "kr-legislation",
  leadActorLabelKey: "lawSearch.judgeLabel",
  openLabelKey: (c) => (c === "kr-legislation" ? "lawSearch.openLegislation" : "lawSearch.openJudgment"),
  courts: KR_COURTS,
  courtLabel: krCourtLabel,
  docLabelKeys: {
    legalIssues: "lawDoc.kr.issues",
    courtReasoning: "lawDoc.kr.holdings",
    disposition: "lawDoc.kr.order",
    legalRulesCited: "lawDoc.kr.referencedProvisions",
    relatedCases: "lawDoc.kr.referencedCases",
  },
  caseTypes: [],
  topics: [],
}

const LIBRARY_CONFIGS: Partial<Record<TenantCode, LibraryTenantConfig>> = { PH: PH_CONFIG, UK: UK_CONFIG, KR: KR_CONFIG }

export function getLibraryConfig(tenantCode: TenantCode | null | undefined): LibraryTenantConfig {
  return (tenantCode && LIBRARY_CONFIGS[tenantCode]) || PH_CONFIG
}

/** Whether the site has a Library source at all (the API answers 501 for one without). */
export function hasLibrary(tenantCode: TenantCode | null | undefined): boolean {
  return !!tenantCode && !!LIBRARY_CONFIGS[tenantCode]
}

/** Division segments that are initialisms, written in capitals in neutral citations
 *  ("EWHC (KB)", "UKUT (IAC)"); every other segment is a word abbreviation ("Civ", "Admlty"). */
const UK_DIVISION_INITIALISMS = new Set(["kb", "qb", "tcc", "ipec", "scco", "iac", "aac", "lc", "tc", "grc"])

/** Human label for a UK court slug — "ewca/civ" -> "EWCA (Civ)", "ewhc/kb" -> "EWHC (KB)", "uksc" -> "UKSC". */
export function ukCourtLabel(slug: string): string {
  const [head = slug, ...rest] = slug.split("/")
  const division = (r: string) =>
    UK_DIVISION_INITIALISMS.has(r) ? r.toUpperCase() : r.charAt(0).toUpperCase() + r.slice(1)
  return rest.length ? `${head.toUpperCase()} (${rest.map(division).join(" ")})` : head.toUpperCase()
}

/** Full name for each UK court slug, shown on result cards under the short code. Proper names,
 *  so not translated. A slug missing here just shows the short code alone. */
const UK_COURT_NAMES: Record<string, string> = {
  uksc: "UK Supreme Court",
  ukpc: "Judicial Committee of the Privy Council",
  "ewca/civ": "Court of Appeal (Civil Division)",
  "ewca/crim": "Court of Appeal (Criminal Division)",
  "ewhc/admin": "High Court (Administrative Court)",
  "ewhc/kb": "High Court (King's Bench Division)",
  "ewhc/qb": "High Court (Queen's Bench Division)",
  "ewhc/ch": "High Court (Chancery Division)",
  "ewhc/comm": "High Court (Commercial Court)",
  "ewhc/fam": "High Court (Family Division)",
  "ewhc/tcc": "High Court (Technology and Construction Court)",
  "ewhc/ipec": "High Court (Intellectual Property Enterprise Court)",
  "ewhc/pat": "High Court (Patents Court)",
  "ewhc/scco": "High Court (Senior Courts Costs Office)",
  "ewhc/admlty": "High Court (Admiralty Court)",
  ewcop: "Court of Protection",
  ewfc: "Family Court",
  eat: "Employment Appeal Tribunal",
  "ukut/iac": "Upper Tribunal (Immigration and Asylum Chamber)",
  "ukut/aac": "Upper Tribunal (Administrative Appeals Chamber)",
  "ukut/tcc": "Upper Tribunal (Tax and Chancery Chamber)",
  "ukut/lc": "Upper Tribunal (Lands Chamber)",
  "ukftt/tc": "First-tier Tribunal (Tax Chamber)",
  "ukftt/grc": "First-tier Tribunal (General Regulatory Chamber)",
}

/** A UK result's stored court code ("EWHC (Kb)", "UKSC") -> its canonical short label and full
 *  name. Rows stored before the API's capitalisation fix still say "EWHC (Kb)", so the label is
 *  rebuilt from the slug rather than shown as stored. */
export function ukCourtFromCode(code: string): { label: string; name: string | null } {
  const m = code.trim().match(/^(\S+)(?:\s*\((.+)\))?$/)
  if (!m) return { label: code, name: null }
  const slug = [m[1]!, ...(m[2] ? m[2].split(/\s+/) : [])].join("/").toLowerCase()
  return { label: ukCourtLabel(slug), name: UK_COURT_NAMES[slug] ?? null }
}
