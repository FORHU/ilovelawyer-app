"use client";
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, FileAudio, Trash2, ArrowRight, Radio, Loader2, ChevronDown, Copy, Check, AlertCircle, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import GlobalHeader from "@/components/global-header";
import { SiteFooter } from "@/components/site-footer";
import { useMediaQueueStore, type QueuedTranscript } from "@/lib/store/media-queue.store";
import {
  useUploadAudioMutation,
  useCreateTranscriptionMutation,
  useStartTranscriptionJobMutation,
} from "@/lib/transcription/mutations";
import { useTranscriptionPolling } from "@/lib/transcription/use-transcription-polling";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// Reads a file/blob's audio duration via a throwaway <audio> element.
function readAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(blob);
    audio.src = url;
    audio.addEventListener("loadedmetadata", () => {
      resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
      URL.revokeObjectURL(url);
    });
    audio.addEventListener("error", () => {
      resolve(0);
      URL.revokeObjectURL(url);
    });
  });
}

const STATUS_STYLES: Record<QueuedTranscript["status"], string> = {
  local: "bg-[#e0e3e5] text-[#45464d]",
  uploading: "bg-amber-100 text-amber-700",
  starting: "bg-amber-100 text-amber-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
};

const BUSY_STATUSES: ReadonlySet<QueuedTranscript["status"]> = new Set(["uploading", "starting", "in_progress"]);

// Derives a playable object URL from the stored Blob and revokes it on unmount/change.
function TranscriptRow({
  transcript,
  onRemove,
  onTranscribe,
}: {
  transcript: QueuedTranscript;
  onRemove: (id: string) => void;
  onTranscribe: (transcript: QueuedTranscript) => void;
}) {
  const { t } = useTranslation("transcription");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(transcript.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [transcript.blob]);

  const isBusy = BUSY_STATUSES.has(transcript.status);

  const handleCopy = async () => {
    if (!transcript.transcript) return;
    await navigator.clipboard.writeText(transcript.transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="group flex flex-col gap-3 rounded-lg border border-[#e0e3e5] p-4 transition-colors hover:border-[#c6c6ce] hover:bg-[#f7fafc]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
            <FileAudio className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-[#181c1e]">{transcript.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#45464d]">{transcript.meta}</p>
              <span
                className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${STATUS_STYLES[transcript.status]}`}
              >
                {isBusy && <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />}
                {transcript.status === "failed" && <AlertCircle className="h-2.5 w-2.5" aria-hidden="true" />}
                {t(`queue.status.${transcript.status}`)}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          title={t("queue.removeFromQueue")}
          aria-label={t("queue.removeFromQueue")}
          onClick={() => onRemove(transcript.id)}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {audioUrl && <audio controls src={audioUrl} className="h-8 w-full" />}

      {transcript.status === "failed" && transcript.errorMessage && (
        <p className="text-[11px] text-red-600">{transcript.errorMessage}</p>
      )}

      <div className="flex items-center gap-2">
        {(transcript.status === "local" || transcript.status === "failed") && (
          <button
            type="button"
            onClick={() => onTranscribe(transcript)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#131a33] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-[#1c2547]"
          >
            {transcript.status === "failed" ? (
              <>
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                {t("queue.retry")}
              </>
            ) : (
              t("queue.transcribe")
            )}
          </button>
        )}

        {transcript.status === "completed" && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#131a33] hover:text-amber-700"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            {t("queue.viewTranscript")}
          </button>
        )}
      </div>

      {expanded && transcript.status === "completed" && (
        <div className="rounded-md border border-[#e0e3e5] bg-[#f7fafc] p-3">
          <div className="mb-2 flex justify-end">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[#45464d] hover:text-[#131a33]"
            >
              {copied ? <Check className="h-3 w-3" aria-hidden="true" /> : <Copy className="h-3 w-3" aria-hidden="true" />}
              {copied ? t("queue.copied") : t("queue.copyTranscript")}
            </button>
          </div>
          <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[#181c1e]">
            {transcript.transcript || t("queue.emptyTranscript")}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function IlovelawyerTranscriptionDashboard() {
  const { t } = useTranslation("transcription");
  const transcripts = useMediaQueueStore((s) => s.transcripts);
  const queueTranscript = useMediaQueueStore((s) => s.queueTranscript);
  const removeTranscript = useMediaQueueStore((s) => s.removeTranscript);
  const updateTranscript = useMediaQueueStore((s) => s.updateTranscript);

  useTranscriptionPolling();
  const uploadAudio = useUploadAudioMutation();
  const createTranscription = useCreateTranscriptionMutation();
  const startTranscriptionJob = useStartTranscriptionJobMutation();

  const handleTranscribe = async (item: QueuedTranscript) => {
    updateTranscript(item.id, { status: "uploading", errorMessage: undefined });
    try {
      const uploaded = await uploadAudio.mutateAsync({ blob: item.blob, filename: item.name });
      updateTranscript(item.id, { status: "starting" });
      const created = await createTranscription.mutateAsync({
        title: item.name,
        audioFileId: uploaded.id,
        duration: item.durationSeconds,
      });
      updateTranscript(item.id, { backendId: created.id });
      await startTranscriptionJob.mutateAsync(created.id);
      updateTranscript(item.id, { status: "in_progress" });
    } catch (error) {
      updateTranscript(item.id, { status: "failed", errorMessage: (error as Error).message });
    }
  };

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
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
        queueTranscript(blob, durationSeconds);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        setElapsedSeconds(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start();
      setIsRecording(true);
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((Date.now() - recordingStartRef.current) / 1000);
      }, 1000);
    } catch (error) {
      console.error("Microphone access failed:", error);
      alert(t("microphoneError"));
    }
  };

  const handleRecorderClick = () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      startRecording();
    }
  };

  const queueFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of list) {
        const duration = await readAudioDuration(file);
        queueTranscript(file, duration);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.currentTarget.files) queueFiles(e.currentTarget.files);
    e.currentTarget.value = "";
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) queueFiles(e.dataTransfer.files);
  };

  return (
    <div className="relative w-full min-h-screen bg-[#f7fafc] text-black font-['Inter',sans-serif]">
      <GlobalHeader activeTab="transcription" />

      <main className="max-w-[1440px] mx-auto px-6 md:px-16 py-14 md:py-16 grid grid-cols-12 gap-8">
        {/* Banner Section Info */}
        <div className="col-span-12 flex flex-col gap-3 mb-2">
          <h1 className="font-['Libre_Caslon_Text',serif] text-[28px] md:text-[36px] leading-tight text-[#181c1e]">
            {t("hero.titlePrefix")} <span className="italic">{t("hero.titleEmphasis")}</span>
          </h1>
          <p className="text-[#45464d] text-[14px] md:text-[15px] max-w-[560px] leading-relaxed">
            {t("hero.subtitle")}
          </p>
        </div>

        {/* Primary Functional Panel Columns */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-8">
          {/* Card: Launch live recorder controller */}
          <div className="bg-[#131a33] rounded-xl text-white p-8 md:p-10 relative overflow-hidden flex flex-col justify-between min-h-75">
            <div className="flex flex-col gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  isRecording ? "bg-red-500/20 text-red-400" : "bg-[#ffe088]/15 text-[#ffe088]"
                }`}
              >
                <Mic className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[26px]">{t("recorder.startNewRecording")}</h2>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                onClick={handleRecorderClick}
                aria-pressed={isRecording}
                className={`inline-flex cursor-pointer items-center gap-2 self-start rounded-lg px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131a33] ${
                  isRecording
                    ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                    : "bg-transparent border-white text-white hover:bg-white/10"
                }`}
              >
                {isRecording ? <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                {isRecording ? t("recorder.stopRecorder") : t("recorder.launchRecorder")}
              </button>

              {isRecording && (
                <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-red-400">
                  <Radio className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
                  {formatClock(elapsedSeconds)}
                </span>
              )}
            </div>
          </div>

          {/* Card: System File Uploader Integration */}
          <div
            onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
            onDrop={handleDrop}
            className={`bg-white/85 backdrop-blur-[6px] border shadow-sm rounded-xl p-6 md:p-8 flex justify-between items-center gap-4 flex-wrap transition-colors ${
              dragActive ? "border-amber-500 bg-amber-50/40" : "border-[#e2e8f0]"
            }`}
          >
            <div className="flex gap-4 items-start">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#545F72]">
                <Upload className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="font-['Libre_Caslon_Text',serif] text-[18px] md:text-[20px] text-[#181c1e]">{t("uploader.title")}</h3>
                <p className="text-[#45464d] text-[13px] md:text-[14px]">{t("uploader.hint")}</p>
              </div>
            </div>
            <label
              tabIndex={isUploading ? undefined : 0}
              role="button"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className="cursor-pointer rounded-lg bg-black px-6 py-3 text-[12px] font-semibold uppercase tracking-[1.2px] text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isUploading ? t("uploader.uploading") : t("uploader.selectFiles")}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Sidebar Status Realtime Queue Display */}
        <div className="col-span-12 lg:col-span-5 bg-white/85 backdrop-blur-[6px] border border-[#c6c6ce] rounded-xl p-8 md:p-9 flex flex-col justify-between min-h-[500px]">
          <div className="flex flex-col min-h-0">
            <div className="flex justify-between items-center border-b border-[#c6c6ce] pb-4 mb-6">
              <span className="text-[12px] font-semibold tracking-[1.2px] text-black uppercase">{t("queue.activityQueue")}</span>
              <span className="bg-[#e0e3e5] text-[#45464d] text-[10px] font-bold px-2 py-1 tracking-wider rounded uppercase">
                {transcripts.length > 0 ? t("queue.items", { count: transcripts.length }) : t("queue.live")}
              </span>
            </div>

            {transcripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-[#f1f4f6] rounded-full flex items-center justify-center mb-4 text-[#8a93a8]">
                  <FileAudio className="h-6 w-6" aria-hidden="true" />
                </div>
                <h4 className="font-['Libre_Caslon_Text',serif] text-[18px] text-[#181c1e] mb-2">{t("queue.noActiveTranscripts")}</h4>
                <p className="text-[#45464d] text-[13px] max-w-[280px]">
                  {t("queue.noActiveTranscriptsHint")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                {transcripts.map((item) => (
                  <TranscriptRow key={item.id} transcript={item} onRemove={removeTranscript} onTranscribe={handleTranscribe} />
                ))}
              </div>
            )}
          </div>

          <Link
            href="/homepage/transcription/library"
            className="border-t border-[#c6c6ce] pt-6 mt-6 flex justify-between items-center font-semibold uppercase text-[12px] text-[#181c1e] tracking-[1.2px] hover:text-amber-700 transition-colors"
          >
            <span>{t("queue.viewFullLibrary")}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
