"use client";
import { Loader2, UserMinus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@workspace/ui/components/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { useAuthStore } from "@/lib/store/auth.store";
import {
  LEVEL_TO_PERMISSION,
  accessOf,
  useCaseAccessQuery,
  useGrantCaseAccessMutation,
  useRevokeCaseAccessMutation,
  type AccessLevel,
  type CaseAccessPerson,
} from "@/lib/cases/sharing";

const SOURCE_ORDER = { "org-admin": 0, grant: 1, organization: 2 } as const;

function initialsOf(person: CaseAccessPerson) {
  const base = person.name?.trim() || person.username;
  const [first, second] = base.split(/[.\s_-]+/).filter(Boolean);
  if (!first) return "?";
  return (second ? `${first[0]}${second[0]}` : first.slice(0, 2)).toUpperCase();
}

/** Who can reach a case and how (#347). Everyone in the organization can view it; this is where
 * someone who can manage the case's access (org OWNER/ADMIN, or an ADMIN grant on the case) gives
 * a member edit or manage access, or takes it back. Each row says whether the access comes from
 * the organization or from a grant here, since only a grant can be taken back. */
export function ShareCaseDialog({ caseId, caseName, onClose }: { caseId: string; caseName: string; onClose: () => void }) {
  const { t } = useTranslation("case-portfolio");
  const currentUserId = useAuthStore((s) => s.user?.id);
  const { data, isLoading, isError } = useCaseAccessQuery(caseId);
  const grant = useGrantCaseAccessMutation();
  const revoke = useRevokeCaseAccessMutation();
  const busyUserId = grant.isPending ? grant.variables?.userId : revoke.isPending ? revoke.variables?.userId : undefined;
  const failed = grant.isError || revoke.isError;

  const people = [...(data?.people ?? [])].sort((a, b) => {
    const bySource = SOURCE_ORDER[accessOf(a).source] - SOURCE_ORDER[accessOf(b).source];
    return bySource || (a.name ?? a.username).localeCompare(b.name ?? b.username);
  });

  const changeLevel = (person: CaseAccessPerson, level: AccessLevel) => {
    grant.reset();
    revoke.reset();
    if (level === "view") {
      // Everyone in the organization can already view — "view" means no grant.
      if (person.grant) revoke.mutate({ caseId, userId: person.userId });
      return;
    }
    grant.mutate({ caseId, userId: person.userId, permission: LEVEL_TO_PERMISSION[level] });
  };

  const levelLabel = (level: AccessLevel) =>
    level === "manage" ? t("share.levelManage") : level === "edit" ? t("share.levelEdit") : t("share.levelView");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-lg gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-border bg-muted/60">
          <DialogTitle asChild>
            <h2 className="min-w-0 truncate font-['Libre_Caslon_Text'] text-lg text-foreground font-normal">
              {t("share.title", { caseName })}
            </h2>
          </DialogTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 -m-1 text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-overlay-hover transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label={t("editModal.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{t("editModal.close")}</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <DialogDescription asChild>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t("share.description")}
              {data && !data.canManage ? ` ${t("share.readOnlyNote")}` : null}
            </p>
          </DialogDescription>

          {isLoading && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}
          {isError && !data && <p role="alert" className="text-sm text-danger">{t("share.loadError")}</p>}

          {data && (
            <ul className="-mx-2 flex max-h-[50vh] flex-col overflow-y-auto" aria-label={t("share.peopleLabel")}>
              {people.map((person) => {
                const access = accessOf(person);
                const name = person.name?.trim() || person.username;
                const isBusy = busyUserId === person.userId;
                const sourceLabel =
                  access.source === "org-admin"
                    ? person.orgRole === "OWNER"
                      ? t("share.sourceOrgOwner")
                      : t("share.sourceOrgAdmin")
                    : !person.orgRole
                      ? t("share.formerMember")
                      : access.granted
                        ? t("share.sourceGrant")
                        : t("share.sourceOrganization");
                return (
                  <li key={person.userId} className="flex items-center gap-3 rounded-lg px-2 py-2.5" data-testid={`share-row-${person.userId}`}>
                    <UserAvatar
                      avatarUrl={person.avatarUrl}
                      initials={initialsOf(person)}
                      className="h-8 w-8 border border-border bg-muted text-[11px] font-semibold text-muted-foreground"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm text-foreground">
                        {name}
                        {person.userId === currentUserId ? <span className="text-muted-foreground"> {t("share.you")}</span> : null}
                      </span>
                      <span className="truncate text-[12px] text-muted-foreground">{person.email}</span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-0.5">
                      {data.canManage && access.source !== "org-admin" && person.orgRole ? (
                        <div className="flex items-center gap-1.5">
                          {isBusy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />}
                          <select
                            value={access.level}
                            disabled={isBusy}
                            onChange={(e) => changeLevel(person, e.target.value as AccessLevel)}
                            aria-label={t("share.levelLabel", { name })}
                            className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground disabled:opacity-50"
                          >
                            <option value="view">{t("share.levelView")}</option>
                            <option value="edit">{t("share.levelEdit")}</option>
                            <option value="manage">{t("share.levelManage")}</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] text-foreground">{levelLabel(access.level)}</span>
                          {data.canManage && !person.orgRole && person.grant && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => changeLevel(person, "view")}
                                  aria-label={t("share.removeLabel", { name })}
                                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer disabled:opacity-40"
                                >
                                  {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>{t("share.removeLabel", { name })}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                      <span className="text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground">{sourceLabel}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {failed && (
            <p role="alert" className="text-[12px] text-danger">
              {t("share.saveError")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
