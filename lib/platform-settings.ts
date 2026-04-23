import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { platformSettings } from '@/db/schema';

export type PlatformSettings = {
  guestAccessEnabled: boolean;
  guestStartingCredits: number;
  guestSessionTtlDays: number;
  signupBonusCredits: number;
  requireEmailVerification: boolean;
  guestStarterAgentId: string | null;
  newUserStarterTemplateId: string | null;
  // null = all models available platform-wide
  adminEnabledModelIds: string[] | null;
  instantStockEnabled: boolean;
};

const DEFAULTS: PlatformSettings = {
  guestAccessEnabled: false,
  guestStartingCredits: 20,
  guestSessionTtlDays: 7,
  signupBonusCredits: 100,
  requireEmailVerification: true,
  guestStarterAgentId: null,
  newUserStarterTemplateId: null,
  adminEnabledModelIds: null,
  instantStockEnabled: false,
};

// Simple in-process cache — refreshes after 60 s
let cache: PlatformSettings | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 60_000;

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const now = Date.now();
  if (cache && now - cacheAt < CACHE_TTL_MS) return cache;

  const rows = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.id, 1))
    .limit(1);

  cache = rows[0]
    ? {
        guestAccessEnabled: rows[0].guestAccessEnabled,
        guestStartingCredits: rows[0].guestStartingCredits,
        guestSessionTtlDays: rows[0].guestSessionTtlDays,
        signupBonusCredits: rows[0].signupBonusCredits,
        requireEmailVerification: rows[0].requireEmailVerification,
        guestStarterAgentId: rows[0].guestStarterAgentId,
        newUserStarterTemplateId: rows[0].newUserStarterTemplateId,
        adminEnabledModelIds: rows[0].adminEnabledModelIds ?? null,
        instantStockEnabled: rows[0].instantStockEnabled,
      }
    : { ...DEFAULTS };

  cacheAt = now;
  return cache;
}

export function invalidatePlatformSettingsCache(): void {
  cache = null;
}

export async function updatePlatformSettings(
  patch: Partial<Omit<PlatformSettings, never>>,
): Promise<PlatformSettings> {
  await db
    .insert(platformSettings)
    .values({ id: 1, ...patch })
    .onConflictDoUpdate({
      target: platformSettings.id,
      set: { ...patch, updatedAt: new Date() },
    });

  invalidatePlatformSettingsCache();
  return getPlatformSettings();
}
