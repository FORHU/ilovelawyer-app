"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import LegalMarkdown from "@/components/library/legal-markdown";
import { useLegalDocumentQuery } from "@/lib/legal-rag/mutations";
import { useJurisdictionFeatureGuard } from "@/components/jurisdiction-feature-guard";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export default function LegalDocumentDetailPage() {
  const guard = useJurisdictionFeatureGuard("legalSearch", "library", {
    eyebrow: "Research · Library",
    heading: "Not available for your jurisdiction",
    body: (displayName) => `The legal research library isn't available for ${displayName} organizations yet.`,
  });
  const { t } = useTranslation("library");
  const params = useParams<{ id: string }>();
  const { data, isLoading, isError } = useLegalDocumentQuery(params.id);

  const content = data?.formatted_markdown?.trim() || data?.summary?.trim() || data?.concise_summary?.trim() || "";

  if (guard) return guard;

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="library" />

      <main className="w-full flex flex-col flex-1 pt-14">
        <section className="bg-card border-b border-border">
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-8 flex flex-col gap-3">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href="/homepage/library/documents"
                  className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("documents.detail.backLink")}
                </Link>
              </TooltipTrigger>
              <TooltipContent>Return to the indexed documents list</TooltipContent>
            </Tooltip>

            {data && (
              <>
                <h1 className="font-['Libre_Caslon_Text',serif] text-2xl md:text-3xl text-foreground">
                  {data.title || t("documents.untitled")}
                </h1>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {data.case_no || data.category}
                  {data.year ? ` · ${data.year}` : ""}
                </span>
                {data.source_url && (
                  <a
                    href={data.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-fit text-xs text-blue-900 dark:text-blue-400 hover:underline"
                  >
                    {t("documents.detail.viewSource")}
                  </a>
                )}
              </>
            )}
          </div>
        </section>

        <section className="flex-1 bg-card">
          <div className="max-w-[900px] mx-auto px-6 md:px-10 py-8">
            {isLoading && (
              <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground text-sm">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t("documents.detail.loading")}
              </div>
            )}

            {isError && (
              <div className="py-16 text-center text-sm text-red-600 dark:text-red-400">{t("documents.detail.loadError")}</div>
            )}

            {!isLoading && !isError && !content && (
              <div className="py-16 text-center text-sm text-muted-foreground">{t("documents.detail.notFound")}</div>
            )}

            {content && <LegalMarkdown content={content} title={data?.title || undefined} />}
          </div>
        </section>
      </main>
    </div>
  );
}
