'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SelectionFilterMode = 'all' | 'selected';
type SelectionPreset = {
  id: string;
  label: string;
};

type SelectionListToolbarProps = {
  mode: SelectionFilterMode;
  onModeChange: (mode: SelectionFilterMode) => void;
  onPresetApply?: (mode: 'add' | 'replace') => void;
  onPresetChange?: (presetId: string) => void;
  onSearchChange: (value: string) => void;
  presets?: SelectionPreset[];
  selectedPresetId?: string;
  searchPlaceholder: string;
  searchValue: string;
};

export function SelectionListToolbar({
  mode,
  onModeChange,
  onPresetApply,
  onPresetChange,
  onSearchChange,
  presets,
  selectedPresetId,
  searchPlaceholder,
  searchValue,
}: SelectionListToolbarProps) {
  return (
    <div className="space-y-2">
      <Input
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
        className="h-9"
      />
      <div className="flex items-center gap-2">
        {(['all', 'selected'] as const).map((option) => (
          <Button
            key={option}
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              'h-8 rounded-full px-3 text-xs',
              mode === option && 'border-primary bg-primary/10 text-primary',
            )}
            onClick={() => onModeChange(option)}
          >
            {option === 'all' ? 'All' : 'Selected'}
          </Button>
        ))}
        {presets && presets.length > 0 && onPresetChange ? (
          <div className="ml-auto flex items-center gap-2">
            <Select value={selectedPresetId} onValueChange={onPresetChange}>
              <SelectTrigger className="h-8 w-[180px] text-xs">
                <SelectValue placeholder="Choose a set" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={!selectedPresetId}
              onClick={() => onPresetApply?.('add')}
            >
              Add set
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-full px-3 text-xs"
              disabled={!selectedPresetId}
              onClick={() => onPresetApply?.('replace')}
            >
              Replace
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
