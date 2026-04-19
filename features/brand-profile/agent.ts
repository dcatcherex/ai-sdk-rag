/**
 * Thin AI SDK adapter for brand profile tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { getBrandProfileInputSchema, saveBrandProfileInputSchema } from './schema';
import { runGetBrandProfile, runSaveBrandProfile } from './service';

export function createBrandProfileAgentTools(
  ctx: { userId?: string; lineUserId?: string; channelId?: string },
) {
  const brandCtx = {
    userId: ctx.userId || undefined,
    lineUserId: ctx.lineUserId,
    channelId: ctx.channelId,
  };

  return {
    get_brand_profile: tool({
      description:
        'Retrieve the stored brand profile for this user. Call this FIRST before generating any marketing or content output. If required fields are missing (products, tone), ask the user for them one at a time and save each answer with save_brand_profile before proceeding.',
      inputSchema: getBrandProfileInputSchema,
      async execute(input) {
        return { success: true, ...(await runGetBrandProfile(input, brandCtx)) };
      },
    }),

    save_brand_profile: tool({
      description:
        'Save a single brand profile field. Call this immediately after the user provides a value. Fields: brand_name, products, tone, target_audience (required) — usp, price_range, competitors, keywords (optional).',
      inputSchema: saveBrandProfileInputSchema,
      async execute(input) {
        return { success: true, ...(await runSaveBrandProfile(input, brandCtx)) };
      },
    }),
  };
}
