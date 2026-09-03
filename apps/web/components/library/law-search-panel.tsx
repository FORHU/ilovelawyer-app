"use client"
import React, { useState } from "react"
import { FileText, Loader2, Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useAuthStore } from "@/lib/store/auth.store"
import {
  type LawCategoryParam,
  type LawSearchItem,
  useLawSearchMutation,
} from "@/lib/law/queries"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { LawPdfViewer } from "./law-pdf-viewer"

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

/**
 * juris.ph-backed law search — the same local-first (DB → juris.ph → write-through) search the
 * admin panel runs, surfaced for app users on the Library page. juris.ph only covers Philippine
 * law, so this renders three ways by the org's tenant: PH → live search, UK → "coming soon",
 * anything else → "not available". The API (/api/law/search) enforces the same PH-only rule.
 *
 * Layout is Google-style: until the first search the box sits centered in the viewport; once a
 * search has been fired it collapses to a compact top bar with the results listed beneath it.
 */
export function LawSearchPanel() {
  const { t } = useTranslation("library")
  const tenantCode = useAuthStore((s) => s.organization?.tenantCode)
  const [category, setCategory] = useState<LawCategoryParam>("jurisprudence")
  const [query, setQuery] = useState("")
  const [pdfDoc, setPdfDoc] = useState<{ url: string; title: string } | null>(
    null
  )
  const search = useLawSearchMutation()

  // Has the user run a search yet? Drives the centered → top-aligned layout switch.
  const active = search.status !== "idle"

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

  const runSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    search.mutate({ category, q })
  }

  const result = search.data

  return (
    <>
      <section className="flex flex-1 flex-col bg-card">
        <div
          className={
            active
              ? "mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-6 py-8 md:px-16"
              : "mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center"
          }
        >
          <div
            className={`flex flex-col gap-1 ${active ? "" : "items-center"}`}
          >
            <h2
              className={`font-['Libre_Caslon_Text',serif] text-foreground ${active ? "text-2xl" : "text-3xl md:text-4xl"}`}
            >
              {t("lawSearch.title")}
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("lawSearch.subtitle")}
            </p>
          </div>

          <form
            onSubmit={runSearch}
            className={
              active
                ? "flex flex-col gap-3 sm:flex-row sm:items-center"
                : "flex w-full flex-col gap-3"
            }
          >
            <div className={`flex gap-1 ${active ? "" : "justify-center"}`}>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
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

            <div
              className={`flex min-w-0 flex-1 items-center rounded-lg border border-foreground bg-card p-1.5 transition-shadow focus-within:ring-2 focus-within:ring-foreground/10 ${
                active ? "sm:max-w-md" : ""
              }`}
            >
              <Search
                className="ml-2 h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="text"
                autoFocus={!active}
                aria-label={t("lawSearch.searchAriaLabel")}
                className="min-w-0 flex-1 bg-transparent px-2.5 py-2 text-sm text-foreground placeholder-muted-foreground outline-none"
                placeholder={t("lawSearch.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={search.isPending || !query.trim()}
              className={`inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-xs font-semibold tracking-wider text-primary-foreground uppercase transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
                active ? "" : "self-center"
              }`}
            >
              {search.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Search className="size-4" aria-hidden="true" />
              )}
              {t("lawSearch.searchButton")}
            </button>
          </form>

          {active && (
            <div className="flex flex-col gap-3 text-left">
              {search.isPending && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t("lawSearch.searching")}
                </div>
              )}

              {search.isError && (
                <p className="text-sm text-red-600 dark:text-red-400">
                  {t("lawSearch.error")}
                </p>
              )}

              {result && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t("lawSearch.resultCount", { count: result.meta.count })}
                  </p>

                  {result.items.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("lawSearch.empty")}
                    </p>
                  ) : (
                    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
                      {result.items.map((item) => {
                        const rowId = item.stored_id || item.id
                        return (
                          <li key={rowId} className="flex flex-col gap-1.5 p-3">
                            <span className="text-sm font-medium text-foreground">
                              {itemTitle(item) || t("lawSearch.untitled")}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {[itemReference(item), item.year]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                            {item.pdf_url && (
                              <button
                                type="button"
                                onClick={() =>
                                  setPdfDoc({
                                    url: item.pdf_url!,
                                    title:
                                      itemTitle(item) ||
                                      t("lawSearch.untitled"),
                                  })
                                }
                                className="inline-flex w-fit items-center gap-1 text-xs text-blue-900 hover:underline dark:text-blue-400"
                              >
                                <FileText
                                  className="size-3"
                                  aria-hidden="true"
                                />
                                {t("lawSearch.viewDocument")}
                              </button>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  <p className="text-xs text-muted-foreground">
                    {result.notice}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={!!pdfDoc}
        onOpenChange={(open) => {
          if (!open) setPdfDoc(null)
        }}
      >
        <DialogContent className="flex h-[90vh] max-h-none w-[min(56rem,calc(100vw-2rem))] max-w-none flex-col gap-3 overflow-hidden p-4">
          <DialogHeader>
            <DialogTitle className="pr-8 text-base leading-snug">
              {pdfDoc?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {pdfDoc && <LawPdfViewer url={pdfDoc.url} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
