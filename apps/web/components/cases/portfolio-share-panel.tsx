"use client";
import { useState } from "react";
import { Loader2, Search, UserMinus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { UserAvatar } from "@/components/user-avatar";
import { dateLocale } from "@/lib/i18n/date-locale";
import {
  useGrantCaseAccessMutation,
  useRevokeCaseAccessMutation,
  useShareLookupMutation,
  type CaseAccessList,
} from "@/lib/cases/sharing";

export function initialsOf(person: { name: string | null; username: string }) {
  const base = person.name?.trim() || person.username;
  const [first, second] = base.split(/[.\s_-]+/).filter(Boolean);
  if (!first) return "?";
  return (second ? `${first[0]}${second[0]}` : first.slice(0, 2)).toUpperCase();
}

const AVATAR_CLASS = "h-8 w-8 border border-border bg-muted text-[11px] font-semibold text-muted-foreground";

/** The share dialog's body for a case in the user's own portfolio. Unlike an organization case,
 * it goes to individual registered users the owner picks, found by their exact email, and only to
 * read: there's no access level to choose. A copy of an organization's case can't be shared. */
export function PortfolioSharePanel({ caseId, data }: { caseId: string; data: CaseAccessList }) {
  const { t } = useTranslation("case-portfolio");
  const [email, setEmail] = useState("");
  const lookup = useShareLookupMutation();
  const grant = useGrantCaseAccessMutation();
  const revoke = useRevokeCaseAccessMutation();
  const busyUserId = revoke.isPending ? revoke.variables?.userId : undefined;

  if (!data.shareable) {
    return <p className="text-sm text-muted-foreground leading-relaxed">{t("share.portfolioCopy")}</p>;
  }

  const found = lookup.data;
  const alreadyShared = !!found && data.people.some((person) => person.userId === found.id);
  const lookupStatus = (lookup.error as (Error & { status?: number; code?: string }) | null) ?? null;
  const lookupMessage = !lookupStatus
    ? null
    : lookupStatus.code === "SHARE_SELF"
      ? t("share.lookupSelf")
      : lookupStatus.status === 404
        ? t("share.lookupNotFound")
        : t("share.lookupError");

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    grant.reset();
    lookup.mutate({ caseId, email: trimmed });
  };

  const share = () => {
    if (!found) return;
    grant.mutate(
      { caseId, userId: found.id, permission: "VIEW" },
      {
        onSuccess: () => {
          lookup.reset();
          setEmail("");
        },
      },
    );
  };

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: "numeric", month: "short", year: "numeric" }) : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground leading-relaxed">{t("share.portfolioDescription")}</p>

      <form onSubmit={find} className="flex flex-col gap-1.5">
        <label htmlFor="share-email" className="text-[12px] font-medium text-foreground">
          {t("share.emailLabel")}
        </label>
        <div className="flex gap-2">
          <input
            id="share-email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (lookup.data || lookup.error) lookup.reset();
            }}
            placeholder={t("share.emailPlaceholder")}
            className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-base sm:text-sm text-foreground outline-none focus:border-foreground/40 focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={!email.trim() || lookup.isPending}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:cursor-default disabled:opacity-50"
          >
            {lookup.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}
            {t("share.find")}
          </button>
        </div>
        {lookupMessage && (
          <p role="alert" className="text-[12px] text-danger">
            {lookupMessage}
          </p>
        )}
      </form>

      {found && (
        <div className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5" data-testid="share-found">
          <UserAvatar avatarUrl={found.avatarUrl} initials={initialsOf(found)} className={AVATAR_CLASS} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm text-foreground">{found.name?.trim() || found.username}</span>
            <span className="truncate text-[12px] text-muted-foreground">{found.email}</span>
          </div>
          {alreadyShared ? (
            <span className="text-[13px] text-muted-foreground">{t("share.viewOnly")}</span>
          ) : (
            <button
              type="button"
              onClick={share}
              disabled={grant.isPending}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-brand-gold px-3.5 text-[11px] font-semibold uppercase tracking-[1px] text-brand-gold-foreground hover:opacity-85 transition-opacity cursor-pointer disabled:opacity-50"
            >
              {grant.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {t("share.shareToView")}
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground">{t("share.sharedWithLabel")}</span>
        {data.people.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">{t("share.nobodyYet")}</p>
        ) : (
          <ul className="-mx-2 flex max-h-[40vh] flex-col overflow-y-auto" aria-label={t("share.sharedWithLabel")}>
            {data.people.map((person) => {
              const name = person.name?.trim() || person.username;
              const isBusy = busyUserId === person.userId;
              const sharedOn = formatDate(person.sharedAt);
              return (
                <li key={person.userId} className="flex items-center gap-3 rounded-lg px-2 py-2.5" data-testid={`share-row-${person.userId}`}>
                  <UserAvatar avatarUrl={person.avatarUrl} initials={initialsOf(person)} className={AVATAR_CLASS} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{name}</span>
                    <span className="truncate text-[12px] text-muted-foreground">{person.email}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] text-foreground">{t("share.viewOnly")}</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => revoke.mutate({ caseId, userId: person.userId })}
                            aria-label={t("share.stopSharing", { name })}
                            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer disabled:opacity-40"
                          >
                            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <UserMinus className="h-3.5 w-3.5" aria-hidden="true" />}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t("share.stopSharing", { name })}</TooltipContent>
                      </Tooltip>
                    </div>
                    {sharedOn && (
                      <span className="text-[10px] font-semibold tracking-[1px] uppercase text-muted-foreground">{t("share.sharedOn", { date: sharedOn })}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {(grant.isError || revoke.isError) && (
        <p role="alert" className="text-[12px] text-danger">
          {t("share.saveError")}
        </p>
      )}
    </div>
  );
}
