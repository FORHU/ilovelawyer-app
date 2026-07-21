"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import LegalMarkdown from "@/components/library/legal-markdown";
import { useLegalDocumentQuery } from "@/lib/legal-rag/mutations";

export default function LegalDocumentDetailPage() {
  const { t } = useTranslation("library");
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useLegalDocumentQuery(params.id);

  const content = data?.formatted_markdown?.trim() || data?.summary?.trim() || data?.concise_summary?.trim() || "";

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-linear-to-b from-slate-50 to-blue-50/50 text-[#181c1e] font-['Inter',sans-serif]">
      <GlobalHeader activeTab="library" />

      <main className="w-full flex flex-col flex-1 pt-14">
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
            <Link
              href="/homepage/library/documents"
              className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 hover:text-black"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("documents.detail.backLink")}
            </Link>

            {data && (
              <>
                <h1 className="font-['Libre_Caslon_Text'] text-2xl md:text-3xl text-black">
                  {data.title || t("documents.untitled")}
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  {data.case_no || data.category}
                  {data.year ? ` · ${data.year}` : ""}
                </span>
                {data.source_url && (
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-xs text-blue-900 hover:underline"
                  >
                    {t("documents.detail.viewSource")}
                  </a>
                )}
              </>
            )}
          </div>
        </section>

        <section className="flex-1 bg-white">
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-8">
            {isLoading && (
              <div className="flex items-center gap-2 py-16 justify-center text-gray-500 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("documents.detail.loading")}
              </div>
            )}

            {isError && (
              <div className="py-16 text-center text-sm text-red-600">{t("documents.detail.loadError")}</div>
            )}

            {!isLoading && !isError && !content && (
              <div className="py-16 text-center text-sm text-gray-500">{t("documents.detail.notFound")}</div>
            )}

            {content && <LegalMarkdown content={content} />}
          </div>
        </section>
      </main>

      <SiteFooter compact />
    </div>
  );
}
