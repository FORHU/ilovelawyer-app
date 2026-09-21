"use client"
import React, { useState } from "react"
import Link from "next/link"
import { ArrowRight, Loader2, Search, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import {
  type LawCategoryParam,
  type LawCaseType,
  type LawSearchItem,
  type LawTopic,
  type UkCourt,
  useLawBrowseInfiniteQuery,
  useLawSearchMutation,
} from "@/lib/law/queries"
import { getLibraryConfig, ukCourtLabel } from "@/lib/law/library-config"
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

  // Held loosely: the org (and therefore `cfg`) can resolve after mount, so a stored value from
  // the wrong tenant is ignored in favour of that tenant's first category rather than reset via
  // an effect. Stale facet state is already ignored by the facetKind guards below.
  const [rawCategory, setRawCategory] = useState<LawCategoryParam | null>(null)
  const category: LawCategoryParam =
    rawCategory && cfg.categories.some((c) => c.value === rawCategory)
      ? rawCategory
      : cfg.categories[0]!.value

  const [query, setQuery] = useState("")
  const [caseType, setCaseType] = useState<LawCaseType | null>(null)
  const [topics, setTopics] = useState<LawTopic[]>([])
  const [courts, setCourts] = useState<UkCourt[]>([])
  // Tracks only a fetch the user is actually waiting on (clicked Next past the fetched
  // pages) — kept separate from react-query's own `isFetchingNextPage`, which also flips
  // on/off for the silent background prefetch below. Wiring the Next button's spinner to
  // that flag directly made it flicker on every page change, since a prefetch fires right
  // after almost every navigation.
  const [isNavigatingNext, setIsNavigatingNext] = useState(false)

  const search = useLawSearchMutation()
  const showingSearch = search.status !== "idle"
  const supported = tenantCode === "PH" || tenantCode === "UK"
  const facetKind = cfg.facetKind(category)
  const canBrowse = cfg.browsable(category)

  // Browse is cursor-paged (no total), so "page N" is an index into the fetched cursor pages.
  // Keyed by the active filters so changing category/facets snaps back to page 1 without an effect.
  const filterKey = JSON.stringify([category, caseType, topics, courts])
  const [pageState, setPageState] = useState({ key: filterKey, index: 0 })
  const requestedPage = pageState.key === filterKey ? pageState.index : 0

  const browse = useLawBrowseInfiniteQuery({
    category,
    caseType: facetKind === "ph-jurisprudence" && caseType ? caseType : undefined,
    topics,
    courts: facetKind === "uk-court" ? courts : [],
    enabled: supported && !showingSearch && canBrowse,
  })

  // The page-number row can only show pages already fetched, and each one depends on the
  // previous page's cursor, so they can't be fetched in parallel ahead of time. Without this,
  // pageCount trails one behind `current` on every forward click, so the pagination's sliding
  // window (see components/ui/pagination.tsx) can only ever show pages up to `current` — it
  // can never centre the current page the way it does once the true end is known. This keeps
  // fetching one page at a time until enough are in hand to fill the window centred on
  // whatever page is currently requested.
  const browsePageCount = browse.data?.pages.length ?? 0
  React.useEffect(() => {
    if (!browse.hasNextPage || browse.isFetchingNextPage) return
    const desiredPageCount = Math.max(PAGINATION_WINDOW_SIZE, requestedPage + 1 + PAGINATION_WINDOW_HALF)
    if (browsePageCount < desiredPageCount) {
      void browse.fetchNextPage()
    }
    // `browse` itself is deliberately omitted below — react-query hands back a fresh object
    // every render, and the primitives already listed capture everything this needs to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browse.hasNextPage, browse.isFetchingNextPage, browsePageCount, requestedPage])

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
    search.reset()
    setQuery("")
  }

  const pickCategory = (next: LawCategoryParam) => {
    if (next === category) return
    setRawCategory(next)
    setCaseType(null)
    setTopics([])
    setCourts([])
    // Switching datasets always drops back to browse — a search is scoped to one dataset.
    backToBrowse()
  }

  const toggleTopic = (topic: LawTopic) =>
    setTopics((cur) => (cur.includes(topic) ? cur.filter((x) => x !== topic) : [...cur, topic]))

  const toggleCourt = (c: UkCourt) =>
    setCourts((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  const runSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    search.mutate({ category, q })
  }

  const browsePages = browse.data?.pages ?? []
  const pageIndex = Math.min(requestedPage, Math.max(0, browsePages.length - 1))
  const browseItems = browsePages[pageIndex]?.items ?? []
  const isLastPage = pageIndex >= browsePages.length - 1 && !browse.hasNextPage
  const goToPage = (index: number) => setPageState({ key: filterKey, index })
  const goNext = async () => {
    if (pageIndex + 1 < browsePages.length) return goToPage(pageIndex + 1)
    setIsNavigatingNext(true)
    try {
      const res = await browse.fetchNextPage()
      if ((res.data?.pages.length ?? 0) > pageIndex + 1) goToPage(pageIndex + 1)
    } finally {
      setIsNavigatingNext(false)
    }
  }
  const notice = showingSearch ? search.data?.notice : browse.data?.pages[0]?.notice

  const renderCard = (item: LawSearchItem) => {
    const rowId = item.stored_id || item.id
    const title = itemTitle(item) || t("lawSearch.untitled")
    const reference = itemReference(item)
    const snippet = item.facts ?? item.summary
    return (
      <Link
        key={rowId}
        href={`/homepage/library/laws/${item.id}?category=${category}`}
        className="flex h-full min-h-56 flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:outline-none"
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
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{item.year}</span>
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
          <div className="flex gap-1">
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

          <div className="flex min-w-0 flex-1 items-center rounded-lg border border-border bg-transparent p-1.5 transition-colors focus-within:border-primary sm:max-w-md">
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
            disabled={search.isPending || !query.trim()}
            className="hidden shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-semibold tracking-wider text-primary-foreground uppercase transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
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
        {!showingSearch && canBrowse && (facetKind === "ph-jurisprudence" || facetKind === "ph-topics" || facetKind === "uk-court") && (
          <div className="flex flex-col gap-3 border-y border-border py-3">
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
            {search.isPending && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("lawSearch.searching")}
              </div>
            )}

            {search.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">{t("lawSearch.error")}</p>
            )}

            {search.data && (
              <>
                <p className="text-xs text-muted-foreground">
                  {t("lawSearch.resultCount", { count: search.data.meta.count })}
                </p>
                {search.data.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("lawSearch.empty")}</p>
                ) : (
                  <div className={cardGridClass}>{search.data.items.map(renderCard)}</div>
                )}
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
            {browse.isPending && (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("lawSearch.searching")}
              </div>
            )}

            {browse.isError && (
              <p className="text-sm text-red-600 dark:text-red-400">{t("lawSearch.browseError")}</p>
            )}

            {browse.data && (
              <>
                {browseItems.length === 0 ? (
                  <p className="py-6 text-sm text-muted-foreground">{t("lawSearch.browseEmpty")}</p>
                ) : (
                  <div className={cardGridClass}>{browseItems.map(renderCard)}</div>
                )}

                {browseItems.length > 0 && (pageIndex > 0 || !isLastPage) && (
                  <CursorPagination
                    pageIndex={pageIndex}
                    pageCount={browsePages.length}
                    hasMore={!isLastPage}
                    isFetchingNext={isNavigatingNext}
                    onGoToPage={goToPage}
                    onNext={() => void goNext()}
                    labels={{
                      first: t("lawSearch.pageFirst"),
                      previous: t("lawSearch.pagePrevious"),
                      next: t("lawSearch.pageNext"),
                    }}
                    className="justify-center pt-2"
                  />
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
