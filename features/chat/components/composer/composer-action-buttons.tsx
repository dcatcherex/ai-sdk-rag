'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatStatus } from 'ai';
import { toast } from 'sonner';
import { AudioLinesIcon } from 'lucide-react';
import {
  PromptInputSubmit,
  usePromptInputController,
} from '@/components/ai-elements/prompt-input';
import { SpeechInput } from '@/components/ai-elements/speech-input';

export type ComposerActionButtonsProps = {
  status: ChatStatus;
  voiceOpen: boolean;
  onStop: () => void;
  onOpenVoice: () => void;
  onTranscriptionChange: (transcript: string) => void;
};

export const ComposerActionButtons = ({
  status,
  voiceOpen,
  onStop,
  onOpenVoice,
  onTranscriptionChange,
}: ComposerActionButtonsProps) => {
  const { textInput } = usePromptInputController();
  const [isDictating, setIsDictating] = useState(false);
  const isEmpty = textInput.value.trim() === '';
  const isGenerating = status === 'submitted' || status === 'streaming';

  // Keep textInput in a ref so handleTranscription stays stable (no recognition restarts)
  const textInputRef = useRef(textInput);
  textInputRef.current = textInput;

  const handleTranscription = useCallback((transcript: string) => {
    const current = textInputRef.current.value;
    const next = current ? `${current} ${transcript}` : transcript;
    textInputRef.current.setInput(next);
    onTranscriptionChange(next);
  }, [onTranscriptionChange]);

  const handleAudioRecorded = useCallback(async (audioBlob: Blob): Promise<string> => {
    const toastId = toast.loading('Transcribing via Gemini 2.5 Flash Lite…');
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob);
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const json = await res.json() as { transcript?: string; model?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Transcription failed');
      toast.success('Transcribed', {
        id: toastId,
        description: `via ${json.model}`,
        duration: 3000,
      });
      return json.transcript ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Transcription failed', { id: toastId, description: msg });
      return '';
    }
  }, []);

  if (isGenerating) {
    return (
      <div className="ml-auto">
        <PromptInputSubmit onStop={onStop} status={status} />
      </div>
    );
  }

  return (
    <div className="ml-auto flex items-center gap-2">
      <SpeechInput
        size="icon"
        variant="ghost"
        className="size-8"
        lang={typeof navigator !== 'undefined' ? navigator.language : 'en-US'}
        onTranscriptionChange={handleTranscription}
        onAudioRecorded={handleAudioRecorded}
        onListeningChange={setIsDictating}
      />
      {isEmpty && !isDictating ? (
        <button
          type="button"
          title="Voice conversation"
          onClick={onOpenVoice}
          className={`flex size-8 items-center justify-center rounded-md transition-colors ${
            voiceOpen
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-muted'
          }`}
        >
          <AudioLinesIcon className="size-4" />
        </button>
      ) : (
        <PromptInputSubmit onStop={onStop} status={status} />
      )}
    </div>
  );
};
