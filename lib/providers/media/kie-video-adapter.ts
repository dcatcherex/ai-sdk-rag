import 'server-only';
import { KieService } from '@/lib/providers/kieService';
import type { KieVideoOptions } from '@/types/execution';
import type { MediaTaskResult } from './types';

type VideoAdapterInput = {
  prompt: string;
  model: string;
  generationMode?: string;
  aspectRatio?: string;
  imageUrls?: string[];
  seeds?: number;
  duration?: string;
  quality?: string;
  resolution?: string;
};

/**
 * Create a KIE video generation task.
 * Routes to the Veo endpoint or the standard /jobs/createTask endpoint
 * based on `videoOptions.apiType`. Feature services call this instead of
 * importing KieService directly.
 */
export async function createKieVideoTask(
  params: VideoAdapterInput,
  videoOptions: KieVideoOptions,
  apiKey: string,
  callbackUrl: string | null,
): Promise<MediaTaskResult> {
  const {
    prompt,
    model,
    generationMode = 'TEXT_2_VIDEO',
    aspectRatio,
    imageUrls,
    seeds,
    duration,
    quality,
    resolution,
  } = params;

  if (videoOptions.apiType === 'veo') {
    const veoModel: 'veo3' | 'veo3_fast' =
      model === 'veo3' && generationMode !== 'REFERENCE_2_VIDEO' ? 'veo3' : 'veo3_fast';
    const veoAspect = generationMode === 'REFERENCE_2_VIDEO'
      ? '16:9'
      : (aspectRatio as '16:9' | '9:16' | 'Auto') ?? '16:9';

    return KieService.createVeoTask({
      prompt,
      model: veoModel,
      aspectRatio: veoAspect,
      generationType: generationMode as 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO',
      imageUrls: imageUrls?.length ? imageUrls : undefined,
      seeds,
    }, apiKey);
  }

  // ── Standard /jobs/createTask path ──────────────────────────────────────────
  const input: Record<string, unknown> = {};

  if (videoOptions.promptRequired) {
    input.prompt = prompt;
  }

  if (videoOptions.aspectRatios && aspectRatio) {
    input.aspect_ratio = aspectRatio;
  }

  if (videoOptions.duration && duration) {
    input[videoOptions.durationParam ?? 'n_frames'] = duration;
  }

  if (videoOptions.quality && quality) {
    input[videoOptions.quality.param] = quality;
  }

  if (videoOptions.resolution && resolution) {
    input[videoOptions.resolution.param] = resolution;
  }

  const imageParamName = videoOptions.inputMode === 'storyboard' ? 'image_urls' : 'image_urls';
  if (imageUrls?.length) {
    input[imageParamName] = imageUrls;
  }

  if (model.startsWith('sora-')) {
    input.remove_watermark = true;
  }

  return KieService.createTask(model, input, apiKey, { callbackUrl });
}
