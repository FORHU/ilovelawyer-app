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
  const [court, setCourt] = useState<UkCourt | null>(null)

  const search = useLawSearchMutation()
  const showingSearch = search.status !== "idle"
  const supported = tenantCode === "PH" || tenantCode === "UK"
  const facetKind = cfg.facetKind(category)
  const canBrowse = cfg.browsable(category)

  const browse = useLawBrowseInfiniteQuery({
    category,
    caseType: facetKind === "ph-jurisprudence" && caseType ? caseType : undefined,
    topics,
    court: facetKind === "uk-court" && court ? court : undefined,
    enabled: supported && !showingSearch && canBrowse,
  })

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
    setCourt(null)
    // Switching datasets always drops back to browse — a search is scoped to one dataset.
    backToBrowse()
  }

  const toggleTopic = (topic: LawTopic) =>
    setTopics((cur) => (cur.includes(topic) ? cur.filter((x) => x !== topic) : [...cur, topic]))

  const runSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    search.mutate({ category, q })
  }

  const browseItems = browse.data?.pages.flatMap((p) => p.items) ?? []
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

  const cardGridClass = "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"

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
                options={cfg.topics.map((topic) => ({ value: topic, label: topicLabel(topic as LawTopic) }))}
                selected={topics}
                onToggle={(v) => toggleTopic(v as LawTopic)}
              />
            )}

            {facetKind === "uk-court" && (
              <FilterChipGroup
                label={t("lawSearch.filterCourt")}
                mode="single"
                allLabel={t("lawSearch.filterAll")}
                options={cfg.courts.map((c) => ({ value: c, label: ukCourtLabel(c) }))}
                selected={court}
                onSelect={(v) => setCourt(v as UkCourt | null)}
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

                {browse.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => browse.fetchNextPage()}
                    disabled={browse.isFetchingNextPage}
                    className="mx-auto inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:border-foreground/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {browse.isFetchingNextPage && (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
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
