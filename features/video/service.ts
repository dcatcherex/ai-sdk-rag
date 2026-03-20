import 'server-only';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { KieService } from '@/lib/providers/kieService';
import type { GenerateVideoInput, TriggerVideoResult } from './schema';

/**
 * Canonical video generation logic.
 * Called by the API route and agent adapter.
 * Handles base64 image upload to R2 before creating the KIE task.
 */
export async function triggerVideoGeneration(
  params: GenerateVideoInput & { promptTitle?: string },
  userId: string,
): Promise<TriggerVideoResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  const {
    prompt,
    model = 'veo3_fast',
    generationMode = 'TEXT_2_VIDEO',
    aspectRatio = '16:9',
    imageUrls,
    seeds,
  } = params;

  // Force veo3_fast for reference mode
  const veoModel: 'veo3' | 'veo3_fast' =
    model === 'veo3' && generationMode !== 'REFERENCE_2_VIDEO' ? 'veo3' : 'veo3_fast';

  // Force 16:9 for reference mode
  const veoAspect: '16:9' | '9:16' | 'Auto' =
    generationMode === 'REFERENCE_2_VIDEO' ? '16:9' : aspectRatio;

  // Resolve images — upload base64 to R2, pass through existing URLs
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

  const { taskId } = await KieService.createVeoTask({
    prompt,
    model: veoModel,
    aspectRatio: veoAspect,
    generationType: generationMode,
    imageUrls: resolvedImageUrls?.length ? resolvedImageUrls : undefined,
    seeds,
  }, apiKey);

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
      kieProvider: 'kie',
      veoModel,
      generationMode,
      aspectRatio: veoAspect,
      imageUrls: resolvedImageUrls,
      seeds,
      promptTitle: params.promptTitle ?? prompt.substring(0, 50),
    },
  }).returning();

  return { taskId, generationId: record.id };
}
