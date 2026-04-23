import type { KieImageOptions } from '@/types/execution';
import { KIE_IMAGE_MODELS } from '@/lib/models/kie-image';

export type { KieImageOptions };

export type ImageProvider = 'kie' | 'openai' | 'qwen' | 'xai' | 'bytedance';

/** Minimal shape needed by the shared ModelSelector component */
export interface BaseModelConfig {
  id: string;
  name: string;
  description?: string;
  badge?: string;
  provider: string;
}

/**
 * Full image model config used by the UI hook and generation controls.
 * Derived from KIE_IMAGE_MODELS — do not maintain separately.
 */
export interface ImageModelConfig extends BaseModelConfig {
  provider: string;
  mode: 'generate' | 'edit' | 'both';
  aspectRatios: string[];
  hasQuality?: boolean;
  hasEnablePro?: boolean;
  hasResolution?: boolean;
  hasGoogleSearch?: boolean;
  hasSeed?: boolean;
  requiresImages?: boolean;
  /**
   * Default/minimum credit cost. For tiered models this equals the cheapest
   * tier (the pricingTiers.default cost). Use resolveImageCredits() to get
   * the actual cost for a given selection.
   */
  creditCost: number;
  pricingTiers?: KieImageOptions['pricingTiers'];
  aspectRatioParam?: string;
}

/**
 * Resolves the actual credit cost for an image generation based on the
 * user's selected options. Falls back to the flat creditCost when no
 * pricingTiers are defined.
 */
export function resolveImageCredits(
  config: Pick<ImageModelConfig, 'creditCost' | 'pricingTiers'>,
  selected: { resolution?: string; quality?: string },
): number {
  if (config.pricingTiers) {
    const { param, map, default: fallback } = config.pricingTiers;
    const key = (param === 'resolution' ? selected.resolution : selected.quality) ?? fallback;
    return map[key] ?? map[fallback] ?? 0;
  }
  return config.creditCost;
}

/**
 * Derived from KIE_IMAGE_MODELS — single source of truth.
 * Only models that have imageOptions are included (all image models should).
 */
export const IMAGE_MODEL_CONFIGS: ImageModelConfig[] = KIE_IMAGE_MODELS
  .filter(m => m.imageOptions !== undefined)
  .map(m => {
    const opts = m.imageOptions!;
    const creditCost = opts.pricingTiers
      ? (opts.pricingTiers.map[opts.pricingTiers.default] ?? 0)
      : (opts.creditCost ?? 0);
    return {
      id: m.id,
      name: m.name,
      description: m.description,
      badge: opts.badge,
      provider: opts.iconProvider,
      mode: opts.mode,
      aspectRatios: opts.aspectRatios ?? ['auto'],
      hasQuality: opts.hasQuality,
      hasEnablePro: opts.hasEnablePro,
      hasResolution: opts.hasResolution,
      hasGoogleSearch: opts.hasGoogleSearch,
      hasSeed: opts.hasSeed,
      requiresImages: opts.requiresImages,
      creditCost,
      pricingTiers: opts.pricingTiers,
      aspectRatioParam: opts.aspectRatioParam,
    };
  });

/** Maps aspect ratio string → [width, height] for visual preview boxes */
export const ASPECT_RATIO_DIMS: Record<string, [number, number]> = {
  'auto':      [28, 22],
  'Auto':      [28, 22],
  '1:1':       [24, 24],
  '16:9':      [32, 18],
  '9:16':      [18, 32],
  '4:3':       [28, 21],
  '3:4':       [21, 28],
  '2:3':       [20, 30],
  '3:2':       [30, 20],
  '21:9':      [34, 14],
  '4:5':       [22, 28],
  '5:4':       [28, 22],
  '1:4':       [14, 32],
  '4:1':       [32, 14],
  // Video model aliases
  'landscape': [32, 18],
  'portrait':  [18, 32],
  '1:8':       [12, 32],
};

export interface ImageGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout' | 'delayed';
  output?: string;
  outputs?: string[];
  error?: string;
  generationId?: string;
}
