'use client';

import { ScanTextIcon, SparklesIcon, FileIcon, ChevronDownIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { availableModels } from '@/lib/ai';
import { cn } from '@/lib/utils';
import type { ProcessingMode } from '@/lib/hooks/use-documents';

const MODES = [
  {
    value: 'precise' as ProcessingMode,
    label: 'Precise',
    description: 'Vision AI reads each page — preserves tables, page numbers, and sections for source citations.',
    icon: ScanTextIcon,
    color: 'border-blue-200 bg-blue-50 dark:border-blue-800/50 dark:bg-blue-950/30',
    activeColor: 'border-blue-400 ring-1 ring-blue-300 dark:border-blue-500 dark:ring-blue-700',
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  {
    value: 'optimized' as ProcessingMode,
    label: 'Optimized',
    description: 'AI removes noise (preface, TOC, bibliography) and restructures for fast, accurate search.',
    icon: SparklesIcon,
    color: 'border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-950/30',
    activeColor: 'border-amber-400 ring-1 ring-amber-300 dark:border-amber-500 dark:ring-amber-700',
    iconColor: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'raw' as ProcessingMode,
    label: 'Raw',
    description: 'Store as-is with no AI processing. Best for structured data, code, or when you want full control.',
    icon: FileIcon,
    color: 'border-zinc-200 bg-zinc-50 dark:border-zinc-700/50 dark:bg-zinc-900/30',
    activeColor: 'border-zinc-400 ring-1 ring-zinc-300 dark:border-zinc-500 dark:ring-zinc-600',
    iconColor: 'text-zinc-500 dark:text-zinc-400',
  },
];

// Only Google models support multimodal vision for Precise mode
const VISION_MODELS = availableModels.filter(
  (m) => m.provider === 'google' && !(m.capabilities as string[] | undefined)?.includes('image gen')
);
const DEFAULT_VISION_MODEL = 'google/gemini-3.1-flash-lite-preview';

interface ProcessingModeSelectorProps {
  value: ProcessingMode;
  onChange: (mode: ProcessingMode) => void;
  modelId?: string;
  onModelChange?: (modelId: string) => void;
  compact?: boolean;
  disabledModes?: ProcessingMode[];
}

export function ProcessingModeSelector({
  value,
  onChange,
  modelId = DEFAULT_VISION_MODEL,
  onModelChange,
  compact = false,
  disabledModes = [],
}: ProcessingModeSelectorProps) {
  return (
    <div className="space-y-2">
      <div className={cn('grid gap-2', compact ? 'grid-cols-3' : 'grid-cols-1')}>
        {MODES.map((mode) => {
          const Icon = mode.icon;
          const isActive = value === mode.value;
          const isDisabled = disabledModes.includes(mode.value);
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => !isDisabled && onChange(mode.value)}
              disabled={isDisabled}
              className={cn(
                'rounded-xl border p-3 text-left transition',
                isDisabled ? 'cursor-not-allowed opacity-40' : mode.color,
                !isDisabled && isActive ? mode.activeColor : !isDisabled && 'hover:opacity-90',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('size-3.5 shrink-0', mode.iconColor)} />
                <span className="text-xs font-semibold">{mode.label}</span>
              </div>
              {!compact && (
                <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                  {mode.description}
                </p>
              )}
            </button>
          );
        })}
      </div>

      {value === 'precise' && onModelChange && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground shrink-0">Vision model:</span>
          <Select value={modelId} onValueChange={onModelChange}>
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VISION_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
