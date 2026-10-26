"use client";

import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { FileText, ListChecks, MessageSquare } from "lucide-react";
import { cn } from "@workspace/ui/lib/utils";
import { EmptyState } from "@workspace/ui/components/empty-state";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { useIntakePackageQuery } from "@/lib/client-requests/detail";
import type { CaseIntake, IntakePackageDocument, IntakePackageMessage, IntakeSource } from "@/lib/client-requests/types";

const CARD = "rounded-2xl border border-border bg-card p-5";
const LABEL = "text-[10px] font-semibold tracking-[1.2px] uppercase text-muted-foreground";

type FileTab = "intake" | "conversation" | "documents";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

/** "Client entered" (the case form), "Client said" (the Interview transcript), or "From
 * {document}, p.N" — so nothing on this page reads as more settled than its source actually is. */
function provenance(sources: IntakeSource[], t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!sources.length) return "";
  const first = sources[0]!;
  const docName = first.documentName ?? t("detail.file.provenance.aDocument");
  const label =
    first.kind === "CASE_DETAILS"
      ? t("detail.file.provenance.caseDetails")
      : first.kind === "CLIENT"
        ? t("detail.file.provenance.client")
        : first.page
          ? t("detail.file.provenance.documentPage", { name: docName, page: first.page })
          : t("detail.file.provenance.document", { name: docName });
  return sources.length > 1 ? `${label} +${sources.length - 1}` : label;
}

/**
 * The engaged lawyer's client file (ADR 0018 in the API repo): the client's organised intake
 * with where each item came from, their Interview transcript, and their documents. Everything
 * here is already visible through the shared case workspace ("Open the case") — this is an
 * organised read of the same material, not a new grant.
 */
export function ClientFile({ requestId }: { requestId: string }) {
  const { t } = useTranslation("client-request");
  const [tab, setTab] = useState<FileTab>("intake");
  const { data, isPending, error } = useIntakePackageQuery(requestId, true);

  const tabs: { key: FileTab; label: string; icon: typeof ListChecks }[] = [
    { key: "intake", label: t("detail.file.tabs.intake"), icon: ListChecks },
    { key: "conversation", label: t("detail.file.tabs.conversation"), icon: MessageSquare },
    { key: "documents", label: t("detail.file.tabs.documents"), icon: FileText },
  ];

  return (
    <section className={cn(CARD, "mt-5 flex flex-col gap-4")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className={LABEL}>{t("detail.file.title")}</h2>
        <div role="tablist" aria-label={t("detail.file.title")} className="flex shrink-0 gap-0.5 rounded-full border border-border p-0.5">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              onClick={() => setTab(tb.key)}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors",
                tab === tb.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <tb.icon className="size-3" aria-hidden="true" />
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {isPending && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-[70%]" />
          <Skeleton className="h-4 w-[50%]" />
          <Skeleton className="h-4 w-[60%]" />
        </div>
      )}
      {error && <p className="text-[13px] text-destructive">{t("detail.file.loadError")}</p>}

      {data && tab === "intake" && <IntakeTab intake={data.intake} />}
      {data && tab === "conversation" && <ConversationTab transcript={data.transcript} />}
      {data && tab === "documents" && <DocumentsTab documents={data.documents} />}
    </section>
  );
}

function IntakeTab({ intake }: { intake: CaseIntake }) {
  const { t } = useTranslation("client-request");
  const nothing =
    !intake.summary &&
    intake.people.length === 0 &&
    intake.timeline.length === 0 &&
    intake.facts.length === 0 &&
    intake.goals.length === 0 &&
    intake.concerns.length === 0 &&
    intake.questionsForLawyer.length === 0 &&
    intake.deadlines.length === 0;

  if (nothing) {
    return <EmptyState icon={<ListChecks />} title={t("detail.file.intake.emptyTitle")} description={t("detail.file.intake.emptyDescription")} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {intake.summary && (
        <div className="flex flex-col gap-1">
          <span className={LABEL}>{t("detail.file.provenance.aiSummary")}</span>
          <p className="text-[14px] leading-relaxed text-foreground">{intake.summary}</p>
        </div>
      )}

      {intake.people.length > 0 && (
        <Group title={t("detail.file.intake.people")}>
          {intake.people.map((p) => (
            <Row key={p.id} text={`${p.name} — ${p.role}`} sources={p.sources} />
          ))}
        </Group>
      )}

      {intake.timeline.length > 0 && (
        <Group title={t("detail.intake.timeline")}>
          {intake.timeline.map((ev) => (
            <Row key={ev.id} text={ev.date ? `${fmtDate(ev.date)} — ${ev.text}` : ev.text} sources={ev.sources} />
          ))}
        </Group>
      )}

      {intake.facts.length > 0 && (
        <Group title={t("detail.file.intake.facts")}>
          {intake.facts.map((f) => (
            <Row key={f.id} text={f.text} sources={f.sources} />
          ))}
        </Group>
      )}

      {(intake.goals.length > 0 || intake.concerns.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {intake.goals.length > 0 && (
            <Group title={t("detail.intake.goals")}>
              {intake.goals.map((g) => (
                <Row key={g.id} text={g.text} sources={g.sources} />
              ))}
            </Group>
          )}
          {intake.concerns.length > 0 && (
            <Group title={t("detail.intake.concerns")}>
              {intake.concerns.map((c) => (
                <Row key={c.id} text={c.text} sources={c.sources} />
              ))}
            </Group>
          )}
        </div>
      )}

      {intake.questionsForLawyer.length > 0 && (
        <Group title={t("detail.intake.questions")}>
          {intake.questionsForLawyer.map((q) => (
            <Row key={q.id} text={q.text} sources={q.sources} dashed />
          ))}
        </Group>
      )}

      {intake.deadlines.length > 0 && (
        <Group title={t("detail.intake.deadlines")}>
          {intake.deadlines.map((d) => (
            <Row key={d.id} text={d.date ? `${fmtDate(d.date)} — ${d.text}` : d.text} sources={d.sources} />
          ))}
        </Group>
      )}

      {intake.missing.length > 0 && (
        <Group title={t("detail.intake.missing")}>
          {intake.missing.map((m) => (
            <li key={m.id} className="text-[13px] leading-relaxed text-muted-foreground">
              {m.question}
            </li>
          ))}
        </Group>
      )}

      {intake.conflicts.length > 0 && (
        <Group title={t("detail.file.intake.conflicts")}>
          {intake.conflicts.map((cf) => (
            <Row key={cf.id} text={cf.description} sources={cf.sources} warn />
          ))}
        </Group>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      {title && <span className={LABEL}>{title}</span>}
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </div>
  );
}

function Row({ text, sources, dashed, warn }: { text: string; sources: IntakeSource[]; dashed?: boolean; warn?: boolean }) {
  const { t } = useTranslation("client-request");
  return (
    <li
      className={cn(
        "flex flex-col gap-0.5 rounded-xl px-3 py-2 text-[13px] leading-relaxed",
        warn ? "border border-amber-400/40 bg-amber-50 text-amber-900" : dashed ? "border border-dashed border-border text-foreground" : "bg-muted/40 text-foreground",
      )}
    >
      <span>{text}</span>
      {sources.length > 0 && <span className="text-[11px] text-muted-foreground">{provenance(sources, t)}</span>}
    </li>
  );
}

function ConversationTab({ transcript }: { transcript: IntakePackageMessage[] }) {
  const { t } = useTranslation("client-request");
  if (transcript.length === 0) {
    return <EmptyState icon={<MessageSquare />} title={t("detail.file.conversation.emptyTitle")} />;
  }
  return (
    <div className="flex max-h-[480px] flex-col gap-3 overflow-y-auto">
      {transcript.map((m) => (
        <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-0.5", m.role === "CLIENT" ? "self-start" : "self-start opacity-80")}>
          <span className="text-[11px] font-medium text-muted-foreground">{m.role === "CLIENT" ? t("detail.file.conversation.client") : t("detail.file.conversation.ai")}</span>
          <p className="rounded-2xl border border-border bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">{m.text}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentsTab({ documents }: { documents: IntakePackageDocument[] }) {
  const { t } = useTranslation("client-request");
  if (documents.length === 0) {
    return <EmptyState icon={<FileText />} title={t("detail.file.documents.emptyTitle")} />;
  }
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-border">
      {documents.map((d) => (
        <li key={d.id} className="flex items-center gap-3 border-b border-border px-3.5 py-3 text-[13px] last:border-b-0">
          <FileText className="size-4 shrink-0 text-brand-gold" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">
            {d.url ? (
              <a href={d.url} target="_blank" rel="noreferrer" className="text-foreground underline decoration-from-font underline-offset-2 hover:text-brand-gold">
                {d.name}
              </a>
            ) : (
              d.name
            )}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {d.status === "READY" ? t("detail.file.documents.ready") : d.status === "FAILED" ? t("detail.file.documents.failed") : t("detail.file.documents.pending")}
          </span>
        </li>
      ))}
    </ul>
  );
}
