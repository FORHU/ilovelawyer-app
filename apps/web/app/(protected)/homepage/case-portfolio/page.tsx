"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import EditCaseModal from "@/components/cases/edit-case-modal";
import DeleteCaseModal from "@/components/cases/delete-case-modal";
import ArchiveCaseModal from "@/components/cases/archive-case-modal";
import BulkArchiveCasesModal from "@/components/cases/bulk-archive-cases-modal";
import BulkRestoreCasesModal from "@/components/cases/bulk-restore-cases-modal";
import { Search, Briefcase, Archive, ArchiveRestore, CheckSquare, ListX, Loader2, Pencil, Trash2, ArrowUpRight, MoreHorizontal, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@workspace/ui/components/dropdown-menu";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";
import { ErrorState } from "@/components/error-state";
import {
  useCasesQuery,
  useUpdateCaseMutation,
  useDeleteCaseMutation,
  useArchiveCaseMutation,
  useUnarchiveCaseMutation,
  useBulkArchiveCasesMutation,
  useBulkUnarchiveCasesMutation,
  type CaseRecord,
  type CaseStatus,
  type UpdateCasePayload,
} from "@/lib/cases/mutations";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Pagination } from "@/components/ui/pagination";

const PAGE_SIZE = 15;

// Mirrors the real row grid below (name/parties, updated date, open-in links,
// action menu) so the swap from skeleton to real rows doesn't jump layout.
function CaseListSkeleton() {
  return (
    <div className="md:min-w-[760px]">
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3 border-b border-border pl-4 pr-6 py-4 md:grid md:grid-cols-[minmax(220px,2.2fr)_140px_220px_56px] md:items-center md:gap-4"
        >
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
          <Skeleton className="h-3 w-20" />
          <div className="hidden md:flex items-center gap-2">
            <Skeleton className="h-8 w-24 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-full" />
          </div>
          <Skeleton className="h-8 w-8 rounded-full justify-self-end" />
        </div>
      ))}
    </div>
  );
}

export default function CaseManagerDashboard() {
  const { t } = useTranslation("case-portfolio");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<CaseStatus>("ACTIVE");
  const [editingCase, setEditingCase] = useState<CaseRecord | null>(null);
  const [deletingCase, setDeletingCase] = useState<CaseRecord | null>(null);
  const [archivingCase, setArchivingCase] = useState<CaseRecord | null>(null);
  // Bulk selection — available on both tabs (Active gets bulk archive, Archived gets bulk
  // restore), scoped to the current page of results (same "select what's on screen" scope as
  // DocumentFolderBrowser's bulk selection), so it's cleared whenever the page, tab, or search
  // changes out from under it rather than silently acting on ids no longer visible.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [confirmingBulkArchive, setConfirmingBulkArchive] = useState(false);
  const [confirmingBulkRestore, setConfirmingBulkRestore] = useState(false);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedCaseIds(new Set());
  };

  const switchStatusFilter = (next: CaseStatus) => {
    setStatusFilter(next);
    setPage(1);
    exitSelectMode();
  };

  // Debounce so we don't fire a request on every keystroke while searching across
  // the user's full case set (not just the cases already loaded on this page). Resetting
  // the page here too (rather than in a separate effect keyed off debouncedSearch) keeps
  // both updates inside the same async callback instead of a synchronous effect body.
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const { data, isLoading: isFetching, isError, refetch } = useCasesQuery(page, PAGE_SIZE, debouncedSearch, statusFilter);
  const isLoading = useDelayedLoading(isFetching);
  const cases = data?.data ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  // The current page can outlive the data that justified it — e.g. archiving/deleting the
  // last case on the last page shrinks totalPages out from under `page`. Snap back to the
  // new last page rather than rendering a blank result with no cases and no empty-state copy.
  React.useEffect(() => {
    if (data && page > totalPages) {
      setPage(totalPages);
    }
  }, [data, page, totalPages]);

  // A selection is scoped to the current page's ids — paging away (or a new search/page of
  // results replacing them) makes it stale, so drop it rather than let "Select all" silently
  // point at cases no longer on screen.
  React.useEffect(() => {
    exitSelectMode();
  }, [page, debouncedSearch]);

  const { mutateAsync: updateCase, isPending: isUpdating } = useUpdateCaseMutation();
  const { mutateAsync: deleteCase, isPending: isDeleting } = useDeleteCaseMutation();
  const { mutateAsync: archiveCase, isPending: isArchiving } = useArchiveCaseMutation();
  const { mutate: unarchiveCase } = useUnarchiveCaseMutation();
  const { mutateAsync: bulkArchiveCases, isPending: isBulkArchiving } = useBulkArchiveCasesMutation();
  const { mutateAsync: bulkUnarchiveCases, isPending: isBulkRestoring } = useBulkUnarchiveCasesMutation();

  const toggleCaseSelected = (id: string) => {
    setSelectedCaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allCasesSelected = cases.length > 0 && selectedCaseIds.size === cases.length;

  const toggleSelectAllCases = () => {
    setSelectedCaseIds(allCasesSelected ? new Set() : new Set(cases.map((c) => c.id)));
  };

  const handleBulkArchive = async () => {
    const ids = [...selectedCaseIds];
    const result = await bulkArchiveCases(ids);
    setConfirmingBulkArchive(false);
    exitSelectMode();
    if (result.failed.length > 0) {
      toast.error(t("archiveCasesError", { count: result.failed.length }));
    }
  };

  const handleBulkRestore = async () => {
    const ids = [...selectedCaseIds];
    const result = await bulkUnarchiveCases(ids);
    setConfirmingBulkRestore(false);
    exitSelectMode();
    if (result.failed.length > 0) {
      toast.error(t("restoreCasesError", { count: result.failed.length }));
    }
  };

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

  const handleConfirmArchive = async () => {
    if (!archivingCase) return;
    await archiveCase(archivingCase.id);
    setArchivingCase(null);
  };

  const handleNewFiling = () => {
    router.push("/homepage/create-case");
  };

  // A truly empty portfolio (no cases at all, no search in progress) gets the richer
  // onboarding empty state; a search that simply came up empty gets the plainer one below.
  // The onboarding state only makes sense for the Active tab — the Archived tab gets its
  // own empty state further below instead.
  const isPortfolioEmpty = !isLoading && !isError && statusFilter === "ACTIVE" && debouncedSearch === "" && data?.total === 0;
  const isArchivedEmpty = !isLoading && !isError && statusFilter === "ARCHIVED" && debouncedSearch === "" && data?.total === 0;
  const isSearchEmpty = !isLoading && !isError && debouncedSearch !== "" && cases.length === 0;

  return (
    <PageShell activeTab="case-portfolio">
      <main className="max-w-[1280px] w-full mx-auto px-6 md:px-12 pt-24 pb-16 relative z-10 flex flex-col gap-8">
        <div className="flex items-end justify-between gap-6 flex-wrap">
          <div className="flex flex-col gap-3.5">
            <span className="flex items-center gap-2 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-gold" aria-hidden="true" />
              {t("caseCountBadge", { count: data?.total ?? cases.length })}
            </span>
            <h1 className="font-['Libre_Caslon_Text'] text-[23px] sm:text-[clamp(34px,3.6vw,48px)] font-light leading-none tracking-[-0.02em] text-foreground">
              {t("title")}
            </h1>
            <p className="text-muted-foreground text-[13px] sm:text-[15px] leading-relaxed max-w-[520px]">
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

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative w-full sm:max-w-80 flex items-center">
            <span className="absolute left-4 text-muted-foreground">
              <Search className="w-4 h-4" />
            </span>
            {/* text-base (16px) on mobile avoids iOS Safari's auto-zoom-on-focus; sm:text-[13px]
             * restores the original compact desktop size once that's no longer a risk. */}
            <input
              type="text"
              className="w-full bg-card border border-border rounded-full h-11 sm:h-10 pl-11 pr-4 outline-none font-['Inter'] text-base sm:text-[13px] hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/5 transition-colors"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* bg-card/bg-muted collapse to the same flat --background in dark mode (see
           * globals.css), so the track and active pill need explicit dark-mode fills
           * (dark:bg-white/*) plus a border — otherwise the whole toggle (and which side is
           * selected) goes invisible in dark mode, leaving bare text with no affordance. */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted dark:bg-white/[0.06] p-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => switchStatusFilter("ACTIVE")}
                  aria-pressed={statusFilter === "ACTIVE"}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 h-8 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    statusFilter === "ACTIVE"
                      ? "bg-card border-border text-foreground shadow-sm dark:bg-white/15"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("statusToggle.active")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Show active cases</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => switchStatusFilter("ARCHIVED")}
                  aria-pressed={statusFilter === "ARCHIVED"}
                  className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3.5 h-8 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                    statusFilter === "ARCHIVED"
                      ? "bg-card border-border text-foreground shadow-sm dark:bg-white/15"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("statusToggle.archived")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Show archived cases</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Select / bulk-action row — same shape as DocumentFolderBrowser's selection bar
         * (select-all checkbox + count, Deselect all, action button, Cancel). Active gets bulk
         * archive, Archived gets bulk restore — see the action button branch below. */}
        {!isLoading && !isError && cases.length > 0 && (
          <div
            className={
              selectMode
                ? "flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2 dark:bg-overlay-hover/40"
                : "flex items-center justify-end"
            }
          >
            {selectMode ? (
              <>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
                    <input
                      type="checkbox"
                      checked={allCasesSelected}
                      onChange={toggleSelectAllCases}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded border-border accent-brand-gold"
                    />
                    {t("selectAllCases")}
                    <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {t("selectedCasesCount", { count: selectedCaseIds.size })}
                    </span>
                  </label>
                  {selectedCaseIds.size > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setSelectedCaseIds(new Set())}
                          disabled={isBulkArchiving || isBulkRestoring}
                          className="inline-flex shrink-0 items-center gap-1 rounded-full border border-transparent px-2 py-1 text-[11px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ListX className="h-3 w-3 shrink-0" aria-hidden="true" />
                          {t("deselectAllCases")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("deselectAllCases")}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2.5">
                  {statusFilter === "ARCHIVED" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={selectedCaseIds.size === 0 || isBulkRestoring}
                          onClick={() => setConfirmingBulkRestore(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 py-1.5 pr-3.5 pl-3 text-xs font-semibold whitespace-nowrap text-blue-600 transition-colors hover:border-blue-500/50 hover:bg-blue-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:text-blue-400"
                        >
                          {isBulkRestoring ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                          ) : (
                            <ArchiveRestore className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          {t("restoreSelectedCases")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("restoreSelectedCases")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          disabled={selectedCaseIds.size === 0 || isBulkArchiving}
                          onClick={() => setConfirmingBulkArchive(true)}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 py-1.5 pr-3.5 pl-3 text-xs font-semibold whitespace-nowrap text-amber-600 transition-colors hover:border-amber-500/50 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-400"
                        >
                          {isBulkArchiving ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                          ) : (
                            <Archive className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )}
                          {t("archiveSelectedCases")}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{t("archiveSelectedCases")}</TooltipContent>
                    </Tooltip>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={exitSelectMode}
                        disabled={isBulkArchiving || isBulkRestoring}
                        aria-label={t("editModal.cancel")}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-overlay-hover"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{t("editModal.cancel")}</TooltipContent>
                  </Tooltip>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground dark:hover:bg-overlay-hover"
              >
                <CheckSquare className="h-3 w-3 shrink-0" aria-hidden="true" />
                {t("selectCases")}
              </button>
            )}
          </div>
        )}

        {isLoading && <CaseListSkeleton />}

        {isError && <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => refetch()} />}

        {!isLoading && !isError && cases.length > 0 && (
          <div className="md:overflow-x-auto lg:overflow-visible">
            {/* Column header only makes sense once the row below is actually a grid (md+) —
             * the stacked mobile card has no columns to label. */}
            <div className="hidden md:grid md:grid-cols-[minmax(220px,2.2fr)_140px_220px_56px] gap-4 md:min-w-[760px] pl-4 pr-6 py-3 border-b border-border text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground">
              <span>{t("tableCaseHeader")}</span>
              <span>{t("tableUpdatedHeader")}</span>
              <span className="pl-[17px]">{t("tableOpenInHeader")}</span>
              <span className="text-right">{t("tableActionHeader")}</span>
            </div>
            <div className="md:min-w-[760px]">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="group/row flex flex-col gap-3 border-b border-border pl-4 pr-6 py-4 transition-colors md:grid md:grid-cols-[minmax(220px,2.2fr)_140px_220px_56px] md:items-center md:gap-4 md:rounded-lg md:hover:bg-card dark:md:hover:bg-overlay-hover"
                >
                  {selectMode ? (
                    <div
                      role="checkbox"
                      aria-checked={selectedCaseIds.has(c.id)}
                      aria-label={t("selectCase", { caseName: c.caseName })}
                      tabIndex={0}
                      onClick={() => toggleCaseSelected(c.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleCaseSelected(c.id);
                        }
                      }}
                      className="min-w-0 flex cursor-pointer items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCaseIds.has(c.id)}
                        readOnly
                        tabIndex={-1}
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 rounded border-border accent-brand-gold"
                      />
                      <div className="min-w-0 flex flex-col gap-1">
                        <span className="font-['Libre_Caslon_Text'] text-[15px] sm:text-[16px] leading-tight text-foreground truncate">
                          {c.caseName}
                        </span>
                        <span className="text-muted-foreground text-[12px] truncate">
                          {c.parties.length > 0 ? c.parties.map((p) => p.name).join(" · ") : t("noPartyListed")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <Link href={`/homepage/case-portfolio/${c.id}`} className="min-w-0 flex flex-col gap-1">
                      <span className="font-['Libre_Caslon_Text'] text-[15px] sm:text-[16px] leading-tight text-foreground truncate">
                        {c.caseName}
                      </span>
                      <span className="text-muted-foreground text-[12px] truncate">
                        {c.parties.length > 0 ? c.parties.map((p) => p.name).join(" · ") : t("noPartyListed")}
                      </span>
                    </Link>
                  )}

                  {/* Below md this becomes the card's second row (date, links, and the action
                   * menu on one line); at md+ each `contents` wrapper drops out so date, links,
                   * and the action menu resume being their own grid columns, matching the header
                   * row above. */}
                  <div className="flex items-center justify-between gap-3 md:contents">
                    <span className="text-[13px] text-foreground">
                      {new Date(c.updatedAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-3 md:contents">
                      <div className="flex items-center gap-2">
                        {/* Hidden below md — the case name/party block above is already a link
                         * to this same Workspace route, so on mobile (where every button is
                         * competing for the same ~300px row) this would just be a second,
                         * redundant way to do what tapping the row already does. Desktop keeps
                         * it for parity with the "Open in" column header. */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Link
                              href={`/homepage/case-portfolio/${c.id}`}
                              className="hidden md:flex h-8 items-center px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-foreground/40 transition-colors"
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
                              className="flex h-11 md:h-8 items-center px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-brand-gold hover:text-brand-gold transition-colors"
                            >
                              {t("Terminal")}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent>Open {c.caseName} in the Legal Terminal</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="flex justify-end">
                        <DropdownMenu>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=open]:bg-background data-[state=open]:text-foreground"
                                  aria-label={t("rowActions", { caseName: c.caseName })}
                                >
                                  <MoreHorizontal className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </DropdownMenuTrigger>
                            </TooltipTrigger>
                            <TooltipContent>{t("rowActions", { caseName: c.caseName })}</TooltipContent>
                          </Tooltip>
                          <DropdownMenuContent>
                            {c.status === "ARCHIVED" ? (
                              <>
                                <DropdownMenuItem onSelect={() => unarchiveCase(c.id)}>
                                  <ArchiveRestore className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("unarchiveCaseCta")}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onSelect={() => setDeletingCase(c)}>
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("editModal.deleteCase")}
                                </DropdownMenuItem>
                              </>
                            ) : (
                              <>
                                <DropdownMenuItem onSelect={() => setEditingCase(c)}>
                                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("editModal.editCase")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setArchivingCase(c)}>
                                  <Archive className="w-3.5 h-3.5" aria-hidden="true" />
                                  {t("archiveCaseCta")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!isLoading && !isError && cases.length > 0 && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            labels={{
              first: t("pagination.first"),
              previous: t("pagination.previous"),
              next: t("pagination.next"),
              last: t("pagination.last"),
            }}
            className="justify-center pt-2"
          />
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

        {isArchivedEmpty && (
          <div className="flex flex-col items-center justify-center text-center py-16 -mt-4">
            <div className="w-16 h-16 bg-card rounded-full flex items-center justify-center mb-4 text-muted-foreground">
              <Archive className="h-6 w-6" aria-hidden="true" />
            </div>
            <h4 className="font-['Libre_Caslon_Text'] text-[22px] text-foreground mb-2">{t("noArchivedCases")}</h4>
            <p className="text-muted-foreground text-[15px] max-w-[320px]">
              {t("noArchivedCasesHint")}
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

      {archivingCase && (
        <ArchiveCaseModal
          key={archivingCase.id}
          caseRecord={archivingCase}
          isArchiving={isArchiving}
          onConfirm={() => void handleConfirmArchive()}
          onClose={() => setArchivingCase(null)}
        />
      )}

      {confirmingBulkArchive && (
        <BulkArchiveCasesModal
          count={selectedCaseIds.size}
          isArchiving={isBulkArchiving}
          onConfirm={() => void handleBulkArchive()}
          onClose={() => setConfirmingBulkArchive(false)}
        />
      )}

      {confirmingBulkRestore && (
        <BulkRestoreCasesModal
          count={selectedCaseIds.size}
          isRestoring={isBulkRestoring}
          onConfirm={() => void handleBulkRestore()}
          onClose={() => setConfirmingBulkRestore(false)}
        />
      )}
    </PageShell>
  );
}
