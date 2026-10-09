"use client";
import { useRouter } from "next/navigation";
import { Eye, Loader2, MoreHorizontal, Share2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@workspace/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { ErrorState } from "@/components/error-state";
import { dateLocale } from "@/lib/i18n/date-locale";
import { useEnterSharedWorkspace } from "@/lib/organizations/mutations";
import { ownerNameOf, useLeaveSharedCaseMutation, useSharedCasesQuery, type SharedCase } from "@/lib/cases/shared";

const formatDate = (iso: string) => new Intl.DateTimeFormat(dateLocale(), { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));

const GRID = "md:grid md:grid-cols-[minmax(180px,2fr)_minmax(120px,1fr)_108px_210px_56px] md:items-center md:gap-4";

/** The case list's "Shared with me" view: portfolio cases other people shared with this user.
 * They open read-only, inside the owner's portfolio (see SharedWorkspaceGuard): the case page
 * (Overview, and its documents in place of the AI Workspace) or the Terminal. There's no accept step, so "Remove from my list" is how a share is
 * declined. */
export function SharedCasesList() {
  const { t } = useTranslation("case-portfolio");
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useSharedCasesQuery();
  const leave = useLeaveSharedCaseMutation();
  const enterSharedWorkspace = useEnterSharedWorkspace();

  const open = (sharedCase: SharedCase, where: "workspace" | "terminal") => {
    enterSharedWorkspace({ id: sharedCase.organizationId, ownerName: ownerNameOf(sharedCase) });
    router.push(where === "terminal" ? `/homepage/terminal/${sharedCase.id}` : `/homepage/case-portfolio/${sharedCase.id}`);
  };

  const removeFromList = (sharedCase: SharedCase) =>
    leave.mutate(sharedCase.id, {
      onSuccess: () => toast.success(t("portfolioView.removedFromList", { caseName: sharedCase.caseName })),
      onError: () => toast.error(t("portfolioView.removeFromListError")),
    });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    );
  }
  if (isError) return <ErrorState message={t("portfolioView.sharedLoadError")} retryLabel={t("retry")} onRetry={() => refetch()} />;
  if (!data?.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border px-6 py-14 text-center">
        <Share2 className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("portfolioView.sharedEmpty")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className={`hidden ${GRID} pl-4 pr-6 py-3 border-b border-border text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground`}>
        <span>{t("tableCaseHeader")}</span>
        <span>{t("portfolioView.sharedColumnOwner")}</span>
        <span>{t("portfolioView.sharedColumnShared")}</span>
        <span>{t("tableOpenInHeader")}</span>
        <span className="text-right">{t("tableActionHeader")}</span>
      </div>
      {data.map((sharedCase) => {
        const ownerName = ownerNameOf(sharedCase);
        const removing = leave.isPending && leave.variables === sharedCase.id;
        return (
          <div
            key={sharedCase.id}
            className={`flex flex-col gap-3 border-b border-border pl-4 pr-6 py-4 transition-colors ${GRID} md:rounded-lg md:hover:bg-card dark:md:hover:bg-overlay-hover`}
          >
            <button type="button" onClick={() => open(sharedCase, "workspace")} className="min-w-0 flex flex-col gap-1 text-left cursor-pointer">
              <span className="truncate font-['Libre_Caslon_Text'] text-[15px] sm:text-[16px] leading-tight text-foreground">{sharedCase.caseName}</span>
              <span className="text-muted-foreground text-[12px] truncate">
                {sharedCase.parties.length > 0 ? sharedCase.parties.map((p) => p.name).join(" · ") : t("noPartyListed")}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Eye className="h-3 w-3" aria-hidden="true" />
                {t("share.viewOnly")}
              </span>
            </button>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 md:contents">
              <span className="min-w-0 truncate text-[12px] text-muted-foreground md:text-[13px] md:text-foreground">
                <span className="md:hidden">{t("portfolioView.sharedColumnOwner")} </span>
                {ownerName}
              </span>
              <span className="text-[12px] text-muted-foreground md:text-[13px] md:text-foreground">
                {sharedCase.sharedAt ? formatDate(sharedCase.sharedAt) : null}
              </span>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => open(sharedCase, "workspace")}
                      className="flex h-11 md:h-8 items-center px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-foreground/40 transition-colors cursor-pointer"
                    >
                      {t("overview.tabWorkspace")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("portfolioView.openInWorkspace", { caseName: sharedCase.caseName })}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => open(sharedCase, "terminal")}
                      className="flex h-11 md:h-8 items-center px-4 rounded-full border border-border text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground hover:border-brand-gold hover:text-brand-gold transition-colors cursor-pointer"
                    >
                      {t("Terminal")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{t("portfolioView.openInTerminal", { caseName: sharedCase.caseName })}</TooltipContent>
                </Tooltip>
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      disabled={removing}
                      className="flex h-11 w-11 md:h-8 md:w-8 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 data-[state=open]:bg-background data-[state=open]:text-foreground disabled:opacity-50"
                      aria-label={t("rowActions", { caseName: sharedCase.caseName })}
                    >
                      {removing ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <MoreHorizontal className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => removeFromList(sharedCase)} aria-label={t("portfolioView.removeFromListLabel", { caseName: sharedCase.caseName })}>
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                      {t("portfolioView.removeFromList")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
