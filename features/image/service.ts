import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import type { GenerateImageInput, TriggerImageResult } from './schema';

/**
 * Build the model-specific KIE /jobs/createTask `input` object.
 * Each model has a different set of accepted parameters and field names.
 */
function buildKieInput(params: GenerateImageInput): Record<string, unknown> {
  const {
    prompt,
    modelId,
    aspectRatio,
    quality = 'medium',
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
      return { prompt, ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}) };

    default:
      return { prompt };
  }
}

/**
 * Canonical image generation logic.
 * Called by the API route and agent adapter.
 * Uploads base64 images to R2 before creating the KIE task.
 */
export async function triggerImageGeneration(
  params: GenerateImageInput & { promptTitle?: string },
  userId: string,
): Promise<TriggerImageResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  // Upload base64 images to R2, pass through existing https URLs
  let resolvedImageUrls: string[] | undefined;
  if (params.imageUrls && params.imageUrls.length > 0) {
    const { getStorageService, STORAGE_BUCKETS } = await import('@/lib/storage/index');
    const storage = getStorageService();
    resolvedImageUrls = [];

    for (let i = 0; i < params.imageUrls.length; i++) {
      const imgData = params.imageUrls[i]!;
      if (imgData.startsWith('http')) {
        resolvedImageUrls.push(imgData);
        continue;
      }
      let contentType = 'image/png';
      if (imgData.startsWith('data:')) {
        const match = imgData.match(/^data:(image\/[a-z]+);base64,/);
        if (match) contentType = match[1]!;
      }
      const ext = contentType.split('/')[1] ?? 'png';
      const filename = `image-inputs/${Date.now()}-${i}.${ext}`;
      const { publicUrl } = await storage.uploadBase64(
        STORAGE_BUCKETS.CUSTOM_REFERENCES.name,
        imgData,
        { contentType, filename },
      );
      resolvedImageUrls.push(publicUrl);
    }
  }

  const input = buildKieInput({ ...params, imageUrls: resolvedImageUrls ?? params.imageUrls });
  const { taskId } = await KieService.createTask(params.modelId, input, apiKey);

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: 'image',
    userId,
    source: 'api',
    status: 'pending',
    inputJson: {
      prompt: params.prompt,
      modelId: params.modelId,
      kieTaskId: taskId,
      kieProvider: 'kie',
      aspectRatio: params.aspectRatio,
      quality: params.quality,
      resolution: params.resolution,
      imageUrls: resolvedImageUrls,
      promptTitle: params.promptTitle ?? params.prompt.substring(0, 50),
    },
  }).returning();

  return { taskId, generationId: record!.id };
}
