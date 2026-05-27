'use client';

import { useCallback, useEffect } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { AudioLinesIcon, MicIcon, SquareIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PromptInputSubmit,
  usePromptInputAttachments,
  usePromptInputController,
} from '@/components/ai-elements/prompt-input';
import type { VoiceState } from '@/features/chat/hooks/use-live-voice';
import { useLiveTranscription } from '@/features/chat/hooks/use-live-transcription';

export type ComposerActionButtonsProps = {
  status: ChatStatus;
  queuedMessageCount?: number;
  voiceOpen: boolean;
  voiceState?: VoiceState;
  speakAloud?: boolean;
  onStop: () => void;
  onOpenVoice: () => void;
  onCloseVoice: () => void;
  onToggleSpeakAloud?: () => void;
  onTranscriptionChange: (transcript: string) => void;
};

function resolveDictationLanguage() {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const language = navigator.language.toLowerCase();
  if (language.startsWith('th')) return 'th';
  if (language.startsWith('en')) return 'en';
  return undefined;
}

const DICTATION_WAVEFORM_BARS = [0.34, 0.52, 0.74, 0.42, 0.86, 0.6, 0.96, 0.48, 0.7, 0.9, 0.56, 0.78, 0.44, 0.66, 0.84, 0.5];

const DictationWaveform = ({
  micLevel,
  state,
}: {
  micLevel: number;
  state: 'connecting' | 'listening' | 'error' | 'idle';
}) => {
  const isListening = state === 'listening';
  const level = isListening ? Math.max(0.16, Math.min(micLevel, 1)) : 0.14;

  return (
    <div
      className="pointer-events-none flex h-9 min-w-0 flex-1 items-center justify-center gap-1 px-1"
      aria-hidden="true"
    >
      <div className="hidden h-px min-w-8 flex-1 border-t border-dotted border-slate-300 dark:border-white/20 sm:block" />
      <div className="flex h-7 shrink-0 items-center justify-center gap-[3px] rounded-full px-2">
        {DICTATION_WAVEFORM_BARS.map((base, index) => {
          const height = Math.max(4, Math.round(base * level * 28));

          return (
            <span
              key={index}
              className={cn(
                'w-[3px] rounded-full bg-slate-950 transition-[height,opacity] duration-100 dark:bg-white',
                state === 'connecting' && 'animate-pulse opacity-45',
                state === 'listening' && 'opacity-90',
              )}
              style={{ height }}
            />
          );
        })}
      </div>
      <div className="hidden h-px min-w-8 flex-1 border-t border-dotted border-slate-300 dark:border-white/20 sm:block" />
    </div>
  );
};

export const ComposerActionButtons = ({
  status,
  queuedMessageCount = 0,
  voiceOpen,
  speakAloud,
  onStop,
  onOpenVoice,
  onCloseVoice,
  onToggleSpeakAloud,
  onTranscriptionChange,
}: ComposerActionButtonsProps) => {
  const { textInput } = usePromptInputController();
  const { anyUploading } = usePromptInputAttachments();
  const isEmpty = textInput.value.trim() === '';
  const isGenerating = status === 'submitted' || status === 'streaming';

  const {
    dictationState,
    isDictating,
    micLevel,
    noteManualTextChange,
    start,
    stop,
  } = useLiveTranscription({
    composerText: textInput.value,
    language: resolveDictationLanguage(),
    onComposerTextChange: (nextText) => {
      textInput.setInput(nextText);
      onTranscriptionChange(nextText);
    },
    onError: (message) => {
      toast.error('Dictation error', { description: message });
    },
  });

  useEffect(() => {
    noteManualTextChange(textInput.value);
  }, [noteManualTextChange, textInput.value]);

  useEffect(() => {
    if ((voiceOpen || isGenerating) && isDictating) {
      stop();
    }
  }, [isDictating, isGenerating, stop, voiceOpen]);

  const toggleDictation = useCallback(() => {
    if (isDictating) {
      stop();
      return;
    }

    void start();
  }, [isDictating, start, stop]);

  if (isGenerating) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {!isEmpty ? (
          <div className="relative">
            <PromptInputSubmit className="size-9 rounded-full" />
            {queuedMessageCount > 0 ? (
              <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] font-medium leading-4 text-primary-foreground">
                {queuedMessageCount + 1}
              </span>
            ) : null}
          </div>
        ) : null}
        <PromptInputSubmit className="size-9 rounded-full" onStop={onStop} status={status} />
      </div>
    );
  }

  if (voiceOpen) {
    return (
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          title={speakAloud ? 'Mute AI voice' : 'Unmute AI voice'}
          onClick={onToggleSpeakAloud}
          className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-muted-foreground transition-colors hover:bg-slate-200 hover:text-foreground dark:bg-white/10 dark:hover:bg-white/15"
        >
          {speakAloud ? <Volume2Icon className="size-4" /> : <VolumeXIcon className="size-4" />}
        </button>
        <button
          type="button"
          title="End voice conversation"
          onClick={onCloseVoice}
          className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          <AudioLinesIcon className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'ml-auto flex min-w-0 shrink-0 items-center gap-1.5',
        isDictating && 'flex-1',
      )}
      data-dictation-active={isDictating ? 'true' : undefined}
    >
      {isDictating ? (
        <DictationWaveform micLevel={micLevel} state={dictationState} />
      ) : null}

      <button
        type="button"
        title={isDictating ? 'Stop dictation' : 'Dictate message'}
        aria-label={isDictating ? 'Stop dictation' : 'Dictate message'}
        onClick={toggleDictation}
        className={cn(
          'flex size-9 items-center justify-center rounded-full transition-colors',
          isDictating
            ? 'shrink-0 bg-rose-500 text-white shadow-[0_8px_24px_-12px_rgba(244,63,94,0.9)] hover:bg-rose-600'
            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-zinc-200 dark:hover:bg-white/15',
        )}
      >
        {isDictating ? (
          <SquareIcon className={cn('size-4', dictationState === 'listening' && 'animate-pulse')} />
        ) : (
          <MicIcon className="size-4" />
        )}
      </button>

      {!isDictating && (isEmpty ? (
        <button
          type="button"
          title="Talk with Vaja"
          aria-label="Talk with Vaja"
          onClick={onOpenVoice}
          className="flex size-9 items-center justify-center rounded-full bg-slate-950 text-white shadow-sm transition-colors hover:bg-slate-800 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          <AudioLinesIcon className="size-4" />
        </button>
      ) : (
        <PromptInputSubmit
          className="size-9 rounded-full shadow-sm"
          onStop={onStop}
          status={status}
          disabled={anyUploading || undefined}
        />
      ))}
    </div>
  );
};
