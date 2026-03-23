import type { BaseModelConfig } from '@/features/image/types';
import type { KieVideoOptions } from '@/types/execution';
import { KIE_VIDEO_MODELS } from '@/lib/models/kie-video';

export type { BaseModelConfig, KieVideoOptions };

export interface VideoGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  generationId?: string;
  taskId?: string;
  output?: string;
  error?: string;
}

/** Full video model config: UI metadata + API capability options */
export interface VideoModelConfig extends BaseModelConfig {
  videoOptions: KieVideoOptions;
  creditCost: number;
  maxPromptLength: number;
}

export const VEO_GENERATION_MODE_LABELS: Record<string, string> = {
  TEXT_2_VIDEO: 'Text to Video',
  FIRST_AND_LAST_FRAMES_2_VIDEO: 'Frame Control',
  REFERENCE_2_VIDEO: 'Reference',
};

/**
 * Derived from KIE_VIDEO_MODELS — single source of truth.
 * Only models that have videoOptions are included (all video models should).
 */
export const VIDEO_MODEL_CONFIGS: VideoModelConfig[] = KIE_VIDEO_MODELS
  .filter(m => m.videoOptions !== undefined)
  .map(m => ({
    id: m.id,
    name: m.name,
    description: m.description,
    provider: m.videoOptions!.iconProvider,
    badge: m.videoOptions!.badge,
    videoOptions: m.videoOptions!,
    creditCost: m.costPerGeneration ?? 0,
    maxPromptLength: m.maxPromptLength ?? 10000,
  }));
