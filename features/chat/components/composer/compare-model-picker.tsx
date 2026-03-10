'use client';

import { useState } from 'react';
import { CheckIcon, Columns2Icon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { availableModels } from '@/lib/ai';
import { ModelSelectorLogo } from '@/components/ai-elements/model-selector';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { ComparePresetMode } from '@/features/chat/hooks/use-compare-preset';
import { Dots, speedTier, costTier } from './model-dots';

export type CompareModelPickerProps = {
  compareMode: boolean;
  comparePresetIds: string[];
  comparePresetMode: ComparePresetMode;
  selectorModels: { id: string; name: string; provider: string }[];
  onToggleCompareMode: () => void;
  onToggleCompareModel: (modelId: string) => void;
  onClearComparePreset: () => void;
};

export const CompareModelPicker = ({
  compareMode,
  comparePresetIds,
  comparePresetMode,
  selectorModels,
  onToggleCompareMode,
  onToggleCompareModel,
  onClearComparePreset,
}: CompareModelPickerProps) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const models = selectorModels.filter((m) => m.id !== 'auto');
  const typeLabel =
    comparePresetMode === 'image' ? 'Image models'
    : comparePresetMode === 'text' ? 'Text models'
    : null;

  const handleCompareClick = () => {
    if (!compareMode) {
      onToggleCompareMode();
      if (comparePresetIds.length < 2) setPickerOpen(true);
    } else {
      onToggleCompareMode();
    }
  };

  const ModelPickerPopover = (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Select models to compare"
          className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            compareMode
              ? 'text-primary-foreground hover:bg-white/15'
              : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
          }`}
        >
          <SlidersHorizontalIcon className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="top"
        className="w-72 p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-black/5 dark:border-white/10 px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-foreground">Compare models</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {comparePresetIds.length < 2
                ? `Select at least 2 to enable · ${comparePresetIds.length} selected`
                : `${comparePresetIds.length} of 4 selected · active`}
            </p>
          </div>
          {comparePresetIds.length > 0 && (
            <button
              type="button"
              onClick={onClearComparePreset}
              className="flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <XIcon className="size-3" />
              Clear
            </button>
          )}
        </div>

        {/* Type lock notice */}
        {typeLabel && (
          <div className="border-b border-black/5 dark:border-white/10 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">
              Locked to <span className="font-medium text-foreground">{typeLabel}</span>
              {' '}— clear to switch type
            </span>
          </div>
        )}

        {/* Column header */}
        <div className="flex items-center border-b border-black/5 dark:border-white/10 px-3 py-1.5">
          <span className="flex-1 text-[11px] font-medium text-muted-foreground">Model</span>
          <div className="flex gap-4 text-[11px] font-medium text-muted-foreground">
            <span>Speed</span>
            <span>Cost</span>
          </div>
        </div>

        {/* Model list */}
        <div className="max-h-60 overflow-y-auto overscroll-contain">
          <div className="p-1.5">
            {models.map((model) => {
              const selected = comparePresetIds.includes(model.id);
              const fullModel = availableModels.find((m) => m.id === model.id);
              const caps = fullModel?.capabilities ?? [];
              const isImageModel = caps.some((c) => c === 'image gen');
              const maxReached = !selected && comparePresetIds.length >= 4;
              const typeMismatch =
                !selected &&
                comparePresetMode !== null &&
                (comparePresetMode === 'image') !== isImageModel;
              const disabled = maxReached || typeMismatch;

              return (
                <button
                  key={model.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onToggleCompareModel(model.id)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                    disabled
                      ? 'cursor-not-allowed opacity-30'
                      : selected
                        ? 'bg-primary/8 dark:bg-primary/15 hover:bg-primary/12 dark:hover:bg-primary/20'
                        : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Checkbox
                    checked={selected}
                    disabled={disabled}
                    className="pointer-events-none shrink-0"
                    onCheckedChange={() => {}}
                  />
                  <ModelSelectorLogo provider={model.provider} />
                  <span className={`flex-1 truncate text-[12px] ${selected ? 'font-medium text-foreground' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    {model.name}
                  </span>
                  <div className="flex items-center gap-3">
                    <Dots filled={speedTier(fullModel)} color="bg-blue-400" />
                    <Dots filled={costTier(fullModel)} color="bg-amber-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-black/5 dark:border-white/10 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">Same model type only · max 4</span>
          {comparePresetIds.length >= 2 && (
            <span className="flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400">
              <CheckIcon className="size-3" />
              Ready
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className={`flex items-center rounded-md transition-colors ${compareMode ? 'bg-primary text-primary-foreground' : ''}`}>
      <button
        type="button"
        onClick={handleCompareClick}
        title={compareMode ? 'Cancel compare' : 'Compare models'}
        className={`flex h-8 items-center gap-1.5 rounded-l-md px-2.5 text-[13px] font-medium transition-colors ${
          compareMode
            ? 'text-primary-foreground hover:bg-white/15'
            : 'text-muted-foreground hover:bg-zinc-100 dark:hover:bg-zinc-800'
        }`}
      >
        <Columns2Icon className="size-4" />
        <span className="hidden sm:inline"></span>
        {comparePresetIds.length > 0 && (
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
            compareMode ? 'bg-white/20' : 'bg-primary/15 text-primary'
          }`}>
            {comparePresetIds.length}
          </span>
        )}
      </button>
      {compareMode && (
        <>
          <div className="w-px self-stretch bg-white/20" />
          {ModelPickerPopover}
        </>
      )}
    </div>
  );
};
