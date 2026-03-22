import type { BaseModelConfig } from '@/features/image/types';

export type { BaseModelConfig };

export interface VideoGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  generationId?: string;
  taskId?: string;
  output?: string;
  error?: string;
}

export const VEO_GENERATION_MODE_LABELS: Record<string, string> = {
  TEXT_2_VIDEO: 'Text to Video',
  FIRST_AND_LAST_FRAMES_2_VIDEO: 'Frame Control',
  REFERENCE_2_VIDEO: 'Reference',
};

export const VIDEO_MODEL_CONFIGS: BaseModelConfig[] = [
  {
    id: 'veo3_fast',
    name: 'Veo 3 Fast',
    description: 'Fast generation, supports all modes including frame control and reference',
    badge: 'Default',
    provider: 'google',
  },
  {
    id: 'veo3',
    name: 'Veo 3 Quality',
    description: 'Higher quality output, text-to-video only',
    badge: 'Quality',
    provider: 'google',
  },
];
