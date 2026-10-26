"use client";

import { useTranslation } from "react-i18next";
import { Check, Circle } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import type { AnonymisedIntake } from "@/lib/client-requests/types";

const CARD = "rounded-2xl border border-border bg-card p-5";
const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/**
 * The client's intake, anonymised (ADR 0018 in the API repo): the timeline, their goals and
 * concerns, their questions for you, any deadlines they've mentioned, what's still missing, and
 * Lawyer Readiness — all with no names, no document names and no source ids, same guarantee as
 * the AI summary above it. Shown pre-claim, under the AI summary and client's note.
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

  return (
    <section className={cn(CARD, "flex flex-col gap-4")}>
      <h2 className={LABEL}>{t("detail.intake.title")}</h2>

      {intake.timeline.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("detail.intake.timeline")}</span>
          <ol className="flex flex-col gap-1.5 border-l border-border pl-3">
            {intake.timeline.map((ev) => (
              <li key={ev.id} className="text-[13px] leading-relaxed text-foreground">
                {ev.date && <span className="mr-1.5 text-muted-foreground">{fmtDate(ev.date)}</span>}
                {ev.text}
              </li>
            ))}
          </ol>
        </div>
      )}

      {(intake.goals.length > 0 || intake.concerns.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {intake.goals.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>{t("detail.intake.goals")}</span>
              <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-foreground">
                {intake.goals.map((g) => (
                  <li key={g.id}>{g.text}</li>
                ))}
              </ul>
            </div>
          )}
          {intake.concerns.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>{t("detail.intake.concerns")}</span>
              <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-foreground">
                {intake.concerns.map((c) => (
                  <li key={c.id}>{c.text}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {intake.questionsForLawyer.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("detail.intake.questions")}</span>
          <ul className="flex flex-col gap-1.5">
            {intake.questionsForLawyer.map((q) => (
              <li key={q.id} className="rounded-xl border border-dashed border-border px-3 py-2 text-[13px] leading-relaxed text-foreground">
                {q.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {intake.deadlines.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("detail.intake.deadlines")}</span>
          <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-foreground">
            {intake.deadlines.map((d) => (
              <li key={d.id}>
                {d.date && <span className="mr-1.5 font-medium">{fmtDate(d.date)}</span>}
                {d.text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {intake.missing.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("detail.intake.missing")}</span>
          <ul className="flex flex-col gap-1 text-[13px] leading-relaxed text-muted-foreground">
            {intake.missing.map((m) => (
              <li key={m.id}>{m.question}</li>
            ))}
          </ul>
        </div>
      )}

      {intake.completeness && (
        <div className="flex flex-col gap-1.5">
          <span className={LABEL}>{t("detail.intake.completeness")}</span>
          <ul className="flex flex-col gap-1">
            {intake.completeness.criteria.map((cr) => (
              <li key={cr.key} className={cn("flex items-center gap-2 text-[13px]", cr.met ? "text-muted-foreground" : "text-foreground")}>
                {cr.met ? <Check className="size-3.5 text-green-600" aria-hidden="true" /> : <Circle className="size-2.5 text-muted-foreground" aria-hidden="true" />}
                {cr.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
