'use client';

import type { ChatStatus } from 'ai';
import { BookOpenIcon } from 'lucide-react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
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
      <PromptInputBody>
        <PromptInputTextarea
          className="min-h-24 max-h-[40vh] overflow-y-auto leading-6"
          placeholder="Ask anything or drop files to ground the response."
        />
      </PromptInputBody>
      <PromptInputFooter>
        <div className="flex items-center gap-2">
          <SpeechInput
            size="icon"
            variant="ghost"
            className="size-8"
            onTranscriptionChange={onTranscriptionChange}
          />
          <PromptInputSubmit onStop={onStop} status={status} />
        </div>
      </PromptInputFooter>
    </PromptInput>
    {error ? (
      <p className="mt-2 text-xs text-destructive">
        {error.message || 'Something went wrong. Please try again.'}
      </p>
    ) : null}
  </div>
);
