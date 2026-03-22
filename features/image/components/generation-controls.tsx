'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CompactAspectRatioSelect } from '../ui/compact-aspect-ratio-select';
import { CompactResolutionSelect } from '../ui/compact-resolution-select';
import { ImageCountStepper } from '../ui/image-count-stepper';
import type { ImageModelConfig } from '../types';

interface Props {
  modelConfig: ImageModelConfig;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  resolution: '1K' | '2K' | '4K';
  onResolutionChange: (v: '1K' | '2K' | '4K') => void;
  imageCount: number;
  onImageCountChange: (v: number) => void;
  quality: 'medium' | 'high';
  onQualityChange: (v: 'medium' | 'high') => void;
  googleSearch: boolean;
  onGoogleSearchChange: (v: boolean) => void;
  seed: string;
  onSeedChange: (v: string) => void;
  disabled?: boolean;
}

export function GenerationControls({
  modelConfig, aspectRatio, onAspectRatioChange,
  resolution, onResolutionChange, imageCount, onImageCountChange,
  quality, onQualityChange, googleSearch, onGoogleSearchChange,
  seed, onSeedChange, disabled,
}: Props) {
  const hasModelSettings = modelConfig.hasQuality || modelConfig.hasGoogleSearch || modelConfig.hasSeed;

  return (
    <div className="space-y-4">
      {/* Compact controls row: count · aspect ratio · resolution */}
      <div className="flex items-center gap-2 flex-wrap">
        <ImageCountStepper value={imageCount} onChange={onImageCountChange} />
        <div className="w-px h-5 bg-border mx-0.5" />
        <CompactAspectRatioSelect
          ratios={modelConfig.aspectRatios}
          value={aspectRatio}
          onChange={onAspectRatioChange}
        />
        {modelConfig.hasResolution && (
          <CompactResolutionSelect value={resolution} onChange={onResolutionChange} />
        )}
      </div>

      {/* Model-specific settings */}
      {hasModelSettings && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Model settings</p>

          {modelConfig.hasQuality && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Quality</span>
              <div className="flex gap-1.5">
                {(['medium', 'high'] as const).map(q => (
                  <button key={q} onClick={() => onQualityChange(q)} disabled={disabled}
                    className={cn(
                      'rounded-md border px-3 py-1 text-xs capitalize transition-colors',
                      quality === q ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/40',
                    )}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {modelConfig.hasGoogleSearch && (
            <div className="flex items-center gap-3">
              <Switch id="gsearch" checked={googleSearch} onCheckedChange={onGoogleSearchChange} disabled={disabled} />
              <div>
                <Label htmlFor="gsearch" className="flex items-center gap-1 text-xs">
                  <Search className="h-3 w-3" /> Google Search grounding
                </Label>
                <p className="text-xs text-muted-foreground">Generate based on real-time information</p>
              </div>
            </div>
          )}

          {modelConfig.hasSeed && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-14">Seed</span>
              <Input
                id="seed" type="number" placeholder="e.g. 42"
                value={seed} onChange={e => onSeedChange(e.target.value)}
                disabled={disabled} className="h-7 text-xs flex-1"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
