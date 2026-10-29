"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { AddCardModal } from "@/components/client-requests/add-card-modal";
import { ConfirmAcceptModal } from "@/components/client-requests/confirm-accept-modal";
import { RequestCard } from "@/components/client-requests/request-card";
import { ErrorState } from "@/components/error-state";
import { Pagination } from "@/components/ui/pagination";
import { CONTENT_WIDTH_LG } from "@/lib/layout-constants";
import {
  isCardRequiredError,
  useClaimClientRequestMutation,
  useClientRequestCountQuery,
  useClientRequestInboxQuery,
  usePassClientRequestMutation,
  type ClientRequestInboxView,
} from "@/lib/client-requests/inbox";
import { useClientRequestProfileQuery, useUpdateClientRequestProfileMutation } from "@/lib/client-requests/profile";
import { sortRequests, type InboxSort } from "@/lib/client-requests/request-meta";
import { useCardSetupReturn } from "@/lib/organizations/use-card-setup-return";
import { PLANS_PATH, toastRequestError } from "@/lib/client-requests/plan-errors";
import { useAuthStore } from "@/lib/store/auth.store";
import { EmptyState } from "@workspace/ui/components/empty-state";
import { PageHeading } from "@workspace/ui/components/page-heading";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";

const LIMIT = 10;
const VIEWS: ClientRequestInboxView[] = ["inbox", "mine", "history"];

const TAB_TRIGGER = (active: boolean) =>
  `h-9 rounded-full border px-4 text-[11px] font-semibold tracking-[1px] uppercase transition-colors ${
    active ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:border-foreground/40"
  }`;

function RequestListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-2xl border border-border p-5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-3/5" />
        </div>
      ))}
    </div>
  );
}

export default function ClientRequestsPage() {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  const organization = useAuthStore((s) => s.organization);

  const [view, setView] = useState<ClientRequestInboxView>("inbox");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<InboxSort>("closing");
  const inboxCount = useClientRequestCountQuery("inbox");
  const mineCount = useClientRequestCountQuery("mine");
  const counts: Partial<Record<ClientRequestInboxView, number>> = { inbox: inboxCount, mine: mineCount };
  const requestsQuery = useClientRequestInboxQuery(view, page, LIMIT);
  const showSkeleton = useDelayedLoading(requestsQuery.isLoading);

  const profileQuery = useClientRequestProfileQuery(true);
  const updateProfile = useUpdateClientRequestProfileMutation();

  const claim = useClaimClientRequestMutation();
  const pass = usePassClientRequestMutation();
  const [cardModalFor, setCardModalFor] = useState<string | null>(null);
  /** The request whose Accept is waiting on the confirmation dialog. */
  const [confirmAcceptFor, setConfirmAcceptFor] = useState<string | null>(null);

  // A refusal from the lawyer's plan (trial over, month's client requests taken) offers the Plans page.
  const showError = (err: unknown) => toastRequestError(err, { fallback: t("loadError"), choosePlan: t("choosePlan"), onChoosePlan: () => router.push(PLANS_PATH) });

  // After AddCardModal redirects to Stripe and back, retry the claim it interrupted.
  useCardSetupReturn(organization?.id, (status, params) => {
    const resumeId = params.get("resumeRequestId");
    if (status === "done" && resumeId) claim.mutate(resumeId, { onError: showError });
  });

  function switchView(next: ClientRequestInboxView) {
    setView(next);
    setPage(1);
  }

  function onPass(id: string) {
    pass.mutate(id);
  }

  function onAccept(id: string) {
    setConfirmAcceptFor(id);
  }

  function confirmAccept(id: string) {
    claim.mutate(id, {
      onSuccess: (updated) => {
        setConfirmAcceptFor(null);
        router.push(`/homepage/client-requests/${updated.id}`);
      },
      onError: (err) => {
        setConfirmAcceptFor(null);
        if (isCardRequiredError(err)) setCardModalFor(id);
        else showError(err);
      },
    });
  }

  const total = requestsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  // The sort only reorders the page in hand, so it is offered only when the inbox is one page.
  const canSort = view === "inbox" && totalPages === 1;
  const requests = canSort ? sortRequests(requestsQuery.data?.data ?? [], sort) : (requestsQuery.data?.data ?? []);
  const isEmpty = !requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0;

  const accepting = profileQuery.data?.acceptingRequests ?? false;
  const capacity = profileQuery.data?.capacityLimit;
  const slotsUsed = profileQuery.data?.openEngagements ?? 0;
  const acceptingPill = useMemo(
    () => (
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground">
          <span className={`size-1.5 rounded-full ${accepting ? "bg-emerald-500" : "bg-muted-foreground"}`} aria-hidden="true" />
          {accepting ? (capacity ? t("accepting.onSlots", { used: slotsUsed, limit: capacity }) : t("accepting.on")) : t("accepting.paused")}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              disabled={updateProfile.isPending || !profileQuery.data}
              onClick={() =>
                updateProfile.mutate(
                  { acceptingRequests: !accepting },
                  { onError: (err) => toast.error(err instanceof Error ? err.message : t("loadError")) }
                )
              }
              className="cursor-pointer text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground underline underline-offset-4 disabled:opacity-50"
            >
              {accepting ? t("accepting.pause") : t("accepting.resume")}
            </button>
          </TooltipTrigger>
          <TooltipContent>{accepting ? t("accepting.pauseTooltip") : t("accepting.resumeTooltip")}</TooltipContent>
        </Tooltip>
      </div>
    ),
    [accepting, capacity, slotsUsed, profileQuery.data, t, updateProfile]
  );

  return (
    <PageShell>
      <main className={`mx-auto w-full ${CONTENT_WIDTH_LG} flex-1 px-6 pb-16 pt-24 md:px-16`}>
        <PageHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} action={acceptingPill} />

        <div className="mt-6 flex gap-2">
          {VIEWS.map((v) => (
            <button key={v} type="button" className={TAB_TRIGGER(view === v)} onClick={() => switchView(v)}>
              {counts[v] ? t("tabs.count", { label: t(`tabs.${v}`), count: counts[v] }) : t(`tabs.${v}`)}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {requestsQuery.isError ? (
            <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => requestsQuery.refetch()} />
          ) : showSkeleton ? (
            <RequestListSkeleton />
          ) : isEmpty ? (
            <EmptyState
              className="py-24"
              icon={<Users />}
              title={t(`empty.${view}.title`)}
              description={t(`empty.${view}.description`)}
              action={
                view === "inbox" ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        href="/homepage/profile"
                        className="text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground underline underline-offset-4"
                      >
                        {t("empty.editPracticeAreas")}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>{t("empty.editPracticeAreas")}</TooltipContent>
                  </Tooltip>
                ) : undefined
              }
            />
          ) : (
            <>
              {view === "inbox" && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                  <h2 className="text-[15px] font-semibold text-foreground">
                    {t("openRequests.title")} <span className="ml-1.5 text-[13px] font-normal text-muted-foreground">{t("openRequests.hint")}</span>
                  </h2>
                  {canSort && (
                    <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      {t("openRequests.sort")}
                      <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as InboxSort)}
                        className="h-9 cursor-pointer rounded-full border border-border bg-background px-3 text-[13px] text-foreground"
                      >
                        <option value="closing">{t("openRequests.closing")}</option>
                        <option value="newest">{t("openRequests.newest")}</option>
                      </select>
                    </label>
                  )}
                </div>
              )}
              <div className="flex flex-col gap-3">
                {requests.map((request) =>
                  view === "inbox" ? (
                    // Pass/Accept are the row's only actions in the inbox — there's nothing more
                    // to see on the detail page before a claim than the card already shows.
                    <RequestCard
                      key={request.id}
                      request={request}
                      onPass={onPass}
                      onAccept={onAccept}
                      passPending={pass.isPending && pass.variables === request.id}
                      acceptPending={claim.isPending && claim.variables === request.id}
                    />
                  ) : (
                    <Link key={request.id} href={`/homepage/client-requests/${request.id}`} className="no-underline">
                      <RequestCard request={request} />
                    </Link>
                  )
                )}
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} labels={{ previous: t("pagination.previous"), next: t("pagination.next") }} className="mt-6" />
              {view === "inbox" && <p className="mt-5 text-xs text-muted-foreground">{t("feeNote")}</p>}
            </>
          )}
        </div>
      </main>

      <ConfirmAcceptModal
        open={!!confirmAcceptFor}
        isPending={claim.isPending}
        onConfirm={() => confirmAcceptFor && confirmAccept(confirmAcceptFor)}
        onClose={() => setConfirmAcceptFor(null)}
      />

      <AddCardModal
        open={!!cardModalFor}
        onClose={() => setCardModalFor(null)}
        extraReturnParams={cardModalFor ? { resumeRequestId: cardModalFor } : undefined}
      />
    </PageShell>
  );
}
