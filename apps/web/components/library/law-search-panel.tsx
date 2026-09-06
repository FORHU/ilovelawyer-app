"use client"
import React, { useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import {
  LAW_CASE_TYPES,
  LAW_TOPICS,
  type LawCaseType,
  type LawCategoryParam,
  type LawSearchItem,
  type LawTopic,
  useLawBrowseInfiniteQuery,
  useLawSearchMutation,
} from "@/lib/law/queries"

const CATEGORIES: { value: LawCategoryParam; labelKey: string }[] = [
  { value: "jurisprudence", labelKey: "lawSearch.categories.jurisprudence" },
  { value: "republic-acts", labelKey: "lawSearch.categories.republicActs" },
]

function itemTitle(item: LawSearchItem): string {
  return item.case_title ?? item.title ?? ""
}

function itemReference(item: LawSearchItem): string | null {
  return item.case_number ?? item.ra_number ?? null
}

function topicLabel(topic: LawTopic): string {
  return topic.charAt(0).toUpperCase() + topic.slice(1)
}

const chipClass = (selected: boolean) =>
  `cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none ${
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
  }`

/**
 * juris.ph-backed Library view. Default state = facet browse (juris.ph scroll, 20 per page,
 * "Load more"); typing a query switches to local-first search. juris.ph is Philippine-law only,
 * so this renders three ways by the org's tenant: PH → the tool, UK → "coming soon", anything
 * else → "not available". Both API routes (/api/law/browse, /api/law/search) enforce PH-only.
 */
export function LawSearchPanel() {
  const { t } = useTranslation("library")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)

  const [category, setCategory] = useState<LawCategoryParam>("jurisprudence")
  const [query, setQuery] = useState("")
  const [caseType, setCaseType] = useState<LawCaseType | null>(null)
  const [topics, setTopics] = useState<LawTopic[]>([])

  const search = useLawSearchMutation()
  const showingSearch = search.status !== "idle"

  const browse = useLawBrowseInfiniteQuery({
    category,
    caseType: category === "jurisprudence" && caseType ? caseType : undefined,
    topics,
    enabled: tenantCode === "PH" && !showingSearch,
  })

  if (tenantCode !== "PH") {
    const bodyKey =
      tenantCode === "UK" ? "lawSearch.comingSoon" : "lawSearch.notAvailable"
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h2 className="font-['Libre_Caslon_Text',serif] text-2xl text-foreground">
          {t("lawSearch.title")}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t(bodyKey)}
        </p>
      </section>
    )
  }

  const backToBrowse = () => {
    search.reset()
    setQuery("")
  }

  const pickCategory = (next: LawCategoryParam) => {
    if (next === category) return
    setCategory(next)
    setCaseType(null)
    setTopics([])
    // Switching datasets always drops back to browse — a search is scoped to one dataset.
    backToBrowse()
  }

  const toggleTopic = (topic: LawTopic) =>
    setTopics((cur) =>
      cur.includes(topic) ? cur.filter((x) => x !== topic) : [...cur, topic]
    )

  const runSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    search.mutate({ category, q })
  }

  const browseItems = browse.data?.pages.flatMap((p) => p.items) ?? []
  const notice = showingSearch
    ? search.data?.notice
    : browse.data?.pages[0]?.notice

  const renderCard = (item: LawSearchItem) => {
    const rowId = item.stored_id || item.id
    const title = itemTitle(item) || t("lawSearch.untitled")
    const reference = itemReference(item)
    const snippet = item.facts ?? item.summary
    const openKey =
      category === "republic-acts"
        ? "lawSearch.openAct"
        : "lawSearch.openRecord"
    return (
      <Link
        key={rowId}
        href={`/homepage/library/laws/${item.id}?category=${category}`}
        className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {reference && (
              <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {reference}
              </span>
            )}
            {item.division && (
              <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {item.division}
              </span>
            )}
          </div>
          {item.year != null && (
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {item.year}
            </span>
          )}
        </div>

        <h3 className="line-clamp-4 text-[15px] leading-snug font-semibold text-foreground">
          {title}
        </h3>

        {snippet && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground italic">
            {snippet}
          </p>
        )}

        {item.ponente && (
          <p className="text-[11px] text-muted-foreground">
            Ponente: {item.ponente}
          </p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {item.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <span className="mt-auto inline-flex w-fit items-center gap-1 pt-1 text-xs font-medium text-blue-900 dark:text-blue-400">
          {t(openKey)}
          <ArrowRight className="size-3" aria-hidden="true" />
        </span>
      </Link>
    )
  }

  const cardGridClass =
    "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

  return (
    <section className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-8 md:px-16">
        <div className="flex flex-col gap-1">
          <h2 className="font-['Libre_Caslon_Text',serif] text-2xl text-foreground">
            {t("lawSearch.title")}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("lawSearch.subtitle")}
          </p>
        </div>

        <form
          onSubmit={runSearch}
          className="flex flex-col gap-3 sm:flex-row sm:items-center"
        >
          <div className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => pickCategory(c.value)}
                className={`cursor-pointer rounded-md border px-3 py-2 text-xs font-semibold tracking-wider uppercase transition-colors focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none ${
                  category === c.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-transparent text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                }`}
              >
                {t(c.labelKey)}
              </button>
            ))}
          </div>

          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-transparent p-1.5 transition-colors focus-within:border-primary sm:max-w-md">
            <Search
              className="ml-2 h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              aria-label={t("lawSearch.searchAriaLabel")}
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-foreground placeholder-muted-foreground outline-none"
              placeholder={t("lawSearch.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(showingSearch || query.length > 0) && (
              <button
                type="button"
                onClick={backToBrowse}
                aria-label={t("lawSearch.backToBrowse")}
                className="mr-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={search.isPending || !query.trim()}
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-semibold tracking-wider text-primary-foreground uppercase transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {search.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {t("lawSearch.searchButton")}
          </button>
        </form>

        {/* ── Filters (browse mode only) ───────────────────────────────── */}
        {!showingSearch && (
          <div className="flex flex-col gap-3 border-y border-border py-3">
            {category === "jurisprudence" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  {t("lawSearch.filterCaseType")}
                </span>
                <button
                  type="button"
                  onClick={() => setCaseType(null)}
                  className={chipClass(caseType === null)}
                >
                  {t("lawSearch.filterAll")}
                </button>
                {LAW_CASE_TYPES.map((ct) => (
                  <button
                    key={ct}
                    type="button"
                    onClick={() => setCaseType(caseType === ct ? null : ct)}
                    className={chipClass(caseType === ct)}
                  >
                    {ct}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {t("lawSearch.filterTopics")}
              </span>
              {LAW_TOPICS.map((topic) => (
                <button
                  key={topic}
                  type="button"
                  onClick={() => toggleTopic(topic)}
                  className={chipClass(topics.includes(topic))}
                >
                  {topicLabel(topic)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Search results ───────────────────────────────────────────── */}
        {showingSearch && (
          <div className="flex flex-col gap-3 text-left">
            {search.isPending && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("lawSearch.searching")}
              </div>
            )}

            {search.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("lawSearch.error")}
              </p>
            )}

            {search.data && (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("lawSearch.resultCount", {
                    count: search.data.meta.count,
                  })}
                </p>
                {search.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {t("lawSearch.empty")}
                  </p>
                ) : (
                  <div className={cardGridClass}>
                    {search.data.items.map(renderCard)}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Browse list ─────────────────────────────────────────────── */}
        {!showingSearch && (
          <div className="flex flex-col gap-3">
            {browse.isPending && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("lawSearch.searching")}
              </div>
            )}

            {browse.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {t("lawSearch.browseError")}
              </p>
            )}

            {browse.data && (
              <>
                {browseItems.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">
                    {t("lawSearch.browseEmpty")}
                  </p>
                ) : (
                  <div className={cardGridClass}>
                    {browseItems.map(renderCard)}
                  </div>
                )}

                {browse.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => browse.fetchNextPage()}
                    disabled={browse.isFetchingNextPage}
                    className="mx-auto inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {browse.isFetchingNextPage && (
                      <Loader2
                        className="size-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    )}
                    {t("lawSearch.loadMore")}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      </div>
    </section>
  )
}
