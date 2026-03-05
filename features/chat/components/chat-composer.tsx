'use client';

import type { ChatStatus } from 'ai';
import { BookOpenIcon, CheckIcon, GlobeIcon } from 'lucide-react';
import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';

const composerSuggestions = [
  'Summarize this in bullet points',
  'Rewrite this to sound professional',
  'Turn this into a checklist',
  'Translate this to Thai and English',
];

const ComposerAttachments = () => {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <Attachments variant="inline">
      {attachments.files.map((attachment) => (
        <Attachment
          data={attachment}
          key={attachment.id}
          onRemove={() => attachments.remove(attachment.id)}
        >
          <AttachmentPreview />
          <AttachmentRemove />
        </Attachment>
      ))}
    </Attachments>
  );
};

type ChatComposerProps = {
  selectedDocCount: number;
  status: ChatStatus;
  error?: Error;
  selectedModel: string;
  selectorModels: { id: string; name: string; provider: string }[];
  currentModel: { name: string; provider: string };
  modelSelectorOpen: boolean;
  useWebSearch: boolean;
  onStop: () => void;
  onModelSelectorOpenChange: (open: boolean) => void;
  onSelectModel: (modelId: string) => void;
  onToggleWebSearch: () => void;
  onSuggestionClick: (suggestion: string) => void;
  onTranscriptionChange: (transcript: string) => void;
  onSubmit: (message: PromptInputMessage) => void | Promise<void>;
};

export const ChatComposer = ({
  selectedDocCount,
  status,
  error,
  selectedModel,
  selectorModels,
  currentModel,
  modelSelectorOpen,
  useWebSearch,
  onStop,
  onModelSelectorOpenChange,
  onSelectModel,
  onToggleWebSearch,
  onSuggestionClick,
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
    <Suggestions className="mb-3">
      {composerSuggestions.map((suggestion) => (
        <Suggestion
          key={suggestion}
          onClick={onSuggestionClick}
          suggestion={suggestion}
        />
      ))}
    </Suggestions>
    <PromptInput onSubmit={(message) => onSubmit(message)}>
      <PromptInputHeader>
        <ComposerAttachments />
      </PromptInputHeader>
      <PromptInputBody>
        <PromptInputTextarea
          className="min-h-24 max-h-[40vh] overflow-y-auto leading-6"
          placeholder="Ask anything or drop files to ground the response."
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          <PromptInputButton
            onClick={onToggleWebSearch}
            variant={useWebSearch ? 'default' : 'ghost'}
          >
            <GlobeIcon className="size-4" />
            <span>Search</span>
          </PromptInputButton>
          <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
            <ModelSelectorTrigger asChild>
              <PromptInputButton>
                <ModelSelectorLogo provider={currentModel.provider} />
                <ModelSelectorName>{currentModel.name}</ModelSelectorName>
              </PromptInputButton>
            </ModelSelectorTrigger>
            <ModelSelectorContent>
              <ModelSelectorList>
                <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                {selectorModels.map((model) => (
                  <ModelSelectorItem
                    key={model.id}
                    onSelect={() => onSelectModel(model.id)}
                    value={model.id}
                  >
                    <ModelSelectorLogo provider={model.provider} />
                    <ModelSelectorName>{model.name}</ModelSelectorName>
                    {selectedModel === model.id ? (
                      <CheckIcon className="ml-auto size-4" />
                    ) : null}
                  </ModelSelectorItem>
                ))}
              </ModelSelectorList>
            </ModelSelectorContent>
          </ModelSelector>
        </PromptInputTools>
        <div className="ml-auto flex items-center gap-2">
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
