'use client';

import type { ChatStatus } from 'ai';
import { BookOpenIcon } from 'lucide-react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { SpeechInput } from '@/components/ai-elements/speech-input';

type ChatComposerProps = {
  selectedDocCount: number;
  status: ChatStatus;
  error?: Error;
  onStop: () => void;
  onTranscriptionChange: (transcript: string) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
};

export const ChatComposer = ({
  selectedDocCount,
  status,
  error,
  onStop,
  onTranscriptionChange,
  onSubmit,
}: ChatComposerProps) => (
  <div className="border-t border-black/5 px-3 py-3 md:px-6 md:py-4">
    {selectedDocCount > 0 && (
      <div className="mb-2 flex items-center gap-1.5 text-xs text-primary">
        <BookOpenIcon className="size-3.5" />
        <span className="font-medium">
          Grounded mode — answering from {selectedDocCount} selected document
          {selectedDocCount !== 1 ? 's' : ''}
        </span>
      </div>
    )}
    <PromptInput onSubmit={(message) => onSubmit(message)}>
      <PromptInputBody className="gap-3 rounded-2xl border border-black/5 bg-white/70 px-3 py-2 shadow-inner">
        <PromptInputTextarea placeholder="Ask anything or drop files to ground the response." />
        <div className="flex items-center gap-2">
          <SpeechInput
            size="icon"
            variant="ghost"
            className="size-8"
            onTranscriptionChange={onTranscriptionChange}
          />
          <PromptInputSubmit onStop={onStop} status={status} />
        </div>
      </PromptInputBody>
    </PromptInput>
    {error ? (
      <p className="mt-2 text-xs text-destructive">
        {error.message || 'Something went wrong. Please try again.'}
      </p>
    ) : null}
  </div>
);
