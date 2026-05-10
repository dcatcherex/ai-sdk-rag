"use client";

import { cn } from "@/lib/utils";
import { CheckIcon, MicIcon, XIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string;
  start(): void; stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
}
interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; resultIndex: number; }
interface SpeechRecognitionResultList { readonly length: number; item(index: number): SpeechRecognitionResult; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { readonly length: number; item(index: number): SpeechRecognitionAlternative; [index: number]: SpeechRecognitionAlternative; isFinal: boolean; }
interface SpeechRecognitionAlternative { transcript: string; confidence: number; }
interface SpeechRecognitionErrorEvent extends Event { error: string; }
declare global {
  interface Window {
    SpeechRecognition: { new(): SpeechRecognition };
    webkitSpeechRecognition: { new(): SpeechRecognition };
  }
}

type SpeechInputMode = "speech-recognition" | "media-recorder" | "none";

export type SpeechInputProps = ComponentProps<typeof Button> & {
  onTranscriptionChange?: (text: string) => void;
  onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
  onListeningChange?: (isListening: boolean) => void;
  lang?: string;
};

// ── Sound feedback ────────────────────────────────────────────────────────────

function playTone(frequency: number, duration = 80, volume = 0.12) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration / 1000);
    osc.onended = () => ctx.close();
  } catch { /* AudioContext unavailable */ }
}

// ── Waveform bars (driven by AnalyserNode via RAF) ────────────────────────────

const NUM_BARS = 12;

const RecordingWaveform = ({ barsRef }: { barsRef: React.RefObject<HTMLDivElement | null> }) => (
  <div ref={barsRef} className="flex flex-1 items-end justify-center gap-[3px] px-2 h-5">
    {Array.from({ length: NUM_BARS }).map((_, i) => (
      <div
        key={i}
        className="w-[3px] rounded-full bg-slate-500 dark:bg-zinc-400"
        style={{ height: "3px", transition: "height 60ms linear" }}
      />
    ))}
  </div>
);

// ── SpeechInput ───────────────────────────────────────────────────────────────

const detectMode = (): SpeechInputMode => {
  if (typeof window === "undefined") return "none";
  if ("MediaRecorder" in window && "mediaDevices" in navigator) return "media-recorder";
  return "none";
};

export const SpeechInput = ({
  className,
  onTranscriptionChange,
  onAudioRecorded,
  onListeningChange,
  lang = "en-US",
  ...props
}: SpeechInputProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<SpeechInputMode>("none");
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRef = useRef(false);

  // Audio analysis
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);
  const barsRef = useRef<HTMLDivElement | null>(null);

  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  onTranscriptionChangeRef.current = onTranscriptionChange;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;
  const onAudioRecordedRef = useRef(onAudioRecorded);
  onAudioRecordedRef.current = onAudioRecorded;

  useEffect(() => { setMode(detectMode()); }, []);

  // ── Speech Recognition setup ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "speech-recognition") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const sr = new SR();
    sr.continuous = true;
    sr.interimResults = true;
    sr.lang = lang;
    sr.onstart = () => { setIsListening(true); onListeningChangeRef.current?.(true); };
    sr.onend = () => { setIsListening(false); onListeningChangeRef.current?.(false); };
    sr.onresult = (event) => {
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) final += r[0]?.transcript ?? "";
      }
      if (final) onTranscriptionChangeRef.current?.(final);
    };
    sr.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        console.error("SpeechRecognition error:", event.error);
      }
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    };
    recognitionRef.current = sr;
    setRecognition(sr);
    return () => { recognitionRef.current?.stop(); };
  }, [mode, lang]);

  // ── Audio analyser RAF loop ────────────────────────────────────────────────
  const startAnalyser = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        const container = barsRef.current;
        if (container) {
          const bars = container.children;
          // Lower = more sensitive. Typical speech peak is 10-30 out of 128,
          // so we scale against 22 instead of 128 to fill the bar range.
          const SENSITIVITY = 22;
          const segLen = Math.floor(dataArray.length / NUM_BARS);
          for (let i = 0; i < NUM_BARS; i++) {
            let peak = 0;
            for (let j = i * segLen; j < (i + 1) * segLen; j++) {
              peak = Math.max(peak, Math.abs((dataArray[j] ?? 128) - 128));
            }
            const h = Math.max(3, Math.min(20, Math.round((peak / SENSITIVITY) * 20)));
            (bars[i] as HTMLElement).style.height = `${h}px`;
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch { /* AudioContext unavailable */ }
  }, []);

  const stopAnalyser = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    analyserRef.current = null;
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    // Reset bars to resting height
    if (barsRef.current) {
      for (const bar of Array.from(barsRef.current.children)) {
        (bar as HTMLElement).style.height = "3px";
      }
    }
  }, []);

  // ── MediaRecorder ──────────────────────────────────────────────────────────
  const startMediaRecorder = useCallback(async () => {
    if (!onAudioRecordedRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopAnalyser();
        for (const track of stream.getTracks()) track.stop();
        if (discardRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (blob.size > 0) {
          setIsProcessing(true);
          try {
            const transcript = await onAudioRecordedRef.current!(blob);
            if (transcript) onTranscriptionChangeRef.current?.(transcript);
          } finally {
            setIsProcessing(false);
          }
        }
      };

      recorder.onerror = () => {
        stopAnalyser();
        for (const track of stream.getTracks()) track.stop();
        setIsListening(false);
        onListeningChangeRef.current?.(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      startAnalyser(stream);
      setIsListening(true);
      onListeningChangeRef.current?.(true);
      playTone(880, 80);
    } catch {
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    }
  }, [startAnalyser, stopAnalyser]);

  const stopRecording = useCallback((discard: boolean) => {
    discardRef.current = discard;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (!discard) playTone(660, 80);
    setIsListening(false);
    onListeningChangeRef.current?.(false);
  }, []);

  // ── Speech recognition start/stop ─────────────────────────────────────────
  const startSpeechRecognition = useCallback(() => {
    if (recognition) { recognition.start(); playTone(880, 80); }
  }, [recognition]);

  const stopSpeechRecognition = useCallback((discard: boolean) => {
    if (recognition) {
      if (discard) recognition.onresult = null;
      recognition.stop();
    }
    if (!discard) playTone(660, 80);
  }, [recognition]);

  const handleStart = useCallback(() => {
    if (mode === "speech-recognition") startSpeechRecognition();
    else if (mode === "media-recorder") startMediaRecorder();
  }, [mode, startSpeechRecognition, startMediaRecorder]);

  const handleConfirm = useCallback(() => {
    if (mode === "speech-recognition") stopSpeechRecognition(false);
    else stopRecording(false);
  }, [mode, stopSpeechRecognition, stopRecording]);

  const handleCancel = useCallback(() => {
    if (mode === "speech-recognition") stopSpeechRecognition(true);
    else stopRecording(true);
  }, [mode, stopSpeechRecognition, stopRecording]);

  const isDisabled =
    mode === "none" ||
    (mode === "speech-recognition" && !recognition) ||
    (mode === "media-recorder" && !onAudioRecorded) ||
    isProcessing;

  // ── Recording bar ──────────────────────────────────────────────────────────
  if (isListening) {
    return (
      <div className="flex flex-1 items-center gap-1.5 rounded-full border border-black/8 bg-white/90 px-2 py-1 shadow-sm dark:border-white/12 dark:bg-zinc-900/90">
        <RecordingWaveform barsRef={barsRef} />
        <button
          type="button"
          aria-label="Cancel recording"
          onClick={handleCancel}
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-400 dark:hover:bg-white/15"
        >
          <XIcon className="size-3.5" />
        </button>
        <button
          type="button"
          aria-label="Send transcription"
          onClick={handleConfirm}
          className="flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 text-amber-500 transition-colors hover:bg-amber-50 dark:hover:bg-amber-500/10"
        >
          {isProcessing ? (
            <svg className="animate-spin size-3.5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          ) : (
            <CheckIcon className="size-3.5" />
          )}
        </button>
      </div>
    );
  }

  // ── Mic button ─────────────────────────────────────────────────────────────
  return (
    <Button
      type="button"
      className={cn("relative z-10 rounded-full", className)}
      disabled={isDisabled}
      onClick={handleStart}
      {...props}
    >
      {isProcessing ? <Spinner /> : <MicIcon className="size-4" />}
    </Button>
  );
};
