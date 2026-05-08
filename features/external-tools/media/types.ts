import type { MediaJobKind } from '@/lib/generation/media-job-types';

export type { MediaJobKind };

/** Raw shape of toolRun.outputJson written by the KIE media pipeline */
export type KieOutputJson = {
  kieTaskId?: string;
  providerRunId?: string;
  output?: string;
  outputs?: string[];
  thumbnailUrl?: string;
  thumbnailUrls?: string[];
  latency?: number;
  callbackReceived?: boolean;
  error?: string;
  // model-specific extras (audioMeta, width, height, etc.) are additive
  [key: string]: unknown;
};

/** Vaja-side view of a media job — used by status endpoints and chat hydration */
export type MediaJobStatus = {
  generationId: string;
  toolSlug: string;
  kind: MediaJobKind;
  status: 'pending' | 'success' | 'error';
  outputUrls: string[];
  thumbnailUrls: string[];
  providerRunId?: string;
  latency?: number;
  error?: string;
  createdAt: string;
  completedAt: string | null;
};
