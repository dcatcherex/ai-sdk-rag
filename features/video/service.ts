import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import { KIE_VIDEO_MODELS } from '@/lib/models/kie-video';
import type { GenerateVideoInput, TriggerVideoResult } from './schema';

/**
 * Canonical video generation logic.
 * Reads videoOptions from KIE_VIDEO_MODELS to route to the correct API
 * and build the correct payload — no per-model hardcoding here.
 */
export async function triggerVideoGeneration(
  params: GenerateVideoInput & { promptTitle?: string },
  userId: string,
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

  let taskId: string;

  if (videoOptions.apiType === 'veo') {
    // ── Veo path: flat payload, special /veo/generate endpoint ──────────────
    const veoModel: 'veo3' | 'veo3_fast' =
      model === 'veo3' && generationMode !== 'REFERENCE_2_VIDEO' ? 'veo3' : 'veo3_fast';
    const veoAspect = generationMode === 'REFERENCE_2_VIDEO'
      ? '16:9'
      : (aspectRatio as '16:9' | '9:16' | 'Auto') ?? '16:9';

    ({ taskId } = await KieService.createVeoTask({
      prompt,
      model: veoModel,
      aspectRatio: veoAspect,
      generationType: generationMode as 'TEXT_2_VIDEO' | 'FIRST_AND_LAST_FRAMES_2_VIDEO' | 'REFERENCE_2_VIDEO',
      imageUrls: resolvedImageUrls?.length ? resolvedImageUrls : undefined,
      seeds,
    }, apiKey));

  } else {
    // ── Standard path: nested input object, /jobs/createTask endpoint ────────
    const input: Record<string, unknown> = {};

    if (videoOptions.promptRequired) {
      input.prompt = prompt;
    }

    // Aspect ratio (Sora uses portrait/landscape; Kling derives from image)
    if (videoOptions.aspectRatios && aspectRatio) {
      input.aspect_ratio = aspectRatio;
    }

    // Duration (param name differs: Sora/Kling use 'n_frames', Grok uses 'duration')
    if (videoOptions.duration && duration) {
      input[videoOptions.durationParam ?? 'n_frames'] = duration;
    }

    // Quality param (name differs: Sora uses 'size', Kling uses 'mode', Grok uses 'mode')
    if (videoOptions.quality && quality) {
      input[videoOptions.quality.param] = quality;
    }

    // Resolution (Grok: 480p/720p)
    if (videoOptions.resolution && resolution) {
      input[videoOptions.resolution.param] = resolution;
    }

    // Images (for img2vid and storyboard models)
    const imageParamName = videoOptions.inputMode === 'storyboard' ? 'image_urls' : 'image_urls';
    if (resolvedImageUrls?.length) {
      input[imageParamName] = resolvedImageUrls;
    }

    // Watermark removal — default true for Sora models
    if (model.startsWith('sora-')) {
      input.remove_watermark = true;
    }

    ({ taskId } = await KieService.createTask(model, input, apiKey));
  }

  const [record] = await db.insert(toolRun).values({
    id: nanoid(),
    toolSlug: 'video',
    userId,
    source: 'api',
    status: 'pending',
    inputJson: {
      prompt,
      modelId: model,
      kieTaskId: taskId,
      apiType: videoOptions.apiType,
      generationMode,
      aspectRatio,
      duration,
      quality,
      imageUrls: resolvedImageUrls,
      seeds,
      promptTitle: params.promptTitle ?? prompt.substring(0, 50),
    },
  }).returning();

  return { taskId, generationId: record.id };
}
