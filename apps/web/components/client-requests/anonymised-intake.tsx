"use client";

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { AnonymisedIntake } from "@/lib/client-requests/types";

const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** One labelled part of the overview: the label in a rail on the left, its content beside it, so the
 * card reads down as a list of parts rather than as columns competing for width. */
function Part({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-border pt-4 md:grid-cols-[132px_minmax(0,1fr)] md:gap-6">
      <h3 className={cn(LABEL, "pt-0.5")}>{label}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Bullets({ items }: { items: { id: string; text: string }[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-4 text-[14px] leading-relaxed text-foreground">
      {items.map((item) => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  );
}

/**
 * The client's intake, anonymised (ADR 0018 in the API repo): how ready it is, the timeline, their
 * goals and concerns, their questions for you, any deadlines they've mentioned, and what's still
 * missing — all with no names, no document names and no source ids, same guarantee as the AI
 * summary above it. Shown pre-claim, under the AI summary and client's note.
 */
export function AnonymisedIntake({ intake }: { intake: AnonymisedIntake }) {
  const { t } = useTranslation("client-request");
  const nothing =
    intake.timeline.length === 0 &&
    intake.goals.length === 0 &&
    intake.concerns.length === 0 &&
    intake.questionsForLawyer.length === 0 &&
    intake.deadlines.length === 0 &&
    intake.missing.length === 0;

  if (nothing) return null;

  const criteria = intake.completeness?.criteria ?? [];
  const met = criteria.filter((cr) => cr.met).length;
  const complete = criteria.length > 0 && met === criteria.length;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className={LABEL}>{t("detail.intake.title")}</h2>
          {criteria.length > 0 && (
            <span className={cn("text-[13px] font-semibold", complete ? "text-brand-status-green" : "text-brand-gold")}>
              {t("detail.intake.ready", { met, total: criteria.length })}
            </span>
          )}
        </div>

        {criteria.length > 0 && (
          <>
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${criteria.length}, minmax(0, 1fr))` }} aria-hidden="true">
              {criteria.map((cr) => (
                <span key={cr.key} className={cn("h-1.5 rounded-full", cr.met ? (complete ? "bg-brand-status-green" : "bg-brand-gold") : "bg-border")} />
              ))}
            </div>
            <ul className="flex flex-wrap gap-1.5" aria-label={t("detail.intake.completeness")}>
              {criteria.map((cr) => (
                <li
                  key={cr.key}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                    cr.met ? "bg-ok/15 text-ok" : "border border-dashed border-border text-foreground"
                  )}
                >
                  {cr.met && <Check className="size-3" strokeWidth={2.5} aria-hidden="true" />}
                  {cr.label}
                  <span className="sr-only">{cr.met ? " — done" : " — still needed"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {intake.timeline.length > 0 && (
        <Part label={t("detail.intake.timeline")}>
          <ol className="flex flex-col gap-3">
            {intake.timeline.map((ev) => (
              <li key={ev.id} className="grid gap-x-4 gap-y-0.5 text-[14px] leading-relaxed sm:grid-cols-[96px_minmax(0,1fr)]">
                <span className="text-[12.5px] text-muted-foreground sm:pt-px">{ev.date ? fmtDate(ev.date) : ""}</span>
                <span className="text-foreground">{ev.text}</span>
              </li>
            ))}
          </ol>
        </Part>
      )}

      {intake.goals.length > 0 && (
        <Part label={t("detail.intake.goals")}>
          <Bullets items={intake.goals} />
        </Part>
      )}

      {intake.concerns.length > 0 && (
        <Part label={t("detail.intake.concerns")}>
          <Bullets items={intake.concerns} />
        </Part>
      )}

      {intake.questionsForLawyer.length > 0 && (
        <Part label={t("detail.intake.questions")}>
          <ul className="flex flex-col gap-2">
            {intake.questionsForLawyer.map((q) => (
              <li key={q.id} className="rounded-xl border border-dashed border-border px-3.5 py-2.5 text-[14px] leading-relaxed text-foreground">
                {q.text}
              </li>
            ))}
          </ul>
        </Part>
      )}

      {intake.deadlines.length > 0 && (
        <Part label={t("detail.intake.deadlines")}>
          <ul className="flex flex-col gap-2">
            {intake.deadlines.map((d) => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-[14px] leading-relaxed text-foreground">
                {d.date && <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-[12px] font-semibold text-warn">{fmtDate(d.date)}</span>}
                <span className="min-w-0 flex-1">{d.text}</span>
              </li>
            ))}
          </ul>
        </Part>
      )}

      {intake.missing.length > 0 && (
        <Part label={t("detail.intake.missing")}>
          <ul className="flex flex-col gap-1.5 rounded-xl bg-muted/60 px-4 py-3 text-[14px] leading-relaxed text-foreground">
            {intake.missing.map((m) => (
              <li key={m.id} className="flex gap-2">
                <span aria-hidden="true" className="mt-[9px] size-1 shrink-0 rounded-full bg-muted-foreground" />
                {m.question}
              </li>
            ))}
          </ul>
        </Part>
      )}
    </section>
  );
}
