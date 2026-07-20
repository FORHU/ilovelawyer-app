"use client";
import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, Upload, FileAudio, Trash2, ArrowRight, Radio } from "lucide-react";
import GlobalHeader from "@/components/global-header";
import { useMediaQueueStore, type QueuedTranscript } from "@/lib/store/media-queue.store";

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

// Derives a playable object URL from the stored Blob and revokes it on unmount/change.
function TranscriptRow({ transcript, onRemove }: { transcript: QueuedTranscript; onRemove: (id: string) => void }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(transcript.blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [transcript.blob]);

  return (
    <div className="group flex flex-col gap-3 rounded-lg border border-[#e0e3e5] p-4 transition-colors hover:border-[#c6c6ce] hover:bg-[#f7fafc]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#131a33]/5 text-[#131a33]">
            <FileAudio className="h-4 w-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[14px] font-medium text-[#181c1e]">{transcript.name}</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#45464d]">{transcript.meta}</p>
          </div>
        </div>
        <button
          type="button"
          title="Remove from queue"
          aria-label="Remove from queue"
          onClick={() => onRemove(transcript.id)}
          className="shrink-0 cursor-pointer rounded-full p-1.5 text-gray-400 opacity-0 transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 group-hover:opacity-100"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {audioUrl && <audio controls src={audioUrl} className="h-8 w-full" />}
    </div>
  );
}

export default function IlovelawyerTranscriptionDashboard() {
  const transcripts = useMediaQueueStore((s) => s.transcripts);
  const queueTranscript = useMediaQueueStore((s) => s.queueTranscript);
  const removeTranscript = useMediaQueueStore((s) => s.removeTranscript);

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
      alert("Microphone access is required to record. Please allow microphone permissions and try again.");
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
            Transcription <span className="italic">Redefined.</span>
          </h1>
          <p className="text-[#45464d] text-[14px] md:text-[15px] max-w-[560px] leading-relaxed">
            Capture hearings, depositions, and client interviews with speaker-aware transcription built for the demands of legal practice.
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
              <h2 className="font-['Libre_Caslon_Text',serif] text-[22px] md:text-[26px]">Start New Recording</h2>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <button
                type="button"
                onClick={handleRecorderClick}
                aria-pressed={isRecording}
                className={`inline-flex cursor-pointer items-center gap-2 self-start rounded-lg px-6 py-3 text-[12px] font-semibold tracking-[1.2px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131a33] ${
                  isRecording
                    ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                    : "bg-transparent border-white text-white hover:bg-white/10"
                }`}
              >
                {isRecording ? <Square className="h-3.5 w-3.5 fill-current" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
                {isRecording ? "STOP RECORDER" : "LAUNCH RECORDER"}
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
                <h3 className="font-['Libre_Caslon_Text',serif] text-[18px] md:text-[20px] text-[#181c1e]">Upload Audio File</h3>
                <p className="text-[#45464d] text-[13px] md:text-[14px]">Drag and drop, or browse. MP3, WAV, or AAC up to 2GB.</p>
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
              {isUploading ? "Uploading…" : "Select Files"}
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
              <span className="text-[12px] font-semibold tracking-[1.2px] text-black">ACTIVITY QUEUE</span>
              <span className="bg-[#e0e3e5] text-[#45464d] text-[10px] font-bold px-2 py-1 tracking-wider rounded">
                {transcripts.length > 0 ? `${transcripts.length} ITEM${transcripts.length > 1 ? "S" : ""}` : "LIVE"}
              </span>
            </div>

            {transcripts.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 bg-[#f1f4f6] rounded-full flex items-center justify-center mb-4 text-[#8a93a8]">
                  <FileAudio className="h-6 w-6" aria-hidden="true" />
                </div>
                <h4 className="font-['Libre_Caslon_Text',serif] text-[18px] text-[#181c1e] mb-2">No Active Transcripts</h4>
                <p className="text-[#45464d] text-[13px] max-w-[280px]">
                  Recordings from the consultation chat and files you upload here will appear for review.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 max-h-[380px] overflow-y-auto pr-1">
                {transcripts.map((t) => (
                  <TranscriptRow key={t.id} transcript={t} onRemove={removeTranscript} />
                ))}
              </div>
            )}
          </div>

          <a
            href="#full-library"
            className="border-t border-[#c6c6ce] pt-6 mt-6 flex justify-between items-center font-semibold text-[12px] text-[#181c1e] tracking-[1.2px] hover:text-amber-700 transition-colors"
          >
            <span>VIEW FULL LIBRARY</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </a>
        </div>
      </main>

      {/* SYSTEMATIC LEGAL FOOTER BLOCK */}
      <footer className="w-full bg-white border-t border-gray-200 py-16 relative z-10">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col lg:flex-row items-start justify-between gap-12">
          <div className="flex flex-col gap-4 max-w-sm">
            <span className="font-['Libre_Caslon_Text'] text-2xl font-normal text-black">
              ilovelawyer
            </span>
            <p className="text-sm text-gray-500 leading-relaxed font-normal">
              Dedicated to providing the legal community with the most advanced digital research tools in the Philippines.
            </p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-1">
              © 2026 ILOVELAWYER PHILIPPINES. ALL RIGHTS RESERVED.
            </p>
          </div>

          <div className="flex gap-x-16 gap-y-8 flex-wrap text-xs font-semibold text-gray-500">
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">RESEARCH</span>
              <a href="#const" className="hover:text-black font-normal">Constitution</a>
              <a href="#civil" className="hover:text-black font-normal">Civil Code</a>
              <a href="#scra" className="hover:text-black font-normal">SCRA Archive</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">LEGAL</span>
              <a href="/homepage/term" className="hover:text-black font-normal">Privacy Policy</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Terms of Use</a>
              <a href="/homepage/term" className="hover:text-black font-normal">Ethics Policy</a>
            </div>
            <div className="flex flex-col gap-3 min-w-[100px]">
              <span className="text-black tracking-wider uppercase text-[11px]">CONNECT</span>
              <a href="#support" className="hover:text-black font-normal">Support Center</a>
              <a href="#media" className="hover:text-black font-normal">Media Inquiries</a>
              <a href="#contact" className="hover:text-black font-normal">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
