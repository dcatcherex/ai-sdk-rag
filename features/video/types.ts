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
