import 'server-only';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { mediaAsset, toolRun } from '@/db/schema';
import { getStorageService, STORAGE_BUCKETS } from '@/lib/storage';
import { uploadPublicObject } from '@/lib/r2';
import { optimizeImage } from '@/lib/storage/imageOptimization';
import { safeFetch } from '@/lib/security/ssrfProtection';

const TOOL_SLUG_TO_MEDIA_TYPE: Record<string, 'image' | 'video' | 'audio'> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  speech: 'audio',
};

function resolveBucketName(toolSlug: string): string {
  switch (toolSlug) {
    case 'video':
      return STORAGE_BUCKETS.GENERATED_VIDEOS.name;
    case 'audio':
    case 'speech':
      return STORAGE_BUCKETS.GENERATED_AUDIO.name;
    default:
      return STORAGE_BUCKETS.GENERATED_IMAGES.name;
  }
}

async function persistImageWithThumbnail(toolSlug: string, sourceUrl: string) {
  const storage = getStorageService();
  const response = await safeFetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL: ${response.status}`);
  }

  const originalBuffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/png';
  const mimeType = contentType.split(';')[0]!.trim();
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin';
  const bucketName = resolveBucketName(toolSlug);
  const originalFileName = `gen-${Date.now()}-${nanoid(7)}.${ext}`;
  const originalKey = `${bucketName}/${originalFileName}`;
  const { url: publicUrl } = await uploadPublicObject({
    key: originalKey,
    body: originalBuffer,
    contentType,
  });

  const thumbnail = await optimizeImage(originalBuffer, {
    format: 'webp',
    quality: 72,
    effort: 4,
    maxWidth: 480,
    maxHeight: 480,
    enableLogging: false,
  });
  const thumbnailFileName = originalFileName.replace(/\.[^.]+$/, thumbnail.extension);
  const thumbnailKey = `${bucketName}/thumb-${thumbnailFileName}`;
  const { url: thumbnailUrl } = await uploadPublicObject({
    key: thumbnailKey,
    body: thumbnail.buffer,
    contentType: thumbnail.contentType,
    cacheControl: 'public, max-age=31536000, immutable',
  });

  const sharp = (await import('sharp')).default;
  const metadata = await sharp(originalBuffer).metadata();

  return {
    sourceUrl,
    publicUrl,
    r2Key: originalKey,
    mimeType,
    sizeBytes: originalBuffer.length,
    thumbnailKey,
    thumbnailUrl,
    width: metadata.width ?? null,
    height: metadata.height ?? null,
  };
}

export async function persistToolRunOutputToStorage(params: {
  generationId: string;
  toolSlug: string;
  userId: string;
  outputJson: Record<string, unknown>;
  sourceUrl: string;
}) {
  const { generationId, toolSlug, userId, outputJson, sourceUrl } = params;
  const persisted = toolSlug === 'image'
    ? await persistImageWithThumbnail(toolSlug, sourceUrl)
    : await (async () => {
        const storage = getStorageService();
        const uploaded = await storage.uploadFromUrl(resolveBucketName(toolSlug), sourceUrl);
        return {
          sourceUrl,
          publicUrl: uploaded.publicUrl,
          r2Key: uploaded.r2Key,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          thumbnailKey: null,
          thumbnailUrl: null,
          width: null,
          height: null,
        };
      })();

  await db
    .update(toolRun)
    .set({
      outputJson: {
        ...outputJson,
        sourceOutput: sourceUrl,
        output: persisted.publicUrl,
        outputs: [persisted.publicUrl],
        ...(persisted.thumbnailUrl ? { thumbnailUrl: persisted.thumbnailUrl, thumbnailUrls: [persisted.thumbnailUrl] } : {}),
        ...(persisted.width ? { width: persisted.width } : {}),
        ...(persisted.height ? { height: persisted.height } : {}),
      },
    })
    .where(eq(toolRun.id, generationId));

  await db.insert(mediaAsset).values({
    id: nanoid(),
    userId,
    type: TOOL_SLUG_TO_MEDIA_TYPE[toolSlug] ?? 'image',
    r2Key: persisted.r2Key,
    url: persisted.publicUrl,
    thumbnailKey: persisted.thumbnailKey,
    thumbnailUrl: persisted.thumbnailUrl,
    mimeType: persisted.mimeType,
    width: persisted.width,
    height: persisted.height,
    sizeBytes: persisted.sizeBytes,
  }).onConflictDoNothing();

  return {
    publicUrl: persisted.publicUrl,
    r2Key: persisted.r2Key,
    mimeType: persisted.mimeType,
    sizeBytes: persisted.sizeBytes,
    thumbnailUrl: persisted.thumbnailUrl,
    width: persisted.width,
    height: persisted.height,
  };
}

export async function persistToolRunOutputsToStorage(params: {
  generationId: string;
  toolSlug: string;
  userId: string;
  outputJson: Record<string, unknown>;
  sourceUrls: string[];
}) {
  const { generationId, toolSlug, userId, outputJson, sourceUrls } = params;
  const persistedItems = await Promise.all(
    sourceUrls.map(async (sourceUrl) => {
      const persisted = toolSlug === 'image'
        ? await persistImageWithThumbnail(toolSlug, sourceUrl)
        : await (async () => {
            const storage = getStorageService();
            const uploaded = await storage.uploadFromUrl(resolveBucketName(toolSlug), sourceUrl);
            return {
              sourceUrl,
              publicUrl: uploaded.publicUrl,
              r2Key: uploaded.r2Key,
              mimeType: uploaded.mimeType,
              sizeBytes: uploaded.sizeBytes,
              thumbnailKey: null,
              thumbnailUrl: null,
              width: null,
              height: null,
            };
          })();

      await db.insert(mediaAsset).values({
        id: nanoid(),
        userId,
        type: TOOL_SLUG_TO_MEDIA_TYPE[toolSlug] ?? 'image',
        r2Key: persisted.r2Key,
        url: persisted.publicUrl,
        thumbnailKey: persisted.thumbnailKey,
        thumbnailUrl: persisted.thumbnailUrl,
        mimeType: persisted.mimeType,
        width: persisted.width,
        height: persisted.height,
        sizeBytes: persisted.sizeBytes,
      }).onConflictDoNothing();

      return persisted;
    }),
  );

  const publicUrls = persistedItems.map((item) => item.publicUrl);
  const thumbnailUrls = persistedItems.map((item) => item.thumbnailUrl).filter((value): value is string => typeof value === 'string' && value.length > 0);

  await db
    .update(toolRun)
    .set({
      outputJson: {
        ...outputJson,
        sourceOutput: sourceUrls[0] ?? null,
        sourceOutputs: sourceUrls,
        output: publicUrls[0] ?? null,
        outputs: publicUrls,
        ...(thumbnailUrls[0] ? { thumbnailUrl: thumbnailUrls[0] } : {}),
        ...(thumbnailUrls.length > 0 ? { thumbnailUrls } : {}),
      },
    })
    .where(eq(toolRun.id, generationId));

  return {
    publicUrls,
    thumbnailUrls,
  };
}
