"use client"
import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Loader2, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading"
import {
  type LawCategoryParam,
  type LawCaseType,
  type LawSearchItem,
  type LawTopic,
  type UkCourt,
  useLawBrowseInfiniteQuery,
  useLawSearchInfiniteQuery,
} from "@/lib/law/queries"
import { getLibraryConfig, ukCourtFromCode, ukCourtLabel } from "@/lib/law/library-config"
import { useDateLocale } from "@/lib/i18n/date-locale"
import { FilterChipGroup } from "@/components/library/filter-chip-group"
import { CursorPagination, PAGINATION_WINDOW_HALF, PAGINATION_WINDOW_SIZE } from "@/components/ui/pagination"

function itemTitle(item: LawSearchItem): string {
  return item.case_title ?? item.title ?? ""
}

function itemReference(item: LawSearchItem): string | null {
  return item.case_number ?? item.ra_number ?? null
}

function topicLabel(topic: LawTopic): string {
  return topic.charAt(0).toUpperCase() + topic.slice(1)
}

// Mirrors renderCard's actual shape below (badge row + year, 3-line title,
// 2-line snippet, ponente line) so the swap from skeleton to real cards
// doesn't jump height the way a plain title+subtitle block would.
function ResultCardGridSkeleton({ className }: { className: string }) {
  return (
    <div className={className}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex h-full flex-col gap-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-4.5 w-14 rounded-md" />
              <Skeleton className="h-4 w-10 rounded-md" />
            </div>
            <Skeleton className="h-3 w-8" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

/**
 * Live Library search + browse. Default state = faceted browse; typing a query switches to
 * local-first search. Renders for a PH org (juris.ph) and a UK org (UK Legal MCP) — the
 * category list, facet vocab, labels and detail layout come from `getLibraryConfig`. Any other
 * tenant gets a "not available" notice. UK legislation is search-only (no query-less list
 * upstream — see ilovelawyer-api docs/adr/0005).
 */
export function LawSearchPanel() {
  const { t } = useTranslation("library")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const cfg = getLibraryConfig(tenantCode)
  const locale = useDateLocale()

  // Category, facets, page and search live in the URL (?category=&type=&topics=&courts=&page=&q=), so
  // opening a judgment and coming back — "Back to library" or the browser's Back — lands on the
  // same filter and page, and a filtered view can be shared or bookmarked. Values are checked
  // against the tenant's own vocab, so a hand-edited or other-tenant URL just falls back.
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const listParam = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean)
  const updateParams = (patch: Record<string, string | string[] | null>) => {
    const next = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      const str = Array.isArray(value) ? value.join(",") : value
      if (str) next.set(key, str)
      else next.delete(key)
    }
    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  // Held loosely: the org (and therefore `cfg`) can resolve after mount, so a value from the
  // wrong tenant is ignored in favour of that tenant's first category rather than reset via an
  // effect. Stale facet state is already ignored by the facetKind guards below.
  const rawCategory = searchParams.get("category")
  const category: LawCategoryParam =
    cfg.categories.find((c) => c.value === rawCategory)?.value ?? cfg.categories[0]!.value

  // The submitted search lives in the URL too (?q=), so coming back from a judgment restores the
  // same results; `query` is just the box's draft text, seeded from it.
  const submittedQuery = (searchParams.get("q") ?? "").trim()
  const [query, setQuery] = useState(submittedQuery)
  const caseType = (cfg.caseTypes.find((c) => c === searchParams.get("type")) ?? null) as LawCaseType | null
  const topics = listParam("topics").filter((x) => cfg.topics.includes(x)) as LawTopic[]
  const courts = listParam("courts").filter((x) => cfg.courts.includes(x)) as UkCourt[]
  const setCaseType = (next: LawCaseType | null) => updateParams({ type: next, page: null })
  const setTopics = (next: LawTopic[]) => updateParams({ topics: next, page: null })
  const setCourts = (next: UkCourt[]) => updateParams({ courts: next, page: null, spage: null })
  // Tracks only a fetch the user is actually waiting on (clicked Next past the fetched
  // pages) — kept separate from react-query's own `isFetchingNextPage`, which also flips
  // on/off for the silent background prefetch below. Wiring the Next button's spinner to
  // that flag directly made it flicker on every page change, since a prefetch fires right
  // after almost every navigation.
  const [isNavigatingNext, setIsNavigatingNext] = useState(false)

  const supported = tenantCode === "PH" || tenantCode === "UK"
  const facetKind = cfg.facetKind(category)
  const canBrowse = cfg.browsable(category)
  // Only the court facet narrows a search (the API has no PH caseType/topic search filter), so
  // it's the one facet kept on screen and applied while search results are showing.
  const search = useLawSearchInfiniteQuery({
    category,
    q: submittedQuery,
    courts: facetKind === "uk-court" ? courts : [],
    enabled: supported,
  })
  const showSearchSkeleton = useDelayedLoading(search.isLoading)
  // The submit button's spinner tracks a (re-)run of the search, not the background prefetch
  // of the next page below.
  const isSearching = search.isFetching && !search.isFetchingNextPage
  const showingSearch = submittedQuery.length > 0

  const browse = useLawBrowseInfiniteQuery({
    category,
    caseType: facetKind === "ph-jurisprudence" && caseType ? caseType : undefined,
    topics,
    courts: facetKind === "uk-court" ? courts : [],
    enabled: supported && !showingSearch && canBrowse,
  })
  const showBrowseSkeleton = useDelayedLoading(browse.isPending)

  // Browse and search are both cursor-paged (no total), so "page N" is an index into the
  // fetched cursor pages of whichever list is showing. Each keeps its own page in the URL —
  // ?page= for browse, ?spage= for search — so clearing a search lands back on the browse page
  // it left. Every filter change clears it, snapping back to page 1. A restored ?page=3 is
  // reached by the prefetch effect below, which keeps fetching until that page is in hand.
  const list = showingSearch ? search : browse
  const pageParamKey = showingSearch ? "spage" : "page"
  const requestedPage = Math.max(0, (Number.parseInt(searchParams.get(pageParamKey) ?? "", 10) || 1) - 1)

  // The page-number row can only show pages already fetched, and each one depends on the
  // previous page's cursor, so they can't be fetched in parallel ahead of time. Without this,
  // pageCount trails one behind `current` on every forward click, so the pagination's sliding
  // window (see components/ui/pagination.tsx) can only ever show pages up to `current` — it
  // can never centre the current page the way it does once the true end is known. This keeps
  // fetching one page at a time until enough are in hand to fill the window centred on
  // whatever page is currently requested. Search only prefetches the one page after the
  // current one: each UK search page is a slow MCP call per selected court, and a search is
  // usually abandoned well before its fifth page.
  const listPageCount = list.data?.pages.length ?? 0
  React.useEffect(() => {
    if (!list.hasNextPage || list.isFetchingNextPage) return
    const desiredPageCount = showingSearch
      ? requestedPage + 2
      : Math.max(PAGINATION_WINDOW_SIZE, requestedPage + 1 + PAGINATION_WINDOW_HALF)
    if (listPageCount < desiredPageCount) {
      void list.fetchNextPage()
    }
    // `list` itself is deliberately omitted below — react-query hands back a fresh object
    // every render, and the primitives already listed capture everything this needs to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingSearch, list.hasNextPage, list.isFetchingNextPage, listPageCount, requestedPage])

  if (!supported) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h2 className="font-['Libre_Caslon_Text',serif] text-2xl text-foreground">
          {t(cfg.titleKey)}
        </h2>
        <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
          {t("lawSearch.notAvailable")}
        </p>
      </section>
    )
  }

  const backToBrowse = () => {
    setQuery("")
    updateParams({ q: null, spage: null })
  }

  const pickCategory = (next: LawCategoryParam) => {
    if (next === category) return
    // Switching datasets always drops back to browse — a search is scoped to one dataset.
    setQuery("")
    updateParams({ category: next, q: null, spage: null, type: null, topics: null, courts: null, page: null })
  }

  const toggleTopic = (topic: LawTopic) =>
    setTopics(topics.includes(topic) ? topics.filter((x) => x !== topic) : [...topics, topic])

  const toggleCourt = (c: UkCourt) =>
    setCourts(courts.includes(c) ? courts.filter((x) => x !== c) : [...courts, c])

  const runSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    // Re-submitting the same text re-runs it rather than just showing the cached results.
    if (q === submittedQuery) void search.refetch()
    else updateParams({ q, spage: null })
  }

  const listPages = list.data?.pages ?? []
  const pageIndex = Math.min(requestedPage, Math.max(0, listPages.length - 1))
  const pageItems = listPages[pageIndex]?.items ?? []
  const isLastPage = pageIndex >= listPages.length - 1 && !list.hasNextPage
  const showPagination = pageItems.length > 0 && (pageIndex > 0 || !isLastPage)
  const goToPage = (index: number) => updateParams({ [pageParamKey]: index > 0 ? String(index + 1) : null })
  const goNext = async () => {
    if (pageIndex + 1 < listPages.length) return goToPage(pageIndex + 1)
    setIsNavigatingNext(true)
    try {
      const res = await list.fetchNextPage()
      if ((res.data?.pages.length ?? 0) > pageIndex + 1) goToPage(pageIndex + 1)
    } finally {
      setIsNavigatingNext(false)
    }
  }
  // A search has no known total, so a multi-page one shows the range on screen ("21–40")
  // rather than a count that would only ever be this page's.
  const firstOnPage = listPages.slice(0, pageIndex).reduce((n, p) => n + p.items.length, 0) + 1
  const notice = list.data?.pages[0]?.notice

  const pagination = (
    <CursorPagination
      pageIndex={pageIndex}
      pageCount={listPages.length}
      hasMore={!isLastPage}
      isFetchingNext={isNavigatingNext}
      onGoToPage={goToPage}
      onNext={() => void goNext()}
      labels={{
        previous: t("lawSearch.pagePrevious"),
        next: t("lawSearch.pageNext"),
      }}
      className="justify-center pt-2"
    />
  )

  const renderCard = (item: LawSearchItem) => {
    const rowId = item.stored_id || item.id
    const title = itemTitle(item) || t("lawSearch.untitled")
    const reference = itemReference(item)
    const snippet = item.facts ?? item.summary
    // UK rows carry a court code ("EWHC (KB)") — shown as the canonical short label, with the
    // full court name under the title so a summary-less card still says where it was decided.
    const court = tenantCode === "UK" && item.division ? ukCourtFromCode(item.division) : null
    const decided = item.decision_date ? new Date(item.decision_date) : null
    const decidedLabel =
      decided && !Number.isNaN(decided.getTime())
        ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(decided)
        : null
    return (
      <Link
        key={rowId}
        href={`/homepage/library/laws/${item.id}?${new URLSearchParams({ category, from: searchParams.toString() })}`}
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
                {court?.label ?? item.division}
              </span>
            )}
          </div>
          {decidedLabel ? (
            <time dateTime={item.decision_date} className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {decidedLabel}
            </time>
          ) : (
            item.year != null && (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.year}</span>
            )
          )}
        </div>

        <h3 className="line-clamp-4 text-[15px] leading-snug font-semibold text-foreground">
          {title}
        </h3>

        {court?.name && <p className="text-xs text-muted-foreground">{court.name}</p>}

        {snippet && (
          <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground italic">
            {snippet}
          </p>
        )}

        {item.ponente && (
          <p className="text-[11px] text-muted-foreground">
            {t(cfg.leadActorLabelKey)}: {item.ponente}
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
          {t(cfg.openLabelKey(category))}
          <ArrowRight className="size-3" aria-hidden="true" />
        </span>
      </Link>
    )
  }

  const cardGridClass = "grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

  return (
    <section className="flex flex-1 flex-col bg-background">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-8 md:px-16">
        <div className="flex flex-col gap-1">
          <h2 className="font-['Libre_Caslon_Text',serif] text-2xl text-foreground">
            {t(cfg.titleKey)}
          </h2>
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t(cfg.subtitleKey)}
          </p>
        </div>

        <form onSubmit={runSearch} className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div data-tour-id="library-cats" className="flex gap-1">
            {cfg.categories.map((c) => (
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

          <div data-tour-id="library-search" className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-transparent p-1.5 transition-colors focus-within:border-primary sm:max-w-md">
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              type="text"
              enterKeyHint="search"
              aria-label={t(cfg.searchAriaKey)}
              className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-foreground placeholder-muted-foreground outline-none"
              placeholder={t(cfg.searchPlaceholderKey)}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {(showingSearch || query.length > 0) && (
              <button
                type="button"
                onClick={backToBrowse}
                aria-label={t("lawSearch.backToBrowse")}
                className="mr-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-overlay-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="hidden shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-brand-gold px-5 py-2.5 text-xs font-semibold tracking-wider text-brand-gold-foreground uppercase transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
          >
            {isSearching ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Search className="size-4" aria-hidden="true" />
            )}
            {t("lawSearch.searchButton")}
          </button>
        </form>

        {/* ── Filters (PH facets in browse mode only; UK court in both) ─── */}
        {canBrowse &&
          (facetKind === "uk-court" ||
            (!showingSearch && (facetKind === "ph-jurisprudence" || facetKind === "ph-topics"))) && (
          <div data-tour-id="library-filters" className="flex flex-col gap-3 border-y border-border py-3">
            {facetKind === "ph-jurisprudence" && (
              <FilterChipGroup
                label={t("lawSearch.filterCaseType")}
                mode="single"
                allLabel={t("lawSearch.filterAll")}
                options={cfg.caseTypes.map((ct) => ({ value: ct, label: ct }))}
                selected={caseType}
                onSelect={(v) => setCaseType(v as LawCaseType | null)}
              />
            )}

            {(facetKind === "ph-jurisprudence" || facetKind === "ph-topics") && (
              <FilterChipGroup
                label={t("lawSearch.filterTopics")}
                mode="multi"
                allLabel={t("lawSearch.filterAll")}
                options={cfg.topics.map((topic) => ({ value: topic, label: topicLabel(topic as LawTopic) }))}
                selected={topics}
                onToggle={(v) => toggleTopic(v as LawTopic)}
                onClear={() => setTopics([])}
              />
            )}

            {facetKind === "uk-court" && (
              <FilterChipGroup
                label={t("lawSearch.filterCourt")}
                mode="multi"
                allLabel={t("lawSearch.filterAll")}
                options={cfg.courts.map((c) => ({ value: c, label: ukCourtLabel(c) }))}
                selected={courts}
                onToggle={(v) => toggleCourt(v as UkCourt)}
                onClear={() => setCourts([])}
              />
            )}
          </div>
        )}

        {/* ── Search results ───────────────────────────────────────────── */}
        {showingSearch && (
          <div className="flex flex-col gap-3 text-left">
            {showSearchSkeleton && <ResultCardGridSkeleton className={cardGridClass} />}

            {search.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">{t("lawSearch.error")}</p>
            )}

            {search.data && (
              <>
                <p className="text-xs text-muted-foreground">
                  {showPagination
                    ? t("lawSearch.resultRange", { from: firstOnPage, to: firstOnPage + pageItems.length - 1 })
                    : t("lawSearch.resultCount", { count: pageItems.length })}
                </p>
                {pageItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lawSearch.empty")}</p>
                ) : (
                  <div className={cardGridClass}>{pageItems.map(renderCard)}</div>
                )}

                {showPagination && pagination}
              </>
            )}
          </div>
        )}

        {/* ── Search-only category (e.g. UK legislation): no browse grid ── */}
        {!showingSearch && !canBrowse && (
          <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
            {t(cfg.searchOnlyHintKey)}
          </p>
        )}

        {/* ── Browse list ─────────────────────────────────────────────── */}
        {!showingSearch && canBrowse && (
          <div className="flex flex-col gap-3">
            {showBrowseSkeleton && <ResultCardGridSkeleton className={cardGridClass} />}

            {browse.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">{t("lawSearch.browseError")}</p>
            )}

            {browse.data && (
              <>
                {pageItems.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">{t("lawSearch.browseEmpty")}</p>
                ) : (
                  <div className={cardGridClass}>{pageItems.map(renderCard)}</div>
                )}

                {showPagination && pagination}
              </>
            )}
          </div>
        )}

        {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      </div>
    </section>
  )
}
