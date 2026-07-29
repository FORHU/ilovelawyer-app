"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Mic, Square, CalendarClock, Grid2x2, Plus, SendHorizontal, Loader2, FolderPlus, X, ExternalLink, BadgeCheck } from "lucide-react";
import { useCaseQuery, useUploadCaseDocumentMutation } from "@/lib/cases/mutations";
import { useRelatedCasesQuery, type RelatedCase } from "@/lib/chat/mutations";
import { useCreateAppointmentMutation } from "@/lib/calendar/mutations";
import { useUploadAudioMutation, useCreateTranscriptionMutation, useStartTranscriptionJobMutation } from "@/lib/transcription/mutations";
import { transcriptionKeys } from "@/lib/query-keys";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

export function CaseHubWidget({
  caseId,
  conversationId,
  onAskFollowUp,
}: {
  /** Explicit link for this conversation, if any (e.g. arrived via a case's "Start Chat"
   * action, or tagged on the conversation when the case was created from within it). Null
   * means this conversation has no case of its own — must NOT fall back to some other
   * case (e.g. the most recently updated one), or a case created in one chat would bleed
   * into every other unrelated conversation's hub. */
  caseId: string | null;
  /** Conversation the related-cases panel pulls legal-precedent citations for — those are
   * surfaced by the AI's latest reply in this conversation, not tied to `caseId` at all. */
  conversationId: string | null;
  onAskFollowUp: (text: string) => void;
}) {
  const { t } = useTranslation("homepage");
  const [followUp, setFollowUp] = useState("");

  const { data: caseRecord } = useCaseQuery(caseId ?? "");
  const { data: relatedData, isLoading: isLoadingRelated } = useRelatedCasesQuery(conversationId ?? undefined);
  const relatedCases = relatedData?.relatedCases ?? [];

  function submitFollowUp(e: React.FormEvent) {
    e.preventDefault();
    const text = followUp.trim();
    if (!text) return;
    onAskFollowUp(text);
    setFollowUp("");
  }

  // A case is linked/available but its full record hasn't loaded yet — don't flash the
  // "no case" layout while that's in flight.
  if (caseId && !caseRecord) {
    return (
      <section className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseHub.loadingCase")}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card overflow-hidden">
      {caseRecord && (
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b border-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/homepage/case-portfolio/${caseId}`}
                className="flex items-center gap-2 font-['Libre_Caslon_Text'] text-[15px] uppercase tracking-wide text-foreground min-w-0 hover:text-primary transition-colors"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-gold shadow-[0_0_0_3px_rgba(246,196,69,0.15)]" aria-hidden="true" />
                <span className="truncate">{caseRecord.caseName}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent>Open {caseRecord.caseName}&rsquo;s full record</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex items-center gap-1.5 px-4 pt-3 pb-1 text-[13px] font-semibold text-foreground">
        <Grid2x2 className="h-3.5 w-3.5 text-brand-gold" aria-hidden="true" />
        {t("caseHub.relatedCases")}
        {relatedCases.length > 0 && <span className="text-muted-foreground font-normal">· {relatedCases.length}</span>}
      </div>

      <div className="max-h-[280px] overflow-y-auto px-4 py-3">
        <HubRelatedCases entries={relatedCases} isLoading={isLoadingRelated} emptyLabel={t("caseHub.relatedEmpty")} />
      </div>

      <div className="border-t border-border px-4 py-3 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("caseHub.quickActionsLabel")}>
          <AddDocumentButton caseId={caseId ?? undefined} />
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/homepage/create-case"
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer transition-colors hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
              >
                <FolderPlus className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                {t("caseHub.createCase")}
              </Link>
            </TooltipTrigger>
            <TooltipContent>Start a new case intake form</TooltipContent>
          </Tooltip>
          <ScheduleButton caseId={caseId ?? undefined} />
          <TranscriptionButton caseId={caseId ?? undefined} />
        </div>
        {caseRecord && (
          <form onSubmit={submitFollowUp} className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-1.5">
            <input
              type="text"
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder={t("caseHub.followUpPlaceholder")}
              aria-label={t("caseHub.followUpPlaceholder")}
              className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  aria-label={t("caseHub.send")}
                  disabled={!followUp.trim()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-gold text-[#221a05] cursor-pointer hover:brightness-105 disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
                >
                  <SendHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("caseHub.send")}</TooltipContent>
            </Tooltip>
          </form>
        )}
      </div>
    </section>
  );
}

/** Direct file-picker trigger — skips the Document Analysis page and uploads straight to this case. */
function AddDocumentButton({ caseId }: { caseId?: string }) {
  const { t } = useTranslation("homepage");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutate: uploadDocument, isPending } = useUploadCaseDocumentMutation();

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={isPending}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-[#221a05] cursor-pointer transition-colors hover:brightness-105 disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Plus className="h-3 w-3" aria-hidden="true" />}
            {isPending ? t("caseHub.uploading") : t("caseHub.addDocument")}
          </button>
        </TooltipTrigger>
        <TooltipContent>Upload a document directly to this case</TooltipContent>
      </Tooltip>
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
function ScheduleButton({ caseId }: { caseId?: string }) {
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
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setIsOpen((o) => !o)}
            aria-expanded={isOpen}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1.5 text-[12px] font-semibold text-foreground cursor-pointer transition-colors hover:border-brand-gold/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50"
          >
            <CalendarClock className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
            {t("caseHub.updateSchedule")}
          </button>
        </TooltipTrigger>
        <TooltipContent>Open the quick-scheduler for this case</TooltipContent>
      </Tooltip>

      {isOpen && (
        <div className="absolute bottom-full left-0 z-20 mb-2 w-64 rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[12px] font-semibold text-foreground">{t("caseHub.quickSchedule")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label={t("caseHub.closeScheduler")}
                  className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t("caseHub.closeScheduler")}</TooltipContent>
            </Tooltip>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="submit"
                  disabled={isPending}
                  className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-gold px-3 py-1.5 text-[12px] font-semibold text-[#221a05] cursor-pointer hover:brightness-105 disabled:opacity-60 disabled:cursor-wait"
                >
                  {isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  {isPending ? t("caseHub.scheduling") : t("caseHub.scheduleSubmit")}
                </button>
              </TooltipTrigger>
              <TooltipContent>Save this appointment for the case</TooltipContent>
            </Tooltip>
          </form>
        </div>
      )}
    </div>
  );
}

/** Records straight into a transcription — no trip to the Transcription page. The clip is
 * uploaded, saved, and queued for transcription immediately, tagged with `caseId` so it
 * shows up both in the transcription library and on this case once that view exists. */
function TranscriptionButton({ caseId }: { caseId?: string }) {
  const { t } = useTranslation("homepage");
  const [isRecording, setIsRecording] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef<number>(0);
  const queryClient = useQueryClient();

  const { mutateAsync: uploadAudio } = useUploadAudioMutation();
  const { mutateAsync: createTranscription } = useCreateTranscriptionMutation();
  const { mutateAsync: startTranscriptionJob } = useStartTranscriptionJobMutation();

  // Release the microphone if the widget unmounts mid-recording (e.g. navigating away).
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  async function saveRecording(blob: Blob, durationSeconds: number) {
    setIsSaving(true);
    try {
      const uploaded = await uploadAudio({
        blob,
        filename: `Recording_${new Date().toISOString().replace(/[:.]/g, "-")}.webm`,
      });
      const created = await createTranscription({
        title: `Recording ${new Date().toLocaleString()}`,
        audioFileId: uploaded.id,
        duration: durationSeconds,
        caseId,
      });
      await startTranscriptionJob(created.id);
      queryClient.invalidateQueries({ queryKey: transcriptionKeys.lists() });
    } catch (error) {
      console.error("Failed to save transcription:", error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClick() {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (isSaving) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        void saveRecording(blob, durationSeconds);
      };

      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone access failed:", error);
      alert(t("microphoneError"));
    }
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleClick}
          disabled={isSaving}
          aria-pressed={isRecording}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 ${
            isRecording
              ? "border-red-400/40 bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400 animate-pulse"
              : "border-border bg-muted/60 text-foreground hover:border-brand-gold/40"
          }`}
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden="true" />
          ) : isRecording ? (
            <Square className="h-3 w-3 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
          )}
          {isSaving ? t("caseHub.savingTranscription") : isRecording ? t("caseHub.stopRecording") : t("caseHub.addTranscription")}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {isRecording ? "Stop recording and save the transcription" : "Record and save audio for this case"}
      </TooltipContent>
    </Tooltip>
  );
}

/** Renders legal-precedent citations (source, not the user's own cases) surfaced by the
 * conversation's latest assistant reply. */
function HubRelatedCases({
  entries,
  isLoading,
  emptyLabel,
}: {
  entries: RelatedCase[];
  isLoading: boolean;
  emptyLabel: string;
}) {
  const { t } = useTranslation("homepage");

  if (isLoading) {
    return (
      <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        {t("caseHub.loadingRelated")}
      </p>
    );
  }

  if (entries.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry, i) => {
        const label = entry.title || entry.case_number || t("caseHub.untitledCitation");
        const Wrapper = entry.url ? "a" : "div";
        return (
          <Wrapper
            key={`${entry.case_number ?? entry.title ?? "citation"}-${i}`}
            {...(entry.url ? { href: entry.url, target: "_blank", rel: "noopener noreferrer" } : {})}
            className={`flex w-full flex-col gap-1 rounded-xl border border-border p-3 text-left transition-colors ${
              entry.url ? "cursor-pointer hover:bg-muted/60 hover:border-brand-gold/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/40" : ""
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 text-[13px] font-semibold text-foreground line-clamp-2">{label}</span>
              {entry.url && <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </div>
            {entry.case_number && entry.title && (
              <div className="text-[11px] text-muted-foreground">{entry.case_number}</div>
            )}
            {entry.snippet && <p className="line-clamp-2 text-[12px] text-muted-foreground">{entry.snippet}</p>}
            {entry.vetted && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                <BadgeCheck className="h-3 w-3 text-brand-gold" aria-hidden="true" />
                {t("caseHub.vetted")}
              </span>
            )}
          </Wrapper>
        );
      })}
    </div>
  );
}
