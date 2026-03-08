"use client";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MicIcon, SquareIcon } from "lucide-react";
import { toast } from "sonner";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

type SpeechInputMode = "speech-recognition" | "media-recorder" | "none";

export type SpeechInputProps = ComponentProps<typeof Button> & {
  onTranscriptionChange?: (text: string) => void;
  /**
   * Callback for when audio is recorded using MediaRecorder fallback.
   * This is called in browsers that don't support the Web Speech API (Firefox, Safari).
   * The callback receives an audio Blob that should be sent to a transcription service.
   * Return the transcribed text, which will be passed to onTranscriptionChange.
   */
  onAudioRecorded?: (audioBlob: Blob) => Promise<string>;
  onListeningChange?: (isListening: boolean) => void;
  lang?: string;
};

const detectSpeechInputMode = (): SpeechInputMode => {
  if (typeof window === "undefined") {
    return "none";
  }

  // Prefer MediaRecorder (Gemini transcription) over Web Speech API:
  // - Web Speech API sends audio to Google's servers (blocked in Brave, unreliable on VPN)
  // - Web Speech API has poor accuracy for non-English languages (Thai, etc.)
  // - Gemini transcription is more accurate and works in all browsers
  if ("MediaRecorder" in window && "mediaDevices" in navigator) {
    return "media-recorder";
  }

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
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  // Keep latest callbacks in refs so the useEffect never needs to re-run for them
  const onTranscriptionChangeRef = useRef(onTranscriptionChange);
  onTranscriptionChangeRef.current = onTranscriptionChange;
  const onListeningChangeRef = useRef(onListeningChange);
  onListeningChangeRef.current = onListeningChange;

  // Detect mode on mount
  useEffect(() => {
    setMode(detectSpeechInputMode());
  }, []);

  // Initialize Speech Recognition — only re-runs when mode or lang changes
  useEffect(() => {
    if (mode !== "speech-recognition") {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechRecognition = new SpeechRecognition();

    speechRecognition.continuous = true;
    speechRecognition.interimResults = true;
    speechRecognition.lang = lang;

    speechRecognition.onstart = () => {
      setIsListening(true);
      onListeningChangeRef.current?.(true);
    };

    speechRecognition.onend = () => {
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    };

    speechRecognition.onresult = (event) => {
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0]?.transcript ?? "";
        }
      }

      if (finalTranscript) {
        onTranscriptionChangeRef.current?.(finalTranscript);
      }
    };

    speechRecognition.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        toast.error('Microphone error', { description: event.error });
      }
      setIsListening(false);
      onListeningChangeRef.current?.(false);
    };

    recognitionRef.current = speechRecognition;
    setRecognition(speechRecognition);

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [mode, lang]);

  // Start MediaRecorder recording
  const startMediaRecorder = useCallback(async () => {
    if (!onAudioRecorded) {
      console.warn(
        "SpeechInput: onAudioRecorded callback is required for MediaRecorder fallback"
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release the microphone
        for (const track of stream.getTracks()) {
          track.stop();
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        if (audioBlob.size > 0) {
          setIsProcessing(true);
          try {
            const transcript = await onAudioRecorded(audioBlob);
            if (transcript) {
              onTranscriptionChange?.(transcript);
            }
          } catch (error) {
            console.error("Transcription error:", error);
          } finally {
            setIsProcessing(false);
          }
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setIsListening(false);
        onListeningChange?.(false);
        // Stop all tracks on error
        for (const track of stream.getTracks()) {
          track.stop();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsListening(true);
      onListeningChange?.(true);
    } catch (error) {
      console.error("Failed to start MediaRecorder:", error);
      setIsListening(false);
      onListeningChange?.(false);
    }
  }, [onAudioRecorded, onTranscriptionChange, onListeningChange]);

  // Stop MediaRecorder recording
  const stopMediaRecorder = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsListening(false);
    onListeningChange?.(false);
  }, [onListeningChange]);

  const toggleListening = useCallback(() => {
    if (mode === "speech-recognition" && recognition) {
      if (isListening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    } else if (mode === "media-recorder") {
      if (isListening) {
        stopMediaRecorder();
      } else {
        startMediaRecorder();
      }
    }
  }, [mode, recognition, isListening, startMediaRecorder, stopMediaRecorder]);

  // Determine if button should be disabled
  const isDisabled =
    mode === "none" ||
    (mode === "speech-recognition" && !recognition) ||
    (mode === "media-recorder" && !onAudioRecorded) ||
    isProcessing;

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Animated pulse rings */}
      {isListening &&
        [0, 1, 2].map((index) => (
          <div
            className="absolute inset-0 animate-ping rounded-full border-2 border-red-400/30"
            key={index}
            style={{
              animationDelay: `${index * 0.3}s`,
              animationDuration: "2s",
            }}
          />
        ))}

      {/* Main record button */}
      <Button
        type="button"
        className={cn(
          "relative z-10 rounded-full transition-all duration-300",
          isListening
            ? "bg-destructive text-white hover:bg-destructive/80 hover:text-white"
            : "bg-primary text-primary-foreground hover:bg-primary/80 hover:text-primary-foreground",
          className
        )}
        disabled={isDisabled}
        onClick={toggleListening}
        {...props}
      >
        {isProcessing && <Spinner />}
        {!isProcessing && isListening && <SquareIcon className="size-4" />}
        {!(isProcessing || isListening) && <MicIcon className="size-4" />}
      </Button>
    </div>
  );
};
