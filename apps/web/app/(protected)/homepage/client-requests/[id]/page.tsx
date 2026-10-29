"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, Lock, ShieldCheck, Undo2, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { AddCardModal } from "@/components/client-requests/add-card-modal";
import { AnonymisedIntake } from "@/components/client-requests/anonymised-intake";
import { ClientFile } from "@/components/client-requests/client-file";
import { EngagementAiMeter } from "@/components/client-requests/engagement-ai-budget";
import { EngagementMessages } from "@/components/client-requests/engagement-messages";
import { RequestStepper } from "@/components/client-requests/request-stepper";
import { RequestTags } from "@/components/client-requests/request-tags";
import { ErrorState } from "@/components/error-state";
import { CONTENT_WIDTH_LG } from "@/lib/layout-constants";
import { RELEASE_REASONS, type ReleaseReason, type QuoteType } from "@/lib/client-handoff";
import { useClaimClientRequestMutation, usePassClientRequestMutation, isCardRequiredError } from "@/lib/client-requests/inbox";
import {
  useClientRequestQuery,
  useCloseClientRequestMutation,
  useConflictPartiesQuery,
  useCopyClientRequestCaseMutation,
  useQuoteClientRequestMutation,
  useReleaseClientRequestMutation,
  useRetryClientRequestChargeMutation,
} from "@/lib/client-requests/detail";
import type { ClientRequestForLawyer } from "@/lib/client-requests/types";
import { formatCountdown, useCountdown } from "@/lib/client-requests/use-countdown";
import { formatMoney } from "@/lib/money";
import { useClientRequestProfileQuery } from "@/lib/client-requests/profile";
import { useEnterSharedWorkspace } from "@/lib/organizations/mutations";
import { useCardSetupReturn } from "@/lib/organizations/use-card-setup-return";
import { PLANS_PATH, toastRequestError } from "@/lib/client-requests/plan-errors";
import { useAuthStore } from "@/lib/store/auth.store";
import { useOrganizationCardQuery } from "@/lib/organizations/billing";
import { Button } from "@workspace/ui/components/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@workspace/ui/components/dialog";
import { EmptyState } from "@workspace/ui/components/empty-state";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";
import { useDelayedLoading } from "@workspace/ui/hooks/use-delayed-loading";
import { cn } from "@workspace/ui/lib/utils";

const CARD = "rounded-2xl border border-border bg-card p-5";
const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground";
const QUOTE_FORM_ID = "client-request-quote-form";
/** The open step of the conflict check (its Show the parties button, then its checkbox): where focus goes when a quote is tried too early. */
const CONFLICT_CLEAR_ID = "client-request-conflict-step";
const TWO_HOURS_MS = 2 * 3_600_000;

/** Counts down a claim's 24h hold; turns amber in the last two hours. */
function HeldTimer({ until }: { until: number }) {
  const { t } = useTranslation("client-request");
  const remaining = useCountdown(until);
  const urgent = remaining < TWO_HOURS_MS;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase tabular-nums",
        urgent ? "border-red-500/40 bg-red-500/10 text-red-600" : "border-border text-foreground"
      )}
    >
      {t("detail.heldForYou", { time: formatCountdown(remaining) })}
    </span>
  );
}

function ReleaseDialog({ open, onClose, onConfirm, pending }: { open: boolean; onClose: () => void; onConfirm: (reason: ReleaseReason, note: string) => void; pending: boolean }) {
  const { t } = useTranslation("client-request");
  const [reason, setReason] = useState<ReleaseReason>("CONFLICT");
  const [note, setNote] = useState("");
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("detail.conflict.release")}</DialogTitle>
          <DialogDescription>{t("detail.conflict.confirmRelease")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div role="radiogroup" className="flex flex-wrap gap-1.5">
            {RELEASE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[1px]",
                  reason === r ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"
                )}
              >
                {t(`detail.conflict.reasons.${r}`)}
              </button>
            ))}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder={t("detail.conflict.title")}
            className="w-full resize-none rounded-xl border border-border bg-background px-3.5 py-2.5 text-[13px] outline-none focus:border-foreground"
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {t("detail.back")}
          </Button>
          <Button type="button" variant="accent" isPending={pending} onClick={() => onConfirm(reason, note.trim())}>
            {t("detail.conflict.release")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The conflict check, as one step with a visible state: to do, then (once the parties are shown and
 * the lawyer says they're clear) cleared. `cleared` lives on the page because the quote waits on it;
 * a quote that has already been sent (`needsClearance` false) has nothing left to clear.
 */
function ConflictCheck({ id, cleared, onClearedChange, needsClearance }: { id: string; cleared: boolean; onClearedChange: (cleared: boolean) => void; needsClearance: boolean }) {
  const { t } = useTranslation("client-request");
  const [shown, setShown] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const parties = useConflictPartiesQuery(id, shown);
  const release = useReleaseClientRequestMutation(id);
  const done = needsClearance && cleared;

  return (
    <section className={cn(CARD, "flex flex-col gap-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-semibold text-foreground">{t("detail.conflict.title")}</h2>
        {needsClearance && (
          <span
            role="status"
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              done ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
            )}
          >
            {done && <Check className="size-3" strokeWidth={3} aria-hidden="true" />}
            {done ? t("detail.conflict.statusCleared") : t("detail.conflict.statusTodo")}
          </span>
        )}
      </div>

      {!shown ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] leading-relaxed text-muted-foreground">{t("detail.conflict.intro")}</p>
          <Button id={CONFLICT_CLEAR_ID} type="button" variant="default" onClick={() => setShown(true)} className="h-11 w-full gap-2 text-[13px] font-semibold">
            <Eye className="size-4" aria-hidden="true" />
            {t("detail.conflict.load")}
          </Button>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
            {t("detail.conflict.loadTooltip")}
          </p>
        </div>
      ) : parties.isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : parties.isError ? (
        <ErrorState message={t("loadError")} retryLabel={t("retry")} onRetry={() => parties.refetch()} />
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-background">
            {parties.data?.parties.map((p, i) => (
              <div key={i} className="flex flex-col gap-0.5 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className={LABEL}>{p.role}</dt>
                <dd className="text-sm font-semibold text-foreground sm:text-right">{p.name}</dd>
              </div>
            ))}
          </dl>
          {needsClearance && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border bg-background px-3.5 py-3 text-[13px] leading-snug text-foreground has-[:checked]:border-ok/50 has-[:checked]:bg-ok/5">
              <input
                id={CONFLICT_CLEAR_ID}
                type="checkbox"
                checked={cleared}
                onChange={(e) => onClearedChange(e.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--brand-gold)]"
              />
              {t("detail.conflict.clearedLabel")}
            </label>
          )}
        </div>
      )}

      <div className="flex flex-col items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/5 px-3.5 py-3">
        <p className="text-[13px] text-foreground">{t("detail.conflict.releaseHint")}</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              onClick={() => setReleasing(true)}
              className="h-9 gap-1.5 border-red-500/40 bg-background px-3.5 text-[13px] font-semibold text-red-600 hover:border-red-500/70 hover:bg-red-500/10 hover:text-red-700"
            >
              <Undo2 className="size-3.5" aria-hidden="true" />
              {t("detail.conflict.releaseShort")}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("detail.conflict.releaseTooltip")}</TooltipContent>
        </Tooltip>
      </div>
      <ReleaseDialog
        open={releasing}
        onClose={() => setReleasing(false)}
        pending={release.isPending}
        onConfirm={(reason, note) =>
          release.mutate(
            { reason, note: note || undefined },
            { onSuccess: () => toast.success(t("detail.conflict.released")), onError: (err) => toast.error(err instanceof Error ? err.message : t("loadError")) }
          )
        }
      />
    </section>
  );
}

function QuoteForm({ request, conflictChecked }: { request: ClientRequestForLawyer; conflictChecked: boolean }) {
  const { t } = useTranslation("client-request");
  const id = request.id;
  const quote = useQuoteClientRequestMutation(id);
  // Sending needs a card on file for the introduction fee confirming will charge (ilovelawyer-app#933).
  // Asked for up front, before the lawyer writes the quote: the trip to Stripe would lose it.
  const organizationId = useAuthStore((s) => s.organization?.id);
  const card = useOrganizationCardQuery(organizationId);
  const noCard = card.isSuccess && !card.data;
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [type, setType] = useState<QuoteType>("FIXED_FEE");
  // Starts at the lawyer's own first-consultation fee from their Lawyer Application, until they type;
  // empty when they haven't set one, so the price is always theirs.
  const profile = useClientRequestProfileQuery(true);
  const [typedAmount, setTypedAmount] = useState<string | null>(null);
  const fee = profile.data?.firstConsultationFee;
  const amount = typedAmount ?? (fee?.currency === "GBP" ? (fee.amountMinor / 100).toFixed(2) : "");
  const [message, setMessage] = useState("");
  const [amountError, setAmountError] = useState(false);

  const [conflictBlocked, setConflictBlocked] = useState(false);
  const previewAmount = Number(amount);
  const hasPreviewAmount = Number.isFinite(previewAmount) && previewAmount > 0;
  const introFee = formatMoney(request.perCaseFee.amountMinor);
  const cardLast4 = card.data?.last4;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!conflictChecked) {
      // Enter in a field reaches here even though the button is disabled: say why, and go to the step that is open.
      setConflictBlocked(true);
      document.getElementById(CONFLICT_CLEAR_ID)?.focus();
      return;
    }
    const value = Number(amount);
    // Every quote type needs a real amount: what the preview shows is what the client is sent.
    if (!Number.isFinite(value) || value <= 0) return setAmountError(true);
    const amountMinor = Math.round(value * 100);
    quote.mutate(
      { type, amount: { amountMinor, currency: "GBP" }, message: message.trim() },
      {
        onSuccess: () => toast.success(t("detail.quote.sent")),
        onError: (err) => {
          // The card was removed since the page loaded: show the prompt again.
          if (isCardRequiredError(err)) void card.refetch();
          toast.error(err instanceof Error ? err.message : t("loadError"));
        },
      }
    );
  }

  return (
    <section className={cn(CARD, "flex flex-col gap-4")}>
      <h2 className="text-[15px] font-semibold text-foreground">{t("detail.quote.title")}</h2>
      <form id={QUOTE_FORM_ID} onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <div role="radiogroup" className="flex gap-1 rounded-full bg-muted p-1">
          {(["FIXED_FEE", "FIRST_CONSULTATION"] as const).map((option) => (
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
              {option === "FIXED_FEE" ? t("detail.quote.fixed") : t("detail.quote.consultation")}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-amount" className={LABEL}>
            {t("detail.quote.amount")}
          </label>
          <div className={cn("flex items-center gap-2 rounded-full border bg-background px-4 focus-within:border-foreground", amountError ? "border-red-500" : "border-border")}>
            <span className="text-sm text-muted-foreground" aria-hidden="true">
              £
            </span>
            <input
              id="quote-amount"
              inputMode="decimal"
              value={amount}
              placeholder="0.00"
              aria-invalid={amountError}
              onChange={(e) => {
                setTypedAmount(e.target.value.replace(/[^\d.]/g, ""));
                setAmountError(false);
              }}
              className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            />
            <span className={LABEL}>{t("detail.quote.incVat")}</span>
          </div>
          {amountError && <p className="text-xs text-red-600">{t("detail.quote.amountInvalid")}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="quote-message" className={LABEL}>
            {t("detail.quote.message")}
          </label>
          <textarea
            id="quote-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-foreground"
          />
          <p className="text-xs text-muted-foreground">{t("detail.quote.messageHint")}</p>
        </div>

        {/* What the client will be shown, as it will read to them. */}
        <div className="flex flex-col gap-1.5 rounded-2xl border border-dashed border-border px-4 py-3.5" aria-live="polite">
          <span className={LABEL}>{t("detail.quote.willSee")}</span>
          <span className="text-[13px] text-muted-foreground">{type === "FIXED_FEE" ? t("detail.quote.fixedQuote") : t("detail.quote.consultationQuote")}</span>
          <span className="font-display text-[30px] font-light leading-none tracking-[-0.02em] text-foreground">{hasPreviewAmount ? formatMoney(Math.round(previewAmount * 100)) : t("detail.quote.amountPlaceholder")}</span>
          <span className="text-xs text-muted-foreground">{t("detail.quote.willSeeNote")}</span>
        </div>

        <div className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-background px-4 py-3 text-[13px] text-foreground">
          <span>{t("detail.quote.introFee")}</span>
          <span className="text-right font-semibold">{cardLast4 ? t("detail.quote.introFeeCard", { fee: introFee, last4: cardLast4 }) : t("detail.quote.introFeeOnly", { fee: introFee })}</span>
        </div>
      </form>
      {noCard && (
        <div role="status" className="flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <p className="text-[13px] text-foreground">{t("detail.quote.cardRequired")}</p>
          <Button type="button" variant="outline" className="self-start" onClick={() => setCardModalOpen(true)}>
            {t("detail.quote.addCard")}
          </Button>
        </div>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Wrapped so the tooltip still shows on a disabled button. */}
          <span className="block">
            <Button type="submit" form={QUOTE_FORM_ID} variant="accent" isPending={quote.isPending} disabled={noCard || !conflictChecked} className="h-12 w-full">
              {t("detail.quote.send")}
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{!conflictChecked ? t("detail.quote.doConflictFirst") : noCard ? t("detail.quote.cardRequiredTooltip") : t("detail.quote.sendTooltip")}</TooltipContent>
      </Tooltip>
      {!conflictChecked &&
        (conflictBlocked ? (
          <p role="alert" className="-mt-2 text-xs font-medium text-red-600">
            {t("detail.quote.conflictRequired")}
          </p>
        ) : (
          <p className="-mt-2 text-xs text-muted-foreground">{t("detail.quote.doConflictFirst")}</p>
        ))}
      <AddCardModal open={cardModalOpen} onClose={() => setCardModalOpen(false)} />
    </section>
  );
}

function OpenRequestActions({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  const claim = useClaimClientRequestMutation();
  const pass = usePassClientRequestMutation();
  const [cardModalOpen, setCardModalOpen] = useState(false);

  return (
    <div className="flex gap-2.5">
      <Button type="button" variant="outline" className="flex-1" isPending={pass.isPending} onClick={() => pass.mutate(request.id, { onSuccess: () => router.push("/homepage/client-requests") })}>
        {t("card.pass")}
      </Button>
      <Button
        type="button"
        variant="accent"
        className="flex-1"
        isPending={claim.isPending}
        onClick={() =>
          claim.mutate(request.id, {
            onError: (err) =>
              isCardRequiredError(err)
                ? setCardModalOpen(true)
                : toastRequestError(err, { fallback: t("loadError"), choosePlan: t("choosePlan"), onChoosePlan: () => router.push(PLANS_PATH) }),
          })
        }
      >
        {t("card.accept")}
      </Button>
      <AddCardModal open={cardModalOpen} onClose={() => setCardModalOpen(false)} extraReturnParams={{ resumeRequestId: request.id }} />
    </div>
  );
}

function QuotedCard({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  if (!request.quote) return null;
  return (
    <section className={CARD}>
      <div className={LABEL}>{t("detail.quote.sentTitle")}</div>
      <div className="mt-2 font-display text-[20px]">{formatMoney(request.quote.amount.amountMinor)}</div>
      {request.quote.message && <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{request.quote.message}</p>}
      <p className="mt-3 text-[13px] text-muted-foreground">{t("detail.quote.sentDescription")}</p>
    </section>
  );
}

function ConfirmedCard({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  const retry = useRetryClientRequestChargeMutation(request.id);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const failed = request.charge?.status === "FAILED";
  return (
    <section className={CARD}>
      <div className={LABEL}>{t("detail.confirmed.title")}</div>
      <p className="mt-2 text-[13px] text-muted-foreground">{failed ? request.charge?.failureReason ?? t("detail.confirmed.failed") : t("detail.confirmed.description")}</p>
      {failed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="accent" isPending={retry.isPending} onClick={() => retry.mutate(undefined, { onError: (err) => toast.error(err instanceof Error ? err.message : t("loadError")) })}>
            {t("detail.confirmed.retry")}
          </Button>
          {/* No card, or a declined one: add or change it here, and the charge is retried on the way back. */}
          <Button type="button" variant="outline" onClick={() => setCardModalOpen(true)}>
            {t("detail.confirmed.addCard")}
          </Button>
        </div>
      )}
      <AddCardModal open={cardModalOpen} onClose={() => setCardModalOpen(false)} extraReturnParams={{ retryCharge: "1" }} />
    </section>
  );
}

function EngagedCard({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  const copy = useCopyClientRequestCaseMutation(request.id);
  const close = useCloseClientRequestMutation(request.id);
  const enterSharedWorkspace = useEnterSharedWorkspace();
  const [closing, setClosing] = useState(false);
  if (!request.engagement) return null;
  const engagement = request.engagement;

  // The case is the client's, in their workspace: open it there read-only, the way a case shared to
  // view opens (SharedCasesList), not in the lawyer's own workspace, where it isn't.
  const openCase = () => {
    enterSharedWorkspace({ id: engagement.workspaceId, ownerName: engagement.clientName });
    router.push(`/homepage/case-portfolio/${engagement.caseId}`);
  };

  return (
    <section className={cn(CARD, "flex flex-col gap-4")}>
      <div>
        <div className={LABEL}>{t("detail.engaged.client")}</div>
        <div className="mt-1 text-[15px] font-semibold text-foreground">{request.engagement.clientName}</div>
      </div>
      <EngagementAiMeter requestId={request.id} />
      <div className="flex flex-wrap gap-2">
        <EngagementMessages requestId={request.id} clientName={request.engagement.clientName} closed={false} />
        <Button type="button" variant="outline" onClick={openCase}>
          {t("detail.engaged.openCase")}
        </Button>
        {!request.engagement.copyCaseId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                isPending={copy.isPending}
                onClick={() =>
                  copy.mutate(undefined, {
                    // The copy is a case of their own: the plan's case limit (or an ended trial) can refuse it.
                    onError: (err) => toastRequestError(err, { fallback: t("loadError"), choosePlan: t("choosePlan"), onChoosePlan: () => router.push(PLANS_PATH) }),
                  })
                }
              >
                {copy.isPending ? t("detail.engaged.copying") : t("detail.engaged.copy")}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("detail.engaged.copy")}</TooltipContent>
          </Tooltip>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="self-start border-red-500/30 text-[11px] font-semibold tracking-[1.2px] uppercase text-red-600 hover:border-red-500/60 hover:bg-red-500/5"
            onClick={() => setClosing(true)}
          >
            {t("detail.engaged.close")}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("detail.engaged.closeTooltip")}</TooltipContent>
      </Tooltip>
      <Dialog open={closing} onOpenChange={(next) => !next && setClosing(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("detail.engaged.close")}</DialogTitle>
            <DialogDescription>{t("detail.engaged.confirmClose")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClosing(false)} disabled={close.isPending}>
              {t("detail.back")}
            </Button>
            <Button
              type="button"
              variant="accent"
              isPending={close.isPending}
              onClick={() =>
                close.mutate(
                  {},
                  {
                    onSuccess: () => setClosing(false),
                    onError: (err) => toast.error(err instanceof Error ? err.message : t("loadError")),
                  }
                )
              }
            >
              {t("detail.engaged.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ClosedCard({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  return (
    <section className={cn(CARD, "flex flex-col items-start gap-3")}>
      <div className="text-[13px] text-muted-foreground">{request.engagement?.closedBy === "CLIENT" ? t("detail.closed.byClient") : t("detail.closed.byLawyer")}</div>
      {/* The thread stays readable after close (ilovelawyer-api#517). */}
      {request.engagement && <EngagementMessages requestId={request.id} clientName={request.engagement.clientName} closed />}
    </section>
  );
}

function RequestDetail({ request }: { request: ClientRequestForLawyer }) {
  const { t } = useTranslation("client-request");
  const held = request.claim?.byMe ?? false;
  // The lawyer clearing the conflict check (parties shown, no conflict) is what the quote waits for.
  const [conflictCleared, setConflictCleared] = useState(false);
  const beforeEngagement = held && (request.status === "CLAIMED" || request.status === "QUOTED" || request.status === "CONFIRMED");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 flex-col gap-3">
          <h1 className="font-display text-[26px] font-light leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[clamp(30px,3.2vw,40px)]">{t(`detail.status.${request.status}`)}</h1>
          <RequestTags brief={request.brief} />
        </div>
        {request.status === "CLAIMED" && request.claim?.claimExpiresAt && <HeldTimer until={new Date(request.claim.claimExpiresAt).getTime()} />}
      </div>

      <div className="mt-6">
        <RequestStepper request={request} />
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <section className={cn(CARD, "bg-muted/40")}>
            <p className="mb-3 flex items-center gap-2">
              <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-semibold tracking-[1px] text-background">{t("detail.ai")}</span>
              <span className={LABEL}>{t("detail.aiSummary")}</span>
            </p>
            <p className="text-[15px] leading-relaxed text-foreground">{request.brief.summary}</p>
          </section>

          {request.brief.intake && <AnonymisedIntake intake={request.brief.intake} />}

          {request.brief.clientNote && (
            <section className={cn(CARD, "bg-muted/40")}>
              <h2 className={cn(LABEL, "mb-2")}>{t("detail.clientNote")}</h2>
              <p className="text-[14px] leading-relaxed text-foreground">{request.brief.clientNote}</p>
            </section>
          )}

          {(!held || beforeEngagement) && (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Lock className="size-3.5" aria-hidden="true" />
              </span>
              <p className="text-[13px] text-muted-foreground">{held ? t("detail.lockedFile") : t("detail.lockedParties")}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {!held && (request.status === "ROUTED" || request.status === "REQUESTED") && <OpenRequestActions request={request} />}
          {held && request.status === "CLAIMED" && (
            <>
              <ConflictCheck id={request.id} cleared={conflictCleared} onClearedChange={setConflictCleared} needsClearance={request.status === "CLAIMED"} />
              <QuoteForm request={request} conflictChecked={conflictCleared} />
            </>
          )}
          {held && request.status === "QUOTED" && (
            <>
              <QuotedCard request={request} />
              <ConflictCheck id={request.id} cleared={conflictCleared} onClearedChange={setConflictCleared} needsClearance={false} />
            </>
          )}
          {held && request.status === "CONFIRMED" && <ConfirmedCard request={request} />}
          {held && request.status === "ENGAGED" && <EngagedCard request={request} />}
          {held && request.status === "CLOSED" && <ClosedCard request={request} />}
        </div>
      </div>

      {held && request.status === "ENGAGED" && <ClientFile requestId={request.id} />}
    </>
  );
}

export default function ClientRequestDetailPage() {
  const { t } = useTranslation("client-request");
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: request, isLoading, isError, refetch } = useClientRequestQuery(id);
  const showSkeleton = useDelayedLoading(isLoading);
  const organizationId = useAuthStore((s) => s.organization?.id);
  const claim = useClaimClientRequestMutation();
  const retry = useRetryClientRequestChargeMutation(id);

  // Back from adding a card (AddCardModal, through Stripe): carry on with what it was added for,
  // accepting this request or retrying its per-case fee.
  useCardSetupReturn(organizationId, (status, params) => {
    // Drop our own params too, so the address is just the request again.
    router.replace(`/homepage/client-requests/${id}`);
    if (status !== "done") return;
    const onError = (err: unknown) => toastRequestError(err, { fallback: t("loadError"), choosePlan: t("choosePlan"), onChoosePlan: () => router.push(PLANS_PATH) });
    if (params.get("resumeRequestId")) claim.mutate(id, { onError });
    else if (params.get("retryCharge")) retry.mutate(undefined, { onError });
  });

  return (
    <PageShell>
      <main className={`mx-auto w-full ${CONTENT_WIDTH_LG} flex-1 px-6 pb-16 pt-24 md:px-16`}>
        <Link href="/homepage/client-requests" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground hover:text-foreground">
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
        ) : !request ? (
          <EmptyState icon={<Users />} title={t("detail.notFound")} description={t("detail.notFoundDescription")} />
        ) : (
          <RequestDetail request={request} />
        )}
      </main>
    </PageShell>
  );
}
