import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { imageModelConfig } from '@/db/schema';
import { IMAGE_MODEL_CONFIGS } from '@/features/image/types';
import type { ImageModelConfig } from '@/features/image/types';

// Simple in-memory cache (30 second TTL — fast enough for live admin changes)
let cache: { data: ActiveImageModel[]; expiresAt: number } | null = null;

export interface ActiveImageModel extends ImageModelConfig {
  isDefault: boolean;
  defaultAspectRatio?: string;
  defaultQuality?: 'medium' | 'high';
  defaultResolution?: '1K' | '2K' | '4K';
  defaultEnablePro: boolean;
  defaultGoogleSearch: boolean;
}

// GET /api/image/models
// Returns enabled image models merged with admin-configured defaults.
// Requires auth (must be signed in), no admin required.
export async function GET() {
  const now = Date.now();
  if (cache && now < cache.expiresAt) {
    return Response.json({ models: cache.data });
  }

  const configs = await db
    .select()
    .from(imageModelConfig)
    .where(eq(imageModelConfig.enabled, false)); // only fetch disabled ones — rest are enabled by default

  const disabledIds = new Set(configs.filter(c => !c.enabled).map(c => c.id));
  const configMap = new Map(configs.map(c => [c.id, c]));

  const models: ActiveImageModel[] = IMAGE_MODEL_CONFIGS
    .filter(m => !disabledIds.has(m.id))
    .map(m => {
      const cfg = configMap.get(m.id);
      return {
        ...m,
        isDefault: cfg?.isDefault ?? false,
        defaultAspectRatio: cfg?.defaultAspectRatio ?? undefined,
        defaultQuality: (cfg?.defaultQuality as 'medium' | 'high' | undefined) ?? undefined,
        defaultResolution: (cfg?.defaultResolution as '1K' | '2K' | '4K' | undefined) ?? undefined,
        defaultEnablePro: cfg?.defaultEnablePro ?? false,
        defaultGoogleSearch: cfg?.defaultGoogleSearch ?? false,
      };
    });

  cache = { data: models, expiresAt: now + 30_000 };
  return Response.json({ models });
}
