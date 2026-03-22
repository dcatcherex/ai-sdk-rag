import type { BaseModelConfig } from '@/features/image/types';

export type { BaseModelConfig };

export const MUSIC_MODEL_CONFIGS: BaseModelConfig[] = [
  {
    id: 'suno-v4',
    name: 'Suno V4',
    description: 'AI music generation with improved vocals. Max 4 minutes.',
    provider: 'suno',
  },
  {
    id: 'suno-v4.5',
    name: 'Suno V4.5',
    description: 'Smart prompts, richer sound. Max 8 minutes, faster generation.',
    badge: 'Recommended',
    provider: 'suno',
  },
  {
    id: 'suno-v5',
    name: 'Suno V5',
    description: 'Latest model — superior musicality, faster generation. Max 8 minutes.',
    badge: 'New',
    provider: 'suno',
  },
];

export interface AudioTrack {
  id: string;
  audioUrl: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
  prompt: string;
}

export interface AudioMeta {
  audioUrl: string;
  imageUrl?: string;
  title: string;
  tags: string;
  duration: number;
  tracks: AudioTrack[];
}

export interface AudioGenerationState {
  status: 'idle' | 'polling' | 'success' | 'failed' | 'timeout';
  generationId?: string;
  taskId?: string;
  output?: string;
  audioMeta?: AudioMeta;
  error?: string;
}
