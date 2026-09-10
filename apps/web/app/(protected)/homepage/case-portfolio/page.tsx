"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import EditCaseModal from "@/components/cases/edit-case-modal";
import DeleteCaseModal from "@/components/cases/delete-case-modal";
import { Search, Briefcase, Scale, Loader2, AlertCircle, Pencil, Trash2, ArrowUpRight } from "lucide-react";
import { useCasesQuery, useUpdateCaseMutation, useDeleteCaseMutation, type CaseRecord, type UpdateCasePayload } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

const TABLE_GRID_COLS = "grid-cols-[minmax(220px,2.2fr)_140px_176px]";

export default function CaseManagerDashboard() {
  const { t } = useTranslation("case-portfolio");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [deletingCase, setDeletingCase] = useState<CaseRecord | null>(null);

  // Debounce so we don't fire a request on every keystroke while searching across
  // the user's full case set (not just the cases already loaded on this page).
  React.useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const { data, isLoading, isError, refetch } = useCasesQuery(1, 20, debouncedSearch);
  const cases = data?.data ?? [];

  const { mutateAsync: updateCase, isPending: isUpdating } = useUpdateCaseMutation();
  const { mutateAsync: deleteCase, isPending: isDeleting } = useDeleteCaseMutation();

  const handleSaveEdit = async (payload: UpdateCasePayload) => {
    if (!editingCase) return;
    await updateCase({ id: editingCase.id, payload });
    setEditingCase(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingCase) return;
    await deleteCase(deletingCase.id);
    setDeletingCase(null);
  };

  const handleNewFiling = () => {
    router.push("/homepage/create-case");
  };

  // A truly empty portfolio (no cases at all, no search in progress) gets the richer
  // onboarding empty state; a search that simply came up empty gets the plainer one below.
  const isPortfolioEmpty = !isLoading && !isError && debouncedSearch === "" && data?.total === 0;
  const isSearchEmpty = !isLoading && !isError && debouncedSearch !== "" && cases.length === 0;

  return (
    <div className="landing-theme min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="case-portfolio" />

      <main className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 relative z-10 flex flex-col gap-8">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-3.5">
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
              {t("caseCountBadge", { count: data?.total ?? cases.length })}
            </span>
            <h1 className="font-['Libre_Caslon_Text'] text-[clamp(34px,3.6vw,48px)] font-light leading-none tracking-[-0.02em] text-foreground">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[520px]">
              {t("listSubtitle")}
            </p>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleNewFiling}
                className="flex items-center gap-2.5 bg-brand-gold text-brand-navy-950 font-semibold text-[11px] tracking-[1.2px] uppercase px-6 h-[42px] rounded-full hover:opacity-85 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
              >
                {t("newCase")}
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Start a new case intake form</TooltipContent>
          </Tooltip>
        </div>

        <div className="relative w-full max-w-80 flex items-center">
          <span className="absolute left-4 text-muted-foreground">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            className="w-full bg-card border border-border rounded-full h-10 pl-11 pr-4 outline-none font-['Inter'] text-[13px] hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors"
            placeholder={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t("loading")}
          </div>
        )}

        {isError && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="h-6 w-6 text-red-600" aria-hidden="true" />
            <p className="text-sm text-red-600">{t("loadError")}</p>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="text-xs font-semibold uppercase tracking-wider text-primary hover:underline"
                >
                  {t("retry")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Retry loading your cases</TooltipContent>
            </Tooltip>
          </div>
        )}

        {!isLoading && !isError && cases.length > 0 && (
          <div className="overflow-x-auto -mx-6 px-6 md:mx-0 md:px-0">
            <div className={`grid ${TABLE_GRID_COLS} gap-4 min-w-[640px] px-4 py-3 border-b border-border text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground`}>
              <span>{t("tableCaseHeader")}</span>
              <span>{t("tableUpdatedHeader")}</span>
              <span className="text-right">{t("tableOpenInHeader")}</span>
            </div>
            <div className="min-w-[640px]">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className={`group/row grid ${TABLE_GRID_COLS} gap-4 items-center px-4 py-4 border-b border-border rounded-lg transition-colors hover:bg-card`}
                >
                  <Link href={`/homepage/case-portfolio/${c.id}`} className="min-w-0 flex flex-col gap-1">
                    <span className="font-['Libre_Caslon_Text'] text-[16px] leading-tight text-foreground truncate">
                      {c.caseName}
                    </span>
                    <span className="text-muted-foreground text-[12px] truncate">
                      {c.parties.length > 0 ? c.parties.map((p) => p.name).join(" · ") : t("noPartyListed")}
                    </span>
                  </Link>

                  <span className="text-[13px] text-foreground">
                    {new Date(c.updatedAt).toLocaleDateString()}
                  </span>

                  <div className="flex items-center justify-end gap-1.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setEditingCase(c)}
                            className="rounded-full p-2 text-muted-foreground hover:text-primary hover:bg-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                            aria-label={t("editCase", { caseName: c.caseName })}
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("editCase", { caseName: c.caseName })}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={() => setDeletingCase(c)}
                            className="rounded-full p-2 text-muted-foreground hover:text-red-600 hover:bg-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
                            aria-label={t("deleteCase", { caseName: c.caseName })}
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("deleteCase", { caseName: c.caseName })}</TooltipContent>
                      </Tooltip>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/homepage/case-portfolio/${c.id}`}
                          className="h-8 flex items-center px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-foreground/40 transition-colors"
                        >
                          {t("overview.tabWorkspace")}
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Open {c.caseName}&rsquo;s Workspace</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={`/homepage/terminal/${c.id}`}
                          aria-label={t("openTerminal")}
                          className="h-8 w-8 flex items-center justify-center rounded-full border border-border text-foreground hover:border-brand-gold hover:text-brand-gold transition-colors"
                        >
                          <Scale className="w-3.5 h-3.5" aria-hidden="true" />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>Open {c.caseName} in the Legal Terminal</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isSearchEmpty && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-foreground mb-2">{t("noMatchingCases")}</h4>
            <p className="text-muted-foreground text-[15px] max-w-[320px]">
              {t("noMatchingCasesHint")}
            </p>
          </div>
        )}

        {isPortfolioEmpty && (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="w-full max-w-[880px] grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-12 md:gap-16 items-center">
              <div className="flex flex-col gap-5">
                <h2 className="font-['Libre_Caslon_Text'] text-[clamp(30px,4vw,44px)] font-light leading-[0.98] tracking-[-0.02em] text-foreground">
                  {t("emptyState.heading1")}<br />{t("emptyState.heading2")}
                </h2>
                <p className="text-muted-foreground text-[15px] leading-relaxed max-w-[440px]">
                  {t("emptyState.body")}
                </p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleNewFiling}
                      className="self-start flex items-center gap-2.5 bg-brand-gold text-brand-navy-950 font-semibold text-[11px] tracking-[1.2px] uppercase px-6 h-11 rounded-full hover:opacity-85 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
                    >
                      {t("emptyState.cta")}
                      <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Start a new case intake form</TooltipContent>
                </Tooltip>
              </div>

              <div className="flex flex-col border border-border rounded-2xl bg-card overflow-hidden">
                {[
                  { n: "I", title: t("emptyState.step1Title"), body: t("emptyState.step1Body") },
                  { n: "II", title: t("emptyState.step2Title"), body: t("emptyState.step2Body") },
                  { n: "III", title: t("emptyState.step3Title"), body: t("emptyState.step3Body") },
                ].map((s) => (
                  <div key={s.n} className="flex gap-4 px-5 py-4.5 border-b border-border last:border-b-0">
                    <span className="font-['Libre_Caslon_Text'] text-sm text-brand-gold w-6 shrink-0">{s.n}</span>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium text-foreground">{s.title}</span>
                      <span className="text-[12.5px] text-muted-foreground leading-relaxed">{s.body}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {editingCase && (
        <EditCaseModal
          key={editingCase.id}
          caseRecord={editingCase}
          isSubmitting={isUpdating}
          onSubmit={handleSaveEdit}
          onClose={() => setEditingCase(null)}
        />
      )}

      {deletingCase && (
        <DeleteCaseModal
          key={deletingCase.id}
          caseRecord={deletingCase}
          isDeleting={isDeleting}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setDeletingCase(null)}
        />
      )}
    </div>
  );
}
