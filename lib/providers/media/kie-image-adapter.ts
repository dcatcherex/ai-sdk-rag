import 'server-only';
import { KieService } from '@/lib/providers/kieService';
import type { MediaTaskResult } from './types';

type ImageAdapterInput = {
  prompt: string;
  modelId: string;
  aspectRatio?: string;
  quality?: 'medium' | 'high';
  enablePro?: boolean;
  resolution?: '1K' | '2K' | '4K';
  googleSearch?: boolean;
  outputFormat?: 'jpg' | 'png' | 'jpeg';
  seed?: number;
  imageUrls?: string[];
};

/**
 * Build the model-specific KIE /jobs/createTask `input` object.
 * Each model has a different set of accepted parameters and field names.
 * Isolated here so feature services stay free of KIE API details.
 */
function buildKieInput(params: ImageAdapterInput): Record<string, unknown> {
  const {
    prompt,
    modelId,
    aspectRatio,
    quality = 'medium',
    enablePro = false,
    resolution = '1K',
    googleSearch = false,
    outputFormat = 'jpg',
    seed,
    imageUrls = [],
  } = params;

  switch (modelId) {
    case 'nano-banana-2':
      return {
        prompt,
        aspect_ratio: aspectRatio ?? 'auto',
        resolution,
        google_search: googleSearch,
        output_format: outputFormat === 'jpeg' ? 'jpg' : outputFormat,
        ...(imageUrls.length > 0 ? { image_input: imageUrls } : {}),
      };

    case 'nano-banana-pro':
      return {
        prompt,
        aspect_ratio: aspectRatio ?? '1:1',
        resolution,
        output_format: outputFormat === 'jpeg' ? 'jpg' : outputFormat,
        ...(imageUrls.length > 0 ? { image_input: imageUrls } : {}),
      };

    case 'google/nano-banana':
      return {
        prompt,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
      };

    case 'google/nano-banana-edit':
      return {
        prompt,
        image_urls: imageUrls,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
      };

    case 'gpt-image/1.5-text-to-image':
      return { prompt, aspect_ratio: aspectRatio ?? '1:1', quality };

    case 'gpt-image/1.5-image-to-image':
      return { prompt, aspect_ratio: aspectRatio ?? '1:1', quality, input_urls: imageUrls };

    case 'seedream/5-lite-text-to-image':
      return { prompt, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) };

    case 'seedream/5-lite-image-to-image':
      return { prompt, input_urls: imageUrls, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) };

    case 'z-image':
      return {
        prompt,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
        ...(seed !== undefined ? { seed } : {}),
      };

    case 'qwen2/text-to-image':
      return {
        prompt,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
        ...(seed !== undefined ? { seed } : {}),
      };

    case 'qwen2/image-edit':
      return {
        prompt,
        image_url: imageUrls,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
        ...(seed !== undefined ? { seed } : {}),
      };

    case 'qwen/image-edit':
      return {
        prompt,
        image_url: imageUrls,
        image_size: aspectRatio ?? '1:1',
        output_format: outputFormat === 'jpg' ? 'jpeg' : outputFormat,
        ...(seed !== undefined ? { seed } : {}),
      };

    case 'grok-imagine/text-to-image':
      return {
        prompt,
        ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
        enable_pro: enablePro,
      };

    case 'grok-imagine/image-to-image':
      return {
        prompt,
        image_urls: imageUrls,
        enable_pro: enablePro,
      };

    default:
      return { prompt };
  }
}

/**
 * Create a KIE image generation task.
 * Feature services call this instead of importing KieService directly.
 */
export async function createKieImageTask(
  params: ImageAdapterInput,
  apiKey: string,
  callbackUrl: string | null,
): Promise<MediaTaskResult> {
  const input = buildKieInput(params);
  return KieService.createTask(params.modelId, input, apiKey, { callbackUrl });
}
