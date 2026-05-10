'use client';

import { CheckIcon } from 'lucide-react';
import { availableModels } from '@/lib/ai';
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from '@/components/ai-elements/model-selector';
import { PromptInputButton } from '@/components/ai-elements/prompt-input';
import { Dots, speedTier, costTier } from './model-dots';

type ComposerModelSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentModel: { name: string; provider: string };
  selectorModels: { id: string; name: string; provider: string }[];
  selectedModel: string;
  onSelectModel: (modelId: string) => void;
};

export const ComposerModelSelector = ({
  open,
  onOpenChange,
  currentModel,
  selectorModels,
  selectedModel,
  onSelectModel,
}: ComposerModelSelectorProps) => (
  <ModelSelector open={open} onOpenChange={onOpenChange}>
    <ModelSelectorTrigger asChild>
      <PromptInputButton
        aria-label="Select model"
        title="Select model"
        className="hidden"
      >
        <ModelSelectorLogo provider={currentModel.provider} />
      </PromptInputButton>
    </ModelSelectorTrigger>
    <ModelSelectorContent>
      <ModelSelectorInput placeholder="Search models..." />
      <div className="flex items-center border-b border-black/5 px-3 py-1.5 dark:border-border">
        <span className="flex-1 text-[11px] font-medium text-muted-foreground">Model</span>
        <div className="flex gap-5 pr-1 text-[11px] font-medium text-muted-foreground">
          <span>Speed</span>
          <span>Cost</span>
        </div>
      </div>
      <ModelSelectorList>
        <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
        {selectorModels.map((model) => {
          const fullModel = availableModels.find((m) => m.id === model.id);
          const isAuto = model.id === 'auto';
          const isSelected = selectedModel === model.id;
          return (
            <ModelSelectorItem
              key={model.id}
              onSelect={() => onSelectModel(model.id)}
              value={model.id}
            >
              <ModelSelectorLogo provider={model.provider} />
              <ModelSelectorName>{model.name}</ModelSelectorName>
              <div className="ml-auto flex items-center gap-3">
                {!isAuto && (
                  <>
                    <Dots filled={speedTier(fullModel)} color="bg-blue-400" />
                    <Dots filled={costTier(fullModel)} color="bg-amber-400" />
                  </>
                )}
                {isSelected && <CheckIcon className="size-3.5 text-primary" />}
              </div>
            </ModelSelectorItem>
          );
        })}
      </ModelSelectorList>
    </ModelSelectorContent>
  </ModelSelector>
);
