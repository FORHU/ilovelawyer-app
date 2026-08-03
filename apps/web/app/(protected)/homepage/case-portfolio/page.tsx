"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import GlobalHeader from "@/components/global-header";
import EditCaseModal from "@/components/cases/edit-case-modal";
import DeleteCaseModal from "@/components/cases/delete-case-modal";
import { Search, Plus, Briefcase, Loader2, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useCasesQuery, useUpdateCaseMutation, useDeleteCaseMutation, type CaseRecord, type UpdateCasePayload } from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

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

  return (
    <div className="min-h-screen w-full relative flex flex-col bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="case-portfolio" />

      {/* HERO BACKDROP — always navy regardless of theme, matching the header */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-navy-800 to-brand-navy-950 py-14 md:py-16">
        <div className="pointer-events-none absolute -top-16 -right-16 h-64 w-64 rounded-full bg-brand-gold/10 blur-3xl" aria-hidden="true" />
        <div className="relative max-w-[1440px] w-full mx-auto px-6 md:px-16 flex flex-col gap-2">
          <h1 className="font-['Libre_Caslon_Text'] text-3xl md:text-4xl text-white font-normal tracking-[-0.6px]">
            {t("title")}
          </h1>
          <p className="text-white/70 text-sm max-w-md">
            {t("managingActiveProceedings", { count: cases.length })}
          </p>
        </div>
      </section>

      {/* Main Framework Dashboard Body */}
      <main className="max-w-[1440px] w-full mx-auto px-6 md:px-16 py-12 relative z-10 flex flex-col gap-10">

        <section className="flex flex-col md:flex-row items-center gap-4 md:gap-6 justify-between w-full">
          <div className="relative w-full md:max-w-xl flex items-center">
            <span className="absolute left-4 text-muted-foreground">
              <Search className="w-5 h-5" />
            </span>
            <input
              type="text"
              className="w-full bg-card border border-border rounded-xl py-3 pl-12 pr-4 outline-none font-['Inter'] text-[15px] shadow-sm hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </section>

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

        {!isLoading && !isError && (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {cases.map((c) => (
              <div
                key={c.id}
                className="relative group/card min-h-75 bg-card rounded-2xl border border-border p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover/card:opacity-100 focus-within:opacity-100 transition-opacity">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setEditingCase(c);
                        }}
                        className="rounded-full p-2 bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
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
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeletingCase(c);
                        }}
                        className="rounded-full p-2 bg-card border border-border text-muted-foreground hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 dark:hover:border-red-500/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
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
                    <Link href={`/homepage/case-portfolio/${c.id}`} className="w-full">
                      <h3 className="font-['Libre_Caslon_Text'] text-[24px] text-foreground font-normal leading-tight mb-2 pr-16">
                        {c.caseName}
                      </h3>
                      <p className="text-muted-foreground text-[14px] font-['Inter']">
                        {c.partyInvolved || t("noPartyListed")}
                      </p>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Open {c.caseName}&rsquo;s full case record</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link href={`/homepage/case-portfolio/${c.id}`} className="border-t border-border pt-5 mt-8 flex items-end justify-between">
                      <div>
                        <span className="block text-muted-foreground text-[10px] uppercase font-semibold tracking-wider mb-1">
                          {t("lastUpdated")}
                        </span>
                        <span className="text-foreground text-[14px] font-semibold">
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent>Open {c.caseName}&rsquo;s full case record</TooltipContent>
                </Tooltip>
              </div>
            ))}

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleNewFiling}
                  className="group min-h-75 border-2 border-dashed border-border bg-transparent hover:bg-card hover:border-primary/30 rounded-2xl flex flex-col items-center justify-center p-8 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground group-hover:bg-primary/5 group-hover:text-primary transition-colors mb-3">
                    <Plus className="w-5 h-5 stroke-[2.5]" aria-hidden="true" />
                  </div>
                  <span className="text-[12px] font-semibold tracking-[1.2px] text-muted-foreground group-hover:text-foreground transition-colors uppercase">
                    {t("initiateNewFiling")}
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>Start a new case intake form</TooltipContent>
            </Tooltip>
          </section>
        )}

        {!isLoading && !isError && debouncedSearch !== "" && cases.length === 0 && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground shadow-sm">
              <Briefcase className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-foreground mb-2">{t("noMatchingCases")}</h4>
            <p className="text-muted-foreground text-[15px] max-w-[320px]">
              {t("noMatchingCasesHint")}
            </p>
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
