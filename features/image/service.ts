import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun, mediaAsset } from '@/db/schema';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { buildKieCallbackUrl } from '@/lib/kie-callback';
import { createKieImageTask } from '@/lib/providers/media/kie-image-adapter';
import { createMediaRun } from '@/lib/generation/create-media-run';
import type { GenerateImageInput, TriggerImageResult } from './schema';

function isTemporaryProviderImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return (
      hostname.endsWith('oaiusercontent.com') ||
      hostname.endsWith('oausercontent.com') ||
      (hostname === 'storage.googleapis.com' && pathname.includes('/generativeai-filters/'))
    );
  } catch {
    return false;
  }
}

/**
 * When an external image URL is inaccessible (e.g., expired temporary URL),
 * try to find a persisted R2 copy in the user's toolRun records by matching
 * sourceOutput or a mediaAsset whose original URL matches.
 */
async function findR2UrlForExpiredSource(expiredUrl: string, userId: string): Promise<string | null> {
  const r2Base = process.env.R2_PUBLIC_BASE_URL ?? '';

  // 1. Look for a toolRun where sourceOutput matches and output is an R2 URL
  try {
    const rows = await db
      .select({ id: toolRun.id, outputJson: toolRun.outputJson })
      .from(toolRun)
      .where(and(eq(toolRun.userId, userId), eq(toolRun.toolSlug, 'image'), eq(toolRun.status, 'success')))
      .limit(200);

    for (const row of rows) {
      const json = row.outputJson as Record<string, unknown> | null;
      if (!json) continue;
      const sourceOutput = typeof json.sourceOutput === 'string' ? json.sourceOutput : null;
      const output = typeof json.output === 'string' ? json.output : null;
      if (sourceOutput === expiredUrl && output && r2Base && output.startsWith(r2Base)) {
        return output;
      }
      // Also check sourceOutputs array for multi-image generations
      if (Array.isArray(json.sourceOutputs) && json.sourceOutputs.includes(expiredUrl)) {
        const outputs = Array.isArray(json.outputs) ? json.outputs as string[] : [];
        const idx = (json.sourceOutputs as string[]).indexOf(expiredUrl);
        if (outputs[idx] && r2Base && outputs[idx]!.startsWith(r2Base)) {
          return outputs[idx]!;
        }
      }
    }
  } catch {
    // DB lookup failure is non-fatal
  }

  // 2. Check mediaAsset records (for user-uploaded images saved to R2)
  try {
    const assets = await db
      .select({ url: mediaAsset.url })
      .from(mediaAsset)
      .where(eq(mediaAsset.userId, userId))
      .limit(200);

    // mediaAsset.url is the R2 URL; we can't directly match by original URL here
    // but if a single asset exists per message, it may have been derived from the expired URL
    // This is a best-effort lookup — only use if exactly one R2 asset found with a recent key
    const r2Assets = assets.filter(a => r2Base && a.url.startsWith(r2Base));
    if (r2Assets.length === 0) return null;
  } catch {
    // non-fatal
  }

  return null;
}

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
        aspect_ratio: aspectRatio ?? '1:1',
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
 * Canonical image generation logic.
 * Called by the API route, agent adapter, and chat route.
 * Uploads base64 images to R2 before creating the KIE task.
 */
export async function triggerImageGeneration(
  params: GenerateImageInput & { promptTitle?: string },
  userId: string,
  options?: { threadId?: string; source?: string; referenceImageUrls?: string[] },
): Promise<TriggerImageResult> {
  const apiKey = getKieApiKey();
  if (!apiKey) throw new Error('KIE_API_KEY is not configured');

  console.log('[IMG-URL-TRACE] triggerImageGeneration called', {
    modelId: params.modelId,
    imageUrls: params.imageUrls?.map(u => u.substring(0, 80)),
  });

  const sanitizedEnablePro = params.modelId.startsWith('grok-imagine/')
    ? params.enablePro
    : undefined;

  // Normalize reference images to stable R2 URLs when possible.
  let resolvedImageUrls: string[] | undefined;
  let reusedR2Count = 0;
  let mirroredExternalCount = 0;
  let uploadedBase64Count = 0;
  if (params.imageUrls && params.imageUrls.length > 0) {
    const { getStorageService, STORAGE_BUCKETS } = await import('@/lib/storage/index');
    const storage = getStorageService();
    const r2PublicBase = process.env.R2_PUBLIC_BASE_URL ?? '';
    resolvedImageUrls = [];

    for (let i = 0; i < params.imageUrls.length; i++) {
      const originalImgData = params.imageUrls[i]!;
      const imgData = isTemporaryProviderImageUrl(originalImgData) && options?.referenceImageUrls?.[i]
        ? options.referenceImageUrls[i]!
        : originalImgData;
      if (imgData.startsWith('http')) {
        if (r2PublicBase && imgData.startsWith(r2PublicBase)) {
          resolvedImageUrls.push(imgData);
          reusedR2Count += 1;
          continue;
        }

        try {
          const mirrored = await storage.uploadFromUrl(
            STORAGE_BUCKETS.CUSTOM_REFERENCES.name,
            imgData,
          );
          resolvedImageUrls.push(mirrored.publicUrl);
          mirroredExternalCount += 1;
        } catch (mirrorError) {
          // URL is inaccessible (expired temporary URL from OpenAI/Google/etc.).
          // Try to find a persisted R2 copy in the user's toolRun records first.
          const r2Replacement = await findR2UrlForExpiredSource(imgData, userId);
          if (r2Replacement) {
            resolvedImageUrls.push(r2Replacement);
            reusedR2Count += 1;
            console.info('[image] used r2 replacement for expired url', { original: imgData, r2: r2Replacement });
          } else {
            throw new Error(
              `Reference image URL is no longer accessible. Please re-upload the image or attach it directly in the chat.`,
              { cause: mirrorError instanceof Error ? mirrorError : undefined },
            );
          }
        }
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
      uploadedBase64Count += 1;
    }
  }

  const callbackUrl = buildKieCallbackUrl();
  const { taskId } = await createKieImageTask(
    {
      ...params,
      enablePro: sanitizedEnablePro,
      imageUrls: resolvedImageUrls ?? params.imageUrls,
    },
    apiKey,
    callbackUrl,
  );

  const { generationId } = await createMediaRun({
    toolSlug: 'image',
    userId,
    threadId: options?.threadId,
    source: options?.source,
    inputJson: {
      prompt: params.prompt,
      modelId: params.modelId,
      kieTaskId: taskId,
      kieProvider: 'kie',
      callbackUrl,
      aspectRatio: params.aspectRatio,
      quality: params.quality,
      enablePro: sanitizedEnablePro,
      resolution: params.resolution,
      imageUrls: resolvedImageUrls,
      referenceImageStats: {
        originalCount: params.imageUrls?.length ?? 0,
        resolvedCount: resolvedImageUrls?.length ?? 0,
        reusedR2Count,
        mirroredExternalCount,
        uploadedBase64Count,
      },
      promptTitle: params.promptTitle ?? params.prompt.substring(0, 50),
    },
  });

  console.info('[image] generation_started', {
    generationId,
    taskId,
    modelId: params.modelId,
    threadId: options?.threadId ?? null,
    source: options?.source ?? 'api',
    hasReferenceImages: (resolvedImageUrls?.length ?? 0) > 0,
    referenceImageStats: {
      originalCount: params.imageUrls?.length ?? 0,
      resolvedCount: resolvedImageUrls?.length ?? 0,
      reusedR2Count,
      mirroredExternalCount,
      uploadedBase64Count,
    },
  });

  return { taskId, generationId };
}
