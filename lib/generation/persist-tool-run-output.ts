import 'server-only';

import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { mediaAsset, toolRun } from '@/db/schema';
import { getStorageService, STORAGE_BUCKETS } from '@/lib/storage';

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

export async function persistToolRunOutputToStorage(params: {
  generationId: string;
  toolSlug: string;
  userId: string;
  outputJson: Record<string, unknown>;
  sourceUrl: string;
}) {
  const { generationId, toolSlug, userId, outputJson, sourceUrl } = params;
  const storage = getStorageService();
  const { publicUrl, r2Key, mimeType, sizeBytes } = await storage.uploadFromUrl(
    resolveBucketName(toolSlug),
    sourceUrl,
  );

  await db
    .update(toolRun)
    .set({
      outputJson: {
        ...outputJson,
        sourceOutput: sourceUrl,
        output: publicUrl,
      },
    })
    .where(eq(toolRun.id, generationId));

  await db.insert(mediaAsset).values({
    id: nanoid(),
    userId,
    type: TOOL_SLUG_TO_MEDIA_TYPE[toolSlug] ?? 'image',
    r2Key,
    url: publicUrl,
    mimeType,
    sizeBytes,
  }).onConflictDoNothing();

  return {
    publicUrl,
    r2Key,
    mimeType,
    sizeBytes,
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
      const storage = getStorageService();
      const persisted = await storage.uploadFromUrl(resolveBucketName(toolSlug), sourceUrl);

      await db.insert(mediaAsset).values({
        id: nanoid(),
        userId,
        type: TOOL_SLUG_TO_MEDIA_TYPE[toolSlug] ?? 'image',
        r2Key: persisted.r2Key,
        url: persisted.publicUrl,
        mimeType: persisted.mimeType,
        sizeBytes: persisted.sizeBytes,
      }).onConflictDoNothing();

      return {
        sourceUrl,
        publicUrl: persisted.publicUrl,
      };
    }),
  );

  const publicUrls = persistedItems.map((item) => item.publicUrl);

  await db
    .update(toolRun)
    .set({
      outputJson: {
        ...outputJson,
        sourceOutput: sourceUrls[0] ?? null,
        sourceOutputs: sourceUrls,
        output: publicUrls[0] ?? null,
        outputs: publicUrls,
      },
    })
    .where(eq(toolRun.id, generationId));

  return {
    publicUrls,
  };
}
