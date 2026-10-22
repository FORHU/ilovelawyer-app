"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageShell } from "@/components/page-shell";
import { RequestCard } from "@/components/client-requests/request-card";
import { ErrorState } from "@/components/error-state";
import { CONTENT_WIDTH_LG } from "@/lib/layout-constants";
import { URGENCY_RANK, useClientRequestsQuery } from "@/lib/client-requests/queries";
import type { RequestUrgency } from "@/lib/client-requests/mock-types";
import { EmptyState } from "@workspace/ui/components/empty-state";
import { PageHeading } from "@workspace/ui/components/page-heading";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@workspace/ui/components/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";

const ALL = "all";
type SortKey = "newest" | "urgency";

const FILTER_TRIGGER =
  "h-10 w-auto gap-2 rounded-full border-border px-4 text-[10px] font-semibold tracking-[1px] uppercase [&_[data-slot=select-value]]:font-semibold";

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={FILTER_TRIGGER} aria-label={label}>
        <span className="text-muted-foreground">{label} ·</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

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

export default function ClientRequestPage() {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  const requestsQuery = useClientRequestsQuery();
  const showSkeleton = useDelayedLoading(requestsQuery.isLoading);

  const [accepting, setAccepting] = useState(true);
  const [practiceArea, setPracticeArea] = useState(ALL);
  const [jurisdiction, setJurisdiction] = useState(ALL);
  const [urgency, setUrgency] = useState(ALL);
  const [sort, setSort] = useState<SortKey>("newest");
  // Passed requests only disappear from this session's inbox; the API will own that once it exists.
  const [passed, setPassed] = useState<ReadonlySet<string>>(new Set());

  const requests = useMemo(() => (requestsQuery.data ?? []).filter((r) => !passed.has(r.id)), [requestsQuery.data, passed]);

  const practiceAreas = useMemo(() => [...new Set(requests.map((r) => r.practiceArea))].sort(), [requests]);
  const jurisdictions = useMemo(() => [...new Set(requests.map((r) => r.jurisdiction))].sort(), [requests]);

  const visible = useMemo(() => {
    const filtered = requests.filter(
      (r) =>
        (practiceArea === ALL || r.practiceArea === practiceArea) &&
        (jurisdiction === ALL || r.jurisdiction === jurisdiction) &&
        (urgency === ALL || r.urgency === urgency)
    );
    // Requests another lawyer already took always sink to the bottom, whatever the sort.
    return filtered.sort((a, b) => {
      if ((a.status === "taken") !== (b.status === "taken")) return a.status === "taken" ? 1 : -1;
      if (sort === "urgency" && a.urgency !== b.urgency) return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency];
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });
  }, [requests, practiceArea, jurisdiction, urgency, sort]);

  const firstOpenId = visible.find((r) => r.status === "open")?.id;
  const isEmpty = !requestsQuery.isLoading && !requestsQuery.isError && requests.length === 0;

  const acceptingPill = (
    <div className="flex items-center gap-3">
      <span className="flex items-center gap-2 rounded-full bg-muted px-4 py-2.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground">
        <span
          className={`size-1.5 rounded-full ${accepting ? "bg-brand-status-green" : "bg-muted-foreground"}`}
          aria-hidden="true"
        />
        {accepting ? t("accepting.on") : t("accepting.paused")}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setAccepting((v) => !v)}
            className="cursor-pointer text-[10px] font-semibold tracking-[1.2px] uppercase text-foreground underline underline-offset-4"
          >
            {accepting ? t("accepting.pause") : t("accepting.resume")}
          </button>
        </TooltipTrigger>
        <TooltipContent>{accepting ? t("accepting.pauseTooltip") : t("accepting.resumeTooltip")}</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <PageShell>
      <main className={`mx-auto w-full ${CONTENT_WIDTH_LG} flex-1 px-6 pb-16 pt-24 md:px-16`}>
        <PageHeading eyebrow={t("eyebrow")} title={t("title")} subtitle={t("subtitle")} action={acceptingPill} />

        <div className="mt-8">
          {requestsQuery.isError ? (
            <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => requestsQuery.refetch()} />
          ) : showSkeleton ? (
            <RequestListSkeleton />
          ) : isEmpty ? (
            <EmptyState
              className="py-24"
              icon={<Users />}
              title={t("empty.title")}
              description={t("empty.description")}
              action={
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
              }
            />
          ) : (
            <>
              <div className="mb-5 flex flex-wrap gap-2">
                <FilterSelect
                  label={t("filters.practiceArea")}
                  value={practiceArea}
                  onChange={setPracticeArea}
                  options={[{ value: ALL, label: t("filters.all") }, ...practiceAreas.map((v) => ({ value: v, label: v }))]}
                />
                <FilterSelect
                  label={t("filters.jurisdiction")}
                  value={jurisdiction}
                  onChange={setJurisdiction}
                  options={[{ value: ALL, label: t("filters.all") }, ...jurisdictions.map((v) => ({ value: v, label: v }))]}
                />
                <FilterSelect
                  label={t("filters.urgency")}
                  value={urgency}
                  onChange={setUrgency}
                  options={[
                    { value: ALL, label: t("filters.any") },
                    ...(["high", "medium", "low"] as RequestUrgency[]).map((v) => ({ value: v, label: t(`urgency.${v}`) })),
                  ]}
                />
                <FilterSelect
                  label={t("filters.sort")}
                  value={sort}
                  onChange={(v) => setSort(v as SortKey)}
                  options={[
                    { value: "newest", label: t("filters.newest") },
                    { value: "urgency", label: t("filters.mostUrgent") },
                  ]}
                />
              </div>

              {visible.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">{t("noMatches")}</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {visible.map((request) => (
                    <RequestCard
                      key={request.id}
                      request={request}
                      featured={request.id === firstOpenId}
                      onPass={(id) => setPassed((prev) => new Set(prev).add(id))}
                      onAccept={(id) => router.push(`/homepage/client-request/${id}`)}
                    />
                  ))}
                </div>
              )}

              <p className="mt-5 text-xs text-muted-foreground">{t("feeNote")}</p>
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
}
