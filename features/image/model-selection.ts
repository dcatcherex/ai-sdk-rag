import 'server-only';

import { arrayContains, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { imageModelConfig } from '@/db/schema/admin';

export const IMAGE_TASK_HINT_VALUES = ['social_post', 'photorealistic', 'illustration', 'edit'] as const;
export type ImageTaskHint = typeof IMAGE_TASK_HINT_VALUES[number];

type ResolveAdminImageModelInput = {
  explicitModelId?: string;
  taskHint?: ImageTaskHint;
  fallbackModelId?: string;
};

export async function resolveAdminImageModel({
  explicitModelId,
  taskHint,
  fallbackModelId = 'gpt-image/1.5-text-to-image',
}: ResolveAdminImageModelInput): Promise<{ modelId: string; enablePro?: boolean }> {
  if (explicitModelId) {
    const [adminConfig] = await db
      .select({ defaultEnablePro: imageModelConfig.defaultEnablePro })
      .from(imageModelConfig)
      .where(eq(imageModelConfig.id, explicitModelId))
      .limit(1);

    return {
      modelId: explicitModelId,
      ...(adminConfig ? { enablePro: adminConfig.defaultEnablePro } : {}),
    };
  }

  if (taskHint) {
    const [taskModel] = await db
      .select({ id: imageModelConfig.id, defaultEnablePro: imageModelConfig.defaultEnablePro })
      .from(imageModelConfig)
      .where(arrayContains(imageModelConfig.taskDefaults, [taskHint]))
      .limit(1);

    if (taskModel) {
      return {
        modelId: taskModel.id,
        enablePro: taskModel.defaultEnablePro,
      };
    }
  }

  const [defaultModel] = await db
    .select({ id: imageModelConfig.id, defaultEnablePro: imageModelConfig.defaultEnablePro })
    .from(imageModelConfig)
    .where(eq(imageModelConfig.isDefault, true))
    .limit(1);

  if (defaultModel) {
    return {
      modelId: defaultModel.id,
      enablePro: defaultModel.defaultEnablePro,
    };
  }

  return { modelId: fallbackModelId };
}

export function inferChatImageTaskHint(input: {
  prompt?: string | null;
  hasImages: boolean;
  hasActiveBrand: boolean;
}): ImageTaskHint | undefined {
  if (input.hasImages) return 'edit';

  const prompt = input.prompt?.toLowerCase() ?? '';
  const socialPattern =
    /\b(social|post|banner|ad|ads|advert|advertisement|facebook|instagram|ig|reel|story|poster|flyer|thumbnail|campaign|marketing|caption|headline|cta|promo|promotion)\b|โพสต์|โฆษณา|แบนเนอร์|โปรโมท|โปรโมชัน|คอนเทนต์/;

  if (socialPattern.test(prompt)) return 'social_post';
  if (input.hasActiveBrand) return 'social_post';

  return undefined;
}
