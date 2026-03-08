'use client';

import { useEffect, useRef } from 'react';
import { MicIcon, Volume2Icon, VolumeXIcon, XIcon } from 'lucide-react';
import type { VoiceState, VoiceTurn } from '@/features/chat/hooks/use-live-voice';

type VoiceModeProps = {
  voiceState: VoiceState;
  transcript: VoiceTurn[];
  micLevel: number;
  speakAloud: boolean;
  onClose: () => void;
  onToggleSpeakAloud: () => void;
};

// Animated waveform bars — height driven by micLevel when listening
const Waveform = ({ level, active }: { level: number; active: boolean }) => {
  const bars = [0.4, 0.7, 1.0, 0.7, 0.4, 0.6, 0.9, 0.6, 0.3, 0.8];
  return (
    <div className="flex items-center justify-center gap-[3px] h-8">
      {bars.map((base, i) => {
        const animating = active && level > 0.05;
        const height = animating
          ? Math.max(4, Math.round(base * level * 32))
          : active
            ? 4
            : Math.round(base * 12);
        return (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-75 ${
              active ? 'bg-primary' : 'bg-muted-foreground/40'
            }`}
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
};

const STATUS_TEXT: Record<VoiceState, string> = {
  idle: 'Initializing...',
  connecting: 'Connecting...',
  listening: 'Listening',
  'ai-speaking': 'AI is responding...',
  error: 'Connection error',
};

const STATUS_DOT: Record<VoiceState, string> = {
  idle: 'bg-zinc-400',
  connecting: 'bg-yellow-400 animate-pulse',
  listening: 'bg-green-500 animate-pulse',
  'ai-speaking': 'bg-blue-400 animate-pulse',
  error: 'bg-red-500',
};

export const VoiceMode = ({
  voiceState,
  transcript,
  micLevel,
  speakAloud,
  onClose,
  onToggleSpeakAloud,
}: VoiceModeProps) => {
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest transcript entry
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  const isListening = voiceState === 'listening';
  const isAiSpeaking = voiceState === 'ai-speaking';
  const isActive = isListening || isAiSpeaking;

  return (
    <div className="mx-1 mb-2 overflow-hidden rounded-xl border border-black/8 dark:border-white/10 bg-white/95 dark:bg-zinc-900/95 shadow-lg backdrop-blur">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className={`size-2 rounded-full ${STATUS_DOT[voiceState]}`} />
          <span className="text-xs font-medium text-foreground">{STATUS_TEXT[voiceState]}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleSpeakAloud}
            title={speakAloud ? 'Mute AI voice' : 'Unmute AI voice'}
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground"
          >
            {speakAloud ? <Volume2Icon className="size-3.5" /> : <VolumeXIcon className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close voice mode"
            className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-foreground"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Waveform + status center */}
      <div className="flex flex-col items-center gap-1 px-3 py-3">
        <Waveform level={isListening ? micLevel : (isAiSpeaking ? 0.6 : 0)} active={isActive} />
        {isListening && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <MicIcon className="size-2.5" /> Speak now
          </p>
        )}
      </div>

      {/* Transcript */}
      {transcript.length > 0 && (
        <div className="max-h-40 overflow-y-auto border-t border-black/5 dark:border-white/10 px-3 py-2 space-y-1.5">
          {transcript.map((turn, i) => (
            <div key={i} className={`flex gap-1.5 text-[12px] leading-relaxed ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <span className={`rounded-lg px-2 py-1 max-w-[85%] ${
                turn.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-foreground'
              }`}>
                {turn.text}
                {turn.partial && (
                  <span className="ml-0.5 inline-block w-0.5 h-3 bg-current align-middle animate-pulse" />
                )}
              </span>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>
      )}
    </div>
  );
};
