"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import { ArrowLeft, FileAudio, Copy, Check, ChevronDown, Trash2, Loader2, AlertCircle } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import CustomSelect from "@/components/ui/custom-select";
import {
  useTranscriptionsQuery,
  useDeleteTranscriptionMutation,
  useLinkTranscriptionMutation,
  type Transcription,
} from "@/lib/transcription/mutations";
import { useCasesQuery, type CaseRecord } from "@/lib/cases/mutations";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`;
}

function LibraryRow({ item, cases }: { item: Transcription; cases: CaseRecord[] }) {
  const { t } = useTranslation("transcription");
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState(item.caseId ?? "");
  const deleteTranscription = useDeleteTranscriptionMutation();
  const linkTranscription = useLinkTranscriptionMutation();

  const caseOptions = [
    { value: "", label: t("library.noCaseOption") },
    ...cases.map((c) => ({ value: c.id, label: c.caseName })),
  ];
  const linkedCaseName = cases.find((c) => c.id === item.caseId)?.caseName;
  const hasChanges = selectedCaseId !== (item.caseId ?? "");

  const handleSaveCase = () => {
    linkTranscription.mutate({ id: item.id, caseId: selectedCaseId || null });
  };

  const handleCopy = async () => {
    if (!item.transcript) return;
    await navigator.clipboard.writeText(item.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:border-foreground/30 hover:bg-muted">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary">
            <FileAudio className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-foreground">{item.title || t("library.untitled")}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {formatDuration(item.duration)} • {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          type="button"
          title={t("delete")}
          aria-label={t("deleteRecord", { name: item.title || t("library.untitled") })}
          onClick={() => deleteTranscription.mutate(item.id)}
          disabled={deleteTranscription.isPending}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/15 dark:hover:text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 disabled:opacity-50"
        >
          {deleteTranscription.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <CustomSelect
          value={selectedCaseId}
          onChange={setSelectedCaseId}
          options={caseOptions}
          placeholder={t("library.noCaseOption")}
          className="w-full sm:w-56"
        />
        {hasChanges ? (
          <button
            type="button"
            onClick={handleSaveCase}
            disabled={linkTranscription.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {linkTranscription.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {linkTranscription.isPending ? t("library.saving") : t("library.save")}
          </button>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {linkedCaseName ? t("library.linkedToCase", { caseName: linkedCaseName }) : t("library.notLinked")}
          </p>
        )}
        {linkTranscription.isError && (
          <p className="flex items-center gap-1.5 text-[11px] text-red-600 dark:text-red-400">
            <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
            {t("library.saveFailed")}
          </p>
        )}
      </div>

      {item.transcript ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="inline-flex w-fit cursor-pointer items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-foreground hover:text-amber-700 dark:hover:text-amber-400"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          {t("queue.viewTranscript")}
        </button>
      ) : (
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{t(`queue.status.${item.status?.toLowerCase() ?? "local"}`, item.status ?? "")}</p>
      )}

      {expanded && item.transcript && (
        <div className="rounded-md border border-border bg-muted p-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
            >
              {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copied ? t("queue.copied") : t("queue.copyTranscript")}
            </button>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-foreground">
            {item.transcript}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function TranscriptionLibraryPage() {
  const { t } = useTranslation("transcription");
  const { data, isLoading, isError } = useTranscriptionsQuery();
  const casesQuery = useCasesQuery(1, 100);
  const cases = casesQuery.data?.data ?? [];

  return (
    <div className="relative w-full min-h-screen bg-background text-foreground font-['Inter',sans-serif]">
      <GlobalHeader activeTab="transcription" />

      <main className="max-w-[1000px] mx-auto px-6 sm:px-10 md:px-12 py-12 md:py-16 flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/homepage/transcription"
            className="inline-flex w-fit items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            {t("hero.titlePrefix")} {t("hero.titleEmphasis")}
          </Link>
          <h1 className="font-['Libre_Caslon_Text',serif] text-[28px] md:text-[36px] leading-tight text-foreground">
            {t("queue.viewFullLibrary")}
          </h1>
        </div>

        <div className="flex flex-col gap-3">
          {isLoading && (
            <div className="flex items-center gap-2 py-16 justify-center text-muted-foreground text-[13px]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {t("library.loading")}
            </div>
          )}

          {isError && (
            <div className="py-16 text-center text-[13px] text-red-600 dark:text-red-400">{t("library.loadError")}</div>
          )}

          {!isLoading && !isError && (data?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center justify-center text-center py-16">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                <FileAudio className="h-6 w-6" aria-hidden="true" />
              </div>
              <h4 className="font-['Libre_Caslon_Text',serif] text-[18px] text-foreground mb-2">{t("queue.noActiveTranscripts")}</h4>
            </div>
          )}

          {data?.map((item) => <LibraryRow key={item.id} item={item} cases={cases} />)}
        </div>
      </main>

    </div>
  );
}
