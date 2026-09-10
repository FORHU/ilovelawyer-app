"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@workspace/ui/components/tooltip";

interface VoiceDictateProps {
  /** Fired once a recording is stopped (not cancelled) — the finished clip. Transcribing it
   * to text is the caller's job (this component only records — see consultation-chat.tsx's
   * real AWS Transcribe pipeline). */
  onComplete: (blob: Blob, durationSeconds: number) => void;
  /** Lets the parent hide/show the rest of the composer while dictating. */
  onRecordingChange?: (isRecording: boolean) => void;
  /** getUserMedia was denied/unavailable — caller decides how to surface it (e.g. an alert). */
  onError?: (error: unknown) => void;
  disabled?: boolean;
  voiceLabel: string;
  stopLabel: string;
  cancelLabel: string;
}

type Phase = "idle" | "recording" | "stopping";

// 5 organic, independently-weighted bars rather than a uniform equalizer — each reacts to
// the same amplitude envelope at its own strength and own smoothing rate, and idles on its
// own breathing phase, so they never move in lockstep.
const BAR_MULTIPLIERS = [0.65, 0.9, 1.15, 0.8, 1.0];
const BAR_PHASE_OFFSETS = [0, 1.1, 2.3, 3.4, 4.6];
const BAR_SMOOTHING = [0.16, 0.2, 0.24, 0.18, 0.22];
const MIN_SCALE = 0.25;
const IDLE_AMPLITUDE = 0.08;
const ENVELOPE_ATTACK = 0.35;
const ENVELOPE_RELEASE = 0.06;
const RMS_GAIN = 6;
const STOP_SETTLE_MS = 350;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function VoiceDictate({
  onComplete,
  onRecordingChange,
  onError,
  disabled,
  voiceLabel,
  stopLabel,
  cancelLabel,
}: VoiceDictateProps) {
  const [phase, setPhase] = useState<Phase>("idle");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set right before stopping so the shared onstop handler knows to drop the clip.
  const discardRef = useRef(false);

  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const envelopeRef = useRef(0);
  const barLevelsRef = useRef([0, 0, 0, 0, 0]);

  const teardownAudio = () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    analyserRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (stopTimeoutRef.current) clearTimeout(stopTimeoutRef.current);
    stopTimeoutRef.current = null;
    envelopeRef.current = 0;
    barLevelsRef.current = [0, 0, 0, 0, 0];
  };

  // Release the mic if the composer unmounts mid-recording.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      teardownAudio();
    };
  }, []);

  const tick = (time: number) => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(buf);
    let sumSquares = 0;
    for (let i = 0; i < buf.length; i++) sumSquares += buf[i]! * buf[i]!;
    const rms = Math.sqrt(sumSquares / buf.length);
    const normalized = clamp01(rms * RMS_GAIN);
    envelopeRef.current = lerp(
      envelopeRef.current,
      normalized,
      normalized > envelopeRef.current ? ENVELOPE_ATTACK : ENVELOPE_RELEASE,
    );

    const t = time / 1000;
    for (let i = 0; i < 5; i++) {
      const target = envelopeRef.current * BAR_MULTIPLIERS[i]!;
      barLevelsRef.current[i] = lerp(barLevelsRef.current[i]!, target, BAR_SMOOTHING[i]!);
      const breathing = Math.sin(t * 1.6 + BAR_PHASE_OFFSETS[i]!) * IDLE_AMPLITUDE * (1 - envelopeRef.current);
      const displayLevel = clamp01(barLevelsRef.current[i]! + breathing);
      const bar = barRefs.current[i];
      if (bar) {
        bar.style.transform = `scaleY(${MIN_SCALE + displayLevel * (1 - MIN_SCALE)})`;
        bar.style.opacity = String(0.45 + displayLevel * 0.55);
      }
    }

    rafIdRef.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    if (disabled || phase !== "idle") return;
    // Flip immediately so the button reacts before getUserMedia resolves.
    setPhase("recording");
    onRecordingChange?.(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recordingStartRef.current = Date.now();

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      rafIdRef.current = requestAnimationFrame(tick);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        if (!discardRef.current) {
          const durationSeconds = (Date.now() - recordingStartRef.current) / 1000;
          const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
          onComplete(blob, durationSeconds);
        }
        discardRef.current = false;
        mediaRecorderRef.current = null;
        // Let the envelope visibly decay before tearing the row down.
        setPhase("stopping");
        onRecordingChange?.(false);
        stopTimeoutRef.current = setTimeout(() => {
          teardownAudio();
          setPhase("idle");
        }, STOP_SETTLE_MS);
      };

      recorder.start();
    } catch (error) {
      console.error("Microphone access failed:", error);
      teardownAudio();
      setPhase("idle");
      onRecordingChange?.(false);
      onError?.(error);
    }
  };

  const stop = () => {
    discardRef.current = false;
    mediaRecorderRef.current?.stop();
  };

  const cancel = () => {
    discardRef.current = true;
    mediaRecorderRef.current?.stop();
  };

  if (phase === "idle") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => void start()}
            disabled={disabled}
            aria-label={voiceLabel}
            className="h-9 shrink-0 flex items-center gap-2 rounded-full border border-white/25 pl-[10px] pr-3 text-[10px] font-semibold uppercase tracking-[1.2px] text-white transition-colors hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50"
          >
            <Mic className="w-3.5 h-3.5" aria-hidden="true" />
            {voiceLabel}
          </button>
        </TooltipTrigger>
        <TooltipContent>{voiceLabel}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div
      className={`min-w-0 flex-1 flex items-center gap-1.5 transition-all duration-[250ms] ease-out ${
        phase === "stopping" ? "opacity-0 scale-95" : "opacity-100 scale-100"
      }`}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={cancel}
            aria-label={cancelLabel}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full border border-white/25 text-white/70 transition-colors hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{cancelLabel}</TooltipContent>
      </Tooltip>

      <div className="min-w-0 flex-1 flex items-center justify-center gap-2 h-9" role="status" aria-label={voiceLabel}>
        {BAR_MULTIPLIERS.map((_, i) => (
          <span
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className="w-1 h-6 rounded-full bg-white will-change-transform"
            style={{ transform: `scaleY(${MIN_SCALE})`, opacity: 0.45 }}
          />
        ))}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={stop}
            aria-label={stopLabel}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full bg-brand-gold text-background transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold/50 focus-visible:ring-offset-2"
          >
            <Square className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{stopLabel}</TooltipContent>
      </Tooltip>
    </div>
  );
}
