'use client';

import { usePromptInputController } from '@/components/ai-elements/prompt-input';
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
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
import { SpeechInput } from '@/components/ai-elements/speech-input';
import { IMAGE_EDIT_MODELS } from '../../utils';

/** Injects mic transcription into the controlled textarea. */
const EditorSpeechInput = () => {
  const controller = usePromptInputController();
  return (
    <SpeechInput
      size="icon"
      variant="ghost"
      className="size-8"
      onTranscriptionChange={(text) => {
        const current = controller.textInput.value;
        controller.textInput.setInput(current ? `${current} ${text}` : text);
      }}
    />
  );
};

type Props = {
  submitError: string | null;
  isSubmitting: boolean;
  selectedModel: string;
  modelSelectorOpen: boolean;
  onModelSelectorOpenChange: (open: boolean) => void;
  onModelSelect: (modelId: string) => void;
  onSubmit: (text: string) => Promise<void>;
};

export const EditorPromptBar = ({
  submitError,
  isSubmitting,
  selectedModel,
  modelSelectorOpen,
  onModelSelectorOpenChange,
  onModelSelect,
  onSubmit,
}: Props) => {
  const currentModel = IMAGE_EDIT_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="shrink-0 border-t border-black/5 dark:border-border px-4 py-3">
      {submitError && <p className="mb-2 text-xs text-destructive">{submitError}</p>}
      <PromptInputProvider>
        <PromptInput onSubmit={({ text }) => onSubmit(text)}>
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Describe your edit, e.g. replace background with watercolor sunset…"
              className="max-h-32 min-h-0"
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
              <ModelSelector open={modelSelectorOpen} onOpenChange={onModelSelectorOpenChange}>
                <ModelSelectorTrigger asChild>
                  <PromptInputButton>
                    <ModelSelectorLogo provider={currentModel?.provider ?? 'openai'} />
                    <ModelSelectorName>{currentModel?.name ?? selectedModel}</ModelSelectorName>
                  </PromptInputButton>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {IMAGE_EDIT_MODELS.map((model) => (
                      <ModelSelectorItem
                        key={model.id}
                        value={model.id}
                        onSelect={() => onModelSelect(model.id)}
                      >
                        <ModelSelectorLogo provider={model.provider} />
                        <ModelSelectorName>{model.name}</ModelSelectorName>
                      </ModelSelectorItem>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <div className="ml-auto flex items-center gap-2">
              <EditorSpeechInput />
              <PromptInputSubmit status={isSubmitting ? 'submitted' : 'ready'} onStop={() => {}} />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </PromptInputProvider>
    </div>
  );
};
