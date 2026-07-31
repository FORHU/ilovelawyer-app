"use client";
import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight, FileStack, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { useLegalDocumentsQuery } from "@/lib/legal-rag/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const PAGE_SIZE = 20;

function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function LegalDocumentsPage() {
  return (
    <Suspense fallback={null}>
      <LegalDocumentsPageContent />
    </Suspense>
  );
}

function LegalDocumentsPageContent() {
  const { t } = useTranslation("library");
  const searchParams = useSearchParams();
  const category = searchParams.get("category") || undefined;
  const subcategory = searchParams.get("subcategory") || undefined;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useLegalDocumentsQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
    category,
    subcategory,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="library" />

      <main className="w-full flex flex-col flex-1 pt-14">
        <section className="bg-card border-b border-border">
          <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-10 flex flex-col gap-4">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/homepage/library"
                  className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("documents.backToLibrary")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Return to the Library home</TooltipContent>
            </Tooltip>

            <h1 className="font-['Libre_Caslon_Text',serif] text-3xl md:text-4xl text-foreground">
              {subcategory
                ? `${humanize(category ?? "")} — ${humanize(subcategory)}`
                : category
                  ? humanize(category)
                  : t("documents.pageTitle")}
            </h1>

            <form
              onSubmit={handleSearch}
              className="w-full max-w-lg bg-card border border-foreground rounded-lg flex items-center p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-foreground/10 transition-shadow"
            >
              <Search className="w-4 h-4 text-muted-foreground shrink-0 ml-3" aria-hidden="true" />
              <input
                type="text"
                aria-label={t("documents.searchAriaLabel")}
                className="flex-1 bg-transparent py-2.5 px-3 outline-none text-sm text-foreground placeholder-muted-foreground"
                placeholder={t("documents.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="submit"
                    className="bg-primary text-primary-foreground text-xs font-semibold tracking-wider px-5 py-2.5 rounded-md hover:bg-primary/90 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                  >
                    {t("documents.searchButton")}
                  </button>
                </TooltipTrigger>
                <TooltipContent>Search indexed legal documents by keyword</TooltipContent>
              </Tooltip>
            </form>
          </div>
        </section>

        <section className="flex-1 bg-muted">
          <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("documents.loading")}
              </div>
            )}

            {isError && (
              <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">{t("documents.loadError")}</div>
            )}

            {!isLoading && !isError && (data?.data.length ?? 0) === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
                <FileStack className="h-8 w-8 mb-3 text-muted-foreground/40" aria-hidden="true" />
                {t("documents.empty")}
              </div>
            )}

            {data?.data.map((doc) => (
              <Tooltip key={doc.id}>
                <TooltipTrigger asChild>
                  <Link
                    href={`/homepage/library/documents/${doc.id}`}
                    className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-foreground/30 hover:shadow-md"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {doc.case_no || doc.category}
                      {doc.year ? ` · ${doc.year}` : ""}
                    </span>
                    <span className="text-sm font-medium text-foreground">{doc.title || t("documents.untitled")}</span>
                    {doc.concise_summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{doc.concise_summary}</p>
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent>Open {doc.title || t("documents.untitled")}&rsquo;s full text</TooltipContent>
              </Tooltip>
            ))}

            {!isLoading && !isError && (data?.total ?? 0) > 0 && (
              <div className="flex items-center justify-between pt-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("documents.prev")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Go to the previous page of results</TooltipContent>
                </Tooltip>
                <span className="text-xs text-muted-foreground">{t("documents.pageIndicator", { page, totalPages })}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 rounded-xs"
                    >
                      {t("documents.next")}
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Go to the next page of results</TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
