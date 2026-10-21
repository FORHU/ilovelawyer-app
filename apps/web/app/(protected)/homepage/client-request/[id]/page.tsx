"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Clock, Lock, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { RequestTags } from "@/components/client-requests/request-tags";
import { ErrorState } from "@/components/error-state";
import { CONTENT_WIDTH_LG } from "@/lib/layout-constants";
import { HOLD_DURATION_MS } from "@/lib/client-requests/mock-data";
import { useClientRequestQuery } from "@/lib/client-requests/queries";
import { formatCountdown, useCountdown } from "@/lib/client-requests/use-countdown";
import type { ClientRequest, QuoteType } from "@/lib/client-requests/mock-types";
import { Button } from "@workspace/ui/components/button";
import { EmptyState } from "@workspace/ui/components/empty-state";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";
import { cn } from "@workspace/ui/lib/utils";

const CARD = "rounded-2xl border border-border bg-card p-5";
const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground";
const QUOTE_FORM_ID = "client-request-quote-form";
const TWO_HOURS_MS = 2 * 3_600_000;

/** Counts down the hold on a claimed request; turns amber in the last two hours. */
function HeldTimer({ until, className }: { until: number; className?: string }) {
  const { t } = useTranslation("client-request");
  const remaining = useCountdown(until);
  const urgent = remaining < TWO_HOURS_MS;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase tabular-nums",
        urgent ? "border-warn/40 bg-warn/10 text-warn" : "border-border text-foreground",
        className
      )}
    >
      <Clock className="size-3" aria-hidden="true" />
      {t("detail.heldForYou", { time: formatCountdown(remaining) })}
    </span>
  );
}

function ConflictCheck({
  request,
  checked,
  onCheckedChange,
  onRelease,
}: {
  request: ClientRequest;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  onRelease: () => void;
}) {
  const { t } = useTranslation("client-request");
  const rows = [
    { label: t("detail.conflict.client"), value: request.detail.clientName },
    { label: t("detail.conflict.opponent"), value: request.detail.opponentName },
  ];
  return (
    <section className={cn(CARD, "flex flex-col gap-3")}>
      <h2 className="text-[15px] font-semibold text-foreground">{t("detail.conflict.title")}</h2>
      <dl className="divide-y divide-border rounded-xl border border-border bg-background">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4 px-3.5 py-2.5">
            <dt className={LABEL}>{row.label}</dt>
            <dd className="text-right text-sm font-semibold text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange(e.target.checked)}
          className="size-4 cursor-pointer accent-foreground"
        />
        {t("detail.conflict.checked")}
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            onClick={onRelease}
            className="h-11 border-danger/30 text-[11px] font-semibold tracking-[1.2px] uppercase text-danger hover:border-danger/60 hover:bg-danger/5 hover:text-danger"
          >
            {t("detail.conflict.release")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("detail.conflict.releaseTooltip")}</TooltipContent>
      </Tooltip>
    </section>
  );
}

function QuoteForm({ conflictChecked, onSent }: { conflictChecked: boolean; onSent: () => void }) {
  const { t } = useTranslation("client-request");
  const [type, setType] = useState<QuoteType>("fixed");
  const [amount, setAmount] = useState("1250.00");
  const [message, setMessage] = useState("");
  const [amountError, setAmountError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conflictChecked) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return setAmountError(true);
    // No API yet: the quote isn't persisted anywhere.
    toast.success(t("detail.quote.sent"));
    onSent();
  }

  const sendDisabled = !conflictChecked;
  const sendButton = (className: string) => (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button swallows hover, so the wrapper carries the tooltip trigger. */}
        <span className={cn("block", className)}>
          <Button type="submit" form={QUOTE_FORM_ID} variant="accent" disabled={sendDisabled} className="h-12 w-full">
            {t("detail.quote.send")}
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{sendDisabled ? t("detail.quote.needsConflictCheck") : t("detail.quote.sendTooltip")}</TooltipContent>
    </Tooltip>
  );

  return (
    <>
      <section className={cn(CARD, "flex flex-col gap-4")}>
        <h2 className="text-[15px] font-semibold text-foreground">{t("detail.quote.title")}</h2>
        <form id={QUOTE_FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div role="radiogroup" className="flex gap-1 rounded-full bg-muted p-1">
            {(["fixed", "consultation"] as const).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={type === option}
                onClick={() => setType(option)}
                className={cn(
                  "flex-1 cursor-pointer rounded-full py-2 text-[10px] font-semibold tracking-[1.2px] uppercase transition-colors",
                  type === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(`detail.quote.${option}`)}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quote-amount" className={LABEL}>{t("detail.quote.amount")}</label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border bg-background px-4 focus-within:border-primary",
                amountError ? "border-danger" : "border-border"
              )}
            >
              <span className="text-sm text-muted-foreground" aria-hidden="true">£</span>
              <input
                id="quote-amount"
                inputMode="decimal"
                value={amount}
                aria-invalid={amountError}
                aria-describedby={amountError ? "quote-amount-error" : undefined}
                onChange={(e) => {
                  setAmount(e.target.value.replace(/[^\d.]/g, ""));
                  setAmountError(false);
                }}
                className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
              <span className={LABEL}>{t("detail.quote.incVat")}</span>
            </div>
            {amountError && (
              <p id="quote-amount-error" role="alert" className="text-xs text-danger">
                {t("detail.quote.amountInvalid")}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="quote-message" className={LABEL}>{t("detail.quote.message")}</label>
            <textarea
              id="quote-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={1000}
              rows={4}
              className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            />
            <p className="text-xs text-muted-foreground">{t("detail.quote.messageHint")}</p>
          </div>
        </form>
        {sendButton("hidden lg:block")}
      </section>

      {/* Mobile: the send button stays pinned to the bottom of the screen, with the fee note under it. */}
      <div className="fixed inset-x-0 bottom-0 z-(--z-sidebar) border-t border-border bg-background px-6 pb-3 pt-3 lg:hidden">
        {sendButton("")}
        <p className="mt-2 text-center text-[11px] text-muted-foreground">{t("detail.quote.feeNote")}</p>
      </div>
    </>
  );
}

function RequestDetail({ request }: { request: ClientRequest }) {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  // The hold starts when the lawyer lands here; the API will supply the real expiry.
  const [heldUntil] = useState(() => Date.now() + HOLD_DURATION_MS);
  const [conflictChecked, setConflictChecked] = useState(false);
  const { detail } = request;

  function handleRelease() {
    if (!window.confirm(t("detail.conflict.confirmRelease"))) return;
    toast(t("detail.conflict.released"));
    router.push("/homepage/client-request");
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-['Libre_Caslon_Text'] text-[26px] sm:text-[clamp(30px,3.2vw,44px)] font-light leading-[1.1] tracking-[-0.02em] text-foreground">
            {request.title}
          </h1>
          <RequestTags request={request} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground px-3.5 py-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-background">
            {t("detail.claimed")}
          </span>
          <HeldTimer until={heldUntil} />
        </div>
      </div>

      <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <section className={cn(CARD, "bg-muted/40")}>
            <p className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-[1px] text-background">
                {t("detail.ai")}
              </span>
              <span className={LABEL}>{t("detail.aiSummary")}</span>
            </p>
            <p className="text-[15px] leading-relaxed text-foreground">{detail.aiSummary}</p>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className={cn(CARD, "bg-muted/40")}>
              <h2 className={cn(LABEL, "mb-3")}>{t("detail.keyFacts")}</h2>
              <ul className="ml-4 list-disc space-y-1.5 text-sm text-foreground marker:text-muted-foreground">
                {detail.keyFacts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </section>
            <section className={cn(CARD, "bg-muted/40")}>
              <h2 className={cn(LABEL, "mb-3")}>{t("detail.timeline")}</h2>
              <ul className="space-y-2">
                {detail.timeline.map((item) => (
                  <li key={item.date} className="flex gap-4 text-sm">
                    <span
                      className={cn(
                        "w-[5.5rem] shrink-0 pt-0.5 text-[10px] font-semibold tracking-[1px] uppercase",
                        item.isDeadline ? "text-danger" : "text-muted-foreground"
                      )}
                    >
                      {item.date}
                    </span>
                    <span className="text-foreground">{item.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Lock className="size-3.5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t("detail.documentsLocked", { count: request.documentCount })}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("detail.documentsLockedDescription", { helpers: request.helperCount })}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <ConflictCheck
            request={request}
            checked={conflictChecked}
            onCheckedChange={setConflictChecked}
            onRelease={handleRelease}
          />
          <QuoteForm conflictChecked={conflictChecked} onSent={() => router.push("/homepage/client-request")} />
        </div>
      </div>
    </>
  );
}

export default function ClientRequestDetailPage() {
  const { t } = useTranslation("client-request");
  const { id } = useParams<{ id: string }>();
  const { request, isLoading, isError, refetch } = useClientRequestQuery(id);
  const showSkeleton = useDelayedLoading(isLoading);

  return (
    <PageShell>
      <main className={`mx-auto w-full ${CONTENT_WIDTH_LG} flex-1 px-6 pb-40 pt-24 md:px-16 lg:pb-16`}>
        <Link
          href="/homepage/client-request"
          className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          {t("detail.back")}
        </Link>

        {isError ? (
          <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => refetch()} />
        ) : isLoading ? (
          showSkeleton ? (
            <div className="flex flex-col gap-4">
              <Skeleton className="h-10 w-2/3" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : null
        ) : !request || request.status === "taken" ? (
          <EmptyState
            icon={<Users />}
            title={t("detail.notFound")}
            description={t("detail.notFoundDescription")}
          />
        ) : (
          <RequestDetail request={request} />
        )}
      </main>
    </PageShell>
  );
}
