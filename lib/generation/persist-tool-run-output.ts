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
