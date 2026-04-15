import 'server-only';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { buildKieCallbackUrl } from '@/lib/kie-callback';
import { KIE_VIDEO_MODELS } from '@/lib/models/kie-video';
import { createKieVideoTask } from '@/lib/providers/media/kie-video-adapter';
import { createMediaRun } from '@/lib/generation/create-media-run';
import type { GenerateVideoInput, TriggerVideoResult } from './schema';

/**
 * Canonical video generation logic.
 * Reads videoOptions from KIE_VIDEO_MODELS to route to the correct API
 * and build the correct payload — no per-model hardcoding here.
 */
export async function triggerVideoGeneration(
  params: GenerateVideoInput & { promptTitle?: string },
  userId: string,
  options?: { threadId?: string; source?: string },
): Promise<TriggerVideoResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const modelDef = KIE_VIDEO_MODELS.find(m => m.id === params.model);
  if (!modelDef?.videoOptions) {
    throw new Error(`Unknown video model: ${params.model}`);
  }

  const { videoOptions } = modelDef;
  const {
    prompt,
    model = 'veo3_fast',
    generationMode = 'TEXT_2_VIDEO',
    aspectRatio,
    imageUrls,
    seeds,
    duration,
    quality,
    resolution,
  } = params;

  // Upload base64 images to R2 and return public URLs
  let resolvedImageUrls: string[] | undefined;
  if (imageUrls && imageUrls.length > 0) {
    const { getStorageService, STORAGE_BUCKETS } = await import('@/lib/storage/index');
    const storage = getStorageService();
    resolvedImageUrls = [];

    for (let i = 0; i < imageUrls.length; i++) {
      const imgData = imageUrls[i]!;
      if (imgData.startsWith('http')) {
        resolvedImageUrls.push(imgData);
        continue;
      }
      let contentType = 'image/png';
      if (imgData.startsWith('data:')) {
        const match = imgData.match(/^data:(image\/[a-z]+);base64,/);
        if (match) contentType = match[1]!;
      }
      const ext = contentType.split('/')[1] || 'png';
      const filename = `video-inputs/${Date.now()}-${i}.${ext}`;
      const { publicUrl } = await storage.uploadBase64(
        STORAGE_BUCKETS.CUSTOM_REFERENCES.name,
        imgData,
        { contentType, filename },
      );
      resolvedImageUrls.push(publicUrl);
    }
  }

  const callbackUrl = buildKieCallbackUrl();

  const { taskId } = await createKieVideoTask(
    { prompt, model, generationMode, aspectRatio, imageUrls: resolvedImageUrls, seeds, duration, quality, resolution },
    videoOptions,
    apiKey,
    callbackUrl,
  );

  const { generationId } = await createMediaRun({
    toolSlug: 'video',
    userId,
    threadId: options?.threadId,
    source: options?.source,
    inputJson: {
      prompt,
      modelId: model,
      kieTaskId: taskId,
      callbackUrl,
      apiType: videoOptions.apiType,
      generationMode,
      aspectRatio,
      duration,
      quality,
      imageUrls: resolvedImageUrls,
      seeds,
      promptTitle: params.promptTitle ?? prompt.substring(0, 50),
    },
  });

  return { taskId, generationId };
}
