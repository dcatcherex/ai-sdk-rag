'use client';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CompactAspectRatioSelect } from '@/features/image/ui/compact-aspect-ratio-select';
import { VEO_GENERATION_MODE_LABELS } from '../types';
import type { KieVideoOptions } from '@/types/execution';

interface Props {
  videoOptions: KieVideoOptions;
  aspectRatio: string;
  onAspectRatioChange: (v: string) => void;
  veoMode: string;
  onVeoModeChange: (v: string) => void;
  duration: string;
  onDurationChange: (v: string) => void;
  quality: string;
  onQualityChange: (v: string) => void;
  resolution: string;
  onResolutionChange: (v: string) => void;
  disabled?: boolean;
}

const QUALITY_LABELS: Record<string, string> = {
  standard: 'Standard', high: 'High', std: 'Standard', pro: 'Pro',
  normal: 'Normal', fun: 'Fun', spicy: 'Spicy',
};

const isVeoModel = (opts: KieVideoOptions) => opts.apiType === 'veo';
const showVeoModes = (opts: KieVideoOptions) =>
  isVeoModel(opts) && (opts.veoModes?.length ?? 0) > 1;

export function VideoGenerationControls({
  videoOptions, aspectRatio, onAspectRatioChange,
  veoMode, onVeoModeChange, duration, onDurationChange,
  quality, onQualityChange, resolution, onResolutionChange,
  disabled,
}: Props) {
  const isVeo = isVeoModel(videoOptions);
  const hasVeoModes = showVeoModes(videoOptions);
  const hideAspectRatio = isVeo && veoMode === 'REFERENCE_2_VIDEO';
  const showCompactRow =
    (videoOptions.aspectRatios && !hideAspectRatio) || hasVeoModes;
  const hasSettings =
    !!videoOptions.duration || !!videoOptions.quality || !!videoOptions.resolution;

  return (
    <div className="space-y-4">
      {/* Compact row: aspect ratio + veo mode */}
      {showCompactRow && (
        <div className="flex items-center gap-2 flex-wrap">
          {videoOptions.aspectRatios && !hideAspectRatio && (
            <CompactAspectRatioSelect
              ratios={videoOptions.aspectRatios}
              value={aspectRatio}
              onChange={onAspectRatioChange}
            />
          )}
          {videoOptions.aspectRatios && !hideAspectRatio && hasVeoModes && (
            <div className="w-px h-5 bg-border mx-0.5" />
          )}
          {hasVeoModes && (
            <Select value={veoMode} onValueChange={onVeoModeChange} disabled={disabled}>
              <SelectTrigger className="h-7 w-auto gap-1.5 px-2.5 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {videoOptions.veoModes!.map(m => (
                  <SelectItem key={m} value={m} className="text-xs">
                    {VEO_GENERATION_MODE_LABELS[m] ?? m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
      {isVeo && veoMode === 'REFERENCE_2_VIDEO' && (
        <p className="text-xs text-muted-foreground">
          Reference mode is locked to 16:9 and requires veo3_fast.
        </p>
      )}

      {/* Video settings box */}
      {hasSettings && (
        <div className="space-y-3 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Video settings
          </p>

          {videoOptions.duration && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Duration</span>
              <div className="flex gap-1.5 flex-wrap">
                {videoOptions.duration.map(d => (
                  <button
                    key={d}
                    onClick={() => onDurationChange(d)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md border px-3 py-1 text-xs transition-colors',
                      duration === d
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/40',
                    )}
                  >
                    {d}s
                  </button>
                ))}
              </div>
            </div>
          )}

          {videoOptions.quality && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">
                {videoOptions.quality.param === 'mode' ? 'Mode' : 'Quality'}
              </span>
              <div className="flex gap-1.5 flex-wrap">
                {videoOptions.quality.values.map(q => (
                  <button
                    key={q}
                    onClick={() => onQualityChange(q)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md border px-3 py-1 text-xs capitalize transition-colors',
                      quality === q
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/40',
                    )}
                  >
                    {QUALITY_LABELS[q] ?? q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {videoOptions.resolution && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground w-16 shrink-0">Resolution</span>
              <div className="flex gap-1.5 flex-wrap">
                {videoOptions.resolution.values.map(r => (
                  <button
                    key={r}
                    onClick={() => onResolutionChange(r)}
                    disabled={disabled}
                    className={cn(
                      'rounded-md border px-3 py-1 text-xs transition-colors',
                      resolution === r
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/40',
                    )}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
