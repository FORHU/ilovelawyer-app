"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Mic, CalendarClock, Grid2x2, Plus, SendHorizontal, Loader2, Link2, X } from "lucide-react";
import { useCaseQuery, useCasesQuery, useUploadCaseDocumentMutation, type CaseRecord } from "@/lib/cases/mutations";
import { useCreateAppointmentMutation } from "@/lib/calendar/mutations";

// Cheap, real (not mocked) relevance signal: how many meaningful words the two
// cases' name/party/notes share. Good enough to rank "worth a look" until this
// is backed by an actual embedding-similarity endpoint.
const STOPWORDS = new Set(["the", "a", "an", "of", "and", "or", "vs", "v", "re", "for", "to", "in", "on"]);
function keywordSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}
function relevance(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / Math.min(a.size, b.size);
}

function caseKeywords(c: CaseRecord): Set<string> {
  return keywordSet(`${c.caseName} ${c.partyInvolved ?? ""} ${c.notes ?? ""}`);
}

export function CaseHubWidget({
  caseId,
  onAskFollowUp,
}: {
  /** Explicit link for this conversation, if any (e.g. arrived via a case's "Start Chat"
   * action). When absent, falls back to the user's most recently updated case — no
   * manual picking required, the hub just shows up after every response. */
  caseId: string | null;
  onAskFollowUp: (text: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const [followUp, setFollowUp] = useState("");

  // Already sorted by updatedAt desc server-side, so [0] is the most recently active case.
  const allCasesQuery = useCasesQuery(1, 100);
  const effectiveCaseId = caseId ?? allCasesQuery.data?.data[0]?.id ?? null;

  const { data: caseRecord } = useCaseQuery(effectiveCaseId ?? "");

  const relatedCases = useMemo(() => {
    if (!caseRecord || !allCasesQuery.data) return [];
    const mine = caseKeywords(caseRecord);
    return allCasesQuery.data.data
      .filter((c) => c.id !== effectiveCaseId)
      .map((c) => ({ case: c, pct: Math.round(relevance(mine, caseKeywords(c)) * 100) }))
      .filter((r) => r.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [caseRecord, allCasesQuery.data, effectiveCaseId]);

  function submitFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text) return;
    onAskFollowUp(text);
    setFollowUp("");
  }

  // No cases exist at all yet — nothing to show a case hub for.
  if (!effectiveCaseId) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">{t("caseHub.noCasesYet")}</p>
        <Link
          href="/homepage/create-case"
          className="shrink-0 rounded-full border border-brand-gold bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-[#221a05] cursor-pointer transition-colors hover:brightness-105"
        >
          {t("caseHub.createCase")}
        </Link>
      </section>
    );
  }

  if (!caseRecord) {
    return (
      <section className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseHub.loadingCase")}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-border">
        <Link
          href={`/homepage/case-portfolio/${effectiveCaseId}`}
          className="flex items-center gap-2 font-['Libre_Caslon_Text'] text-[15px] uppercase tracking-wide text-foreground min-w-0 hover:text-primary transition-colors"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold shadow-[0_0_0_3px_rgba(246,196,69,0.15)]" aria-hidden="true" />
          <span className="truncate">{caseRecord.caseName}</span>
        </Link>
        {caseRecord.caseNumber && (
          <span className="shrink-0 text-[11px] text-muted-foreground">
            {t("caseHub.caseNumberPrefix")} {caseRecord.caseNumber}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[13px] font-semibold text-foreground">
        <Grid2x2 className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
        {t("caseHub.relatedCases")}
        {relatedCases.length > 0 && <span className="text-muted-foreground font-normal">· {relatedCases.length}</span>}
      </div>

      <div className="max-h-[280px] overflow-y-auto px-4 py-3">
        <HubRelatedCases entries={relatedCases} emptyLabel={t("caseHub.relatedEmpty")} jurisprudenceLabel={t("caseHub.yourCases")} />
      </div>

      <div className="border-t border-border px-4 py-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("caseHub.quickActionsLabel")}>
          <AddDocumentButton caseId={effectiveCaseId} />
          <ScheduleButton caseId={effectiveCaseId} />
          <Link
            href={`/homepage/transcription?caseId=${effectiveCaseId}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer transition-colors hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            <Mic className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {t("caseHub.addTranscription")}
          </Link>
        </div>
        <form onSubmit={submitFollowUp} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
          <input
            type="text"
            value={followUp}
            onChange={(e) => setFollowUp(e.target.value)}
            placeholder={t("caseHub.followUpPlaceholder")}
            aria-label={t("caseHub.followUpPlaceholder")}
            className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            aria-label={t("caseHub.send")}
            disabled={!followUp.trim()}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-[#221a05] cursor-pointer hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>
    </section>
  );
}

/** Direct file-picker trigger — skips the Document Analysis page and uploads straight to this case. */
function AddDocumentButton({ caseId }: { caseId: string }) {
  const { t } = useTranslation("homepage");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadDocument, isPending } = useUploadCaseDocumentMutation();

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-[#221a05] cursor-pointer transition-colors hover:brightness-105 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
      >
        {isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
        {isPending ? t("caseHub.uploading") : t("caseHub.addDocument")}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) uploadDocument({ file, caseId });
        }}
      />
    </>
  );
}

/** Compact popover scheduler — schedules straight from the hub instead of leaving for the full calendar page. */
function ScheduleButton({ caseId }: { caseId: string }) {
  const { t } = useTranslation("homepage");
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const { mutate: createAppointment, isPending } = useCreateAppointmentMutation();

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date || !time) return;
    createAppointment(
      { title: title.trim(), date, startTime: time, caseId },
      {
        onSuccess: () => {
          setIsOpen(false);
          setTitle("");
          setDate("");
          setTime("");
        },
      },
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer transition-colors hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
      >
        <CalendarClock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        {t("caseHub.updateSchedule")}
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground">{t("caseHub.quickSchedule")}</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label={t("caseHub.closeScheduler")}
              className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={submit} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("caseHub.scheduleTitleLabel")}</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("caseHub.scheduleTitlePlaceholder")}
                required
                className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-gold/50"
              />
            </label>
            <div className="flex gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("caseHub.scheduleDateLabel")}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-gold/50"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{t("caseHub.scheduleTimeLabel")}</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none focus:border-brand-gold/50"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-[#221a05] cursor-pointer hover:brightness-105 disabled:opacity-60 disabled:cursor-wait"
            >
              {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {isPending ? t("caseHub.scheduling") : t("caseHub.scheduleSubmit")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function HubRelatedCases({
  entries,
  emptyLabel,
  jurisprudenceLabel,
}: {
  entries: { case: CaseRecord; pct: number }[];
  emptyLabel: string;
  jurisprudenceLabel: string;
}) {
  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  const circumference = 2 * Math.PI * 18;

  return (
    <div className="flex flex-col gap-2">
      {entries.map(({ case: c, pct }) => {
        const offset = circumference * (1 - pct / 100);
        return (
          <Link
            key={c.id}
            href={`/homepage/case-portfolio/${c.id}`}
            className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left cursor-pointer transition-colors hover:bg-muted/60 hover:border-brand-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40"
          >
            <div className="relative h-[42px] w-[42px] shrink-0">
              <svg width="42" height="42" viewBox="0 0 42 42" className="-rotate-90">
                <circle cx="21" cy="21" r="18" fill="none" strokeWidth="3.5" className="stroke-border" />
                <circle
                  cx="21"
                  cy="21"
                  r="18"
                  fill="none"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  className="stroke-brand-gold transition-[stroke-dashoffset] duration-500"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums text-foreground">{pct}%</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-foreground">{c.caseName}</div>
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{c.partyInvolved || "—"}</div>
              <span className="mt-1 inline-block rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                {jurisprudenceLabel}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
