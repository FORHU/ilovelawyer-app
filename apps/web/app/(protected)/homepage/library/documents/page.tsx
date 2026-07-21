"use client";
import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, FileStack, Loader2, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { useLegalDocumentsQuery } from "@/lib/legal-rag/mutations";

const PAGE_SIZE = 20;

export default function LegalDocumentsPage() {
  const { t } = useTranslation("library");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useLegalDocumentsQuery({
    page,
    limit: PAGE_SIZE,
    search: search || undefined,
  });

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-linear-to-b from-slate-50 to-blue-50/50 text-[#181c1e] font-['Inter',sans-serif]">
      <GlobalHeader activeTab="library" />

      <main className="w-full flex flex-col flex-1 pt-14">
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-10 flex flex-col gap-4">
            <Link
              href="/homepage/library"
              className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("hero.titlePrefix")} {t("hero.titleEmphasis")}
            </Link>

            <h1 className="font-['Libre_Caslon_Text'] text-3xl md:text-4xl text-black">{t("documents.pageTitle")}</h1>

            <form
              onSubmit={handleSearch}
              className="w-full max-w-lg bg-white border border-black rounded-lg flex items-center p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-black/10 transition-shadow"
            >
              <Search className="w-4 h-4 text-gray-400 shrink-0 ml-3" aria-hidden="true" />
              <input
                type="text"
                aria-label={t("documents.searchAriaLabel")}
                className="flex-1 bg-transparent py-2.5 px-3 outline-none text-sm text-gray-800 placeholder-gray-400"
                placeholder={t("documents.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="bg-black text-white text-xs font-semibold tracking-wider px-5 py-2.5 rounded-md hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2"
              >
                {t("documents.searchButton")}
              </button>
            </form>
          </div>
        </section>

        <section className="flex-1 bg-slate-100">
          <div className="max-w-[1000px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
            {isLoading && (
              <div className="flex items-center gap-2 py-16 justify-center text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("documents.loading")}
              </div>
            )}

            {isError && (
              <div className="py-16 text-center text-sm text-red-600">{t("documents.loadError")}</div>
            )}

            {!isLoading && !isError && (data?.data.length ?? 0) === 0 && (
              <div className="flex flex-col items-center justify-center text-center py-16 text-gray-500">
                <FileStack className="h-8 w-8 mb-3 text-gray-300" aria-hidden="true" />
                {t("documents.empty")}
              </div>
            )}

            {data?.data.map((doc) => (
              <Link
                key={doc.id}
                href={`/homepage/library/documents/${doc.id}`}
                className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-gray-300 hover:shadow-md"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {doc.case_no || doc.category}
                  {doc.year ? ` · ${doc.year}` : ""}
                </span>
                <span className="text-sm font-medium text-black">{doc.title || t("documents.untitled")}</span>
                {doc.concise_summary && (
                  <p className="text-xs text-gray-500 line-clamp-2">{doc.concise_summary}</p>
                )}
              </Link>
            ))}

            {!isLoading && !isError && (data?.total ?? 0) > 0 && (
              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-black cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("documents.prev")}
                </button>
                <span className="text-xs text-gray-500">{t("documents.pageIndicator", { page, totalPages })}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:text-black cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 rounded-xs"
                >
                  {t("documents.next")}
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter compact />
    </div>
  );
}
