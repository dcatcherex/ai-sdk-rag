/**
 * Thin AI SDK adapter for brand profile tools.
 * All logic lives in service.ts — this file only wires up tool() definitions.
 */

import { tool } from 'ai';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { getBrandProfileInputSchema, saveBrandProfileInputSchema, addStyleReferenceInputSchema, removeStyleReferenceInputSchema } from './schema';
import { runGetBrandProfile, runSaveBrandProfile, runAddStyleReference, runRemoveStyleReference } from './service';

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
        'Save a single brand profile field. Call this immediately after the user provides a value. Fields: brand_name, products, tone, target_audience (required) — usp, price_range, competitors, keywords, visual_style, color_palette, style_reference_mode, style_description (optional). Do NOT use this for style reference images — use add_style_reference / remove_style_reference instead.',
      inputSchema: saveBrandProfileInputSchema,
      async execute(input) {
        return { success: true, ...(await runSaveBrandProfile(input, brandCtx)) };
      },
    }),

    add_style_reference: tool({
      description:
        'Add an image to the brand style reference collection. Only call this when you have a confirmed https:// image URL from user_attached_images in the current message context. If no URL is available, tell the user to upload directly via the Brand Profile → Style tab instead.',
      inputSchema: addStyleReferenceInputSchema,
      async execute(input) {
        return { success: true, ...(await runAddStyleReference(input, brandCtx)) };
      },
    }),

    remove_style_reference: tool({
      description: 'Remove a specific image URL from the brand style reference collection.',
      inputSchema: removeStyleReferenceInputSchema,
      async execute(input) {
        return { success: true, ...(await runRemoveStyleReference(input, brandCtx)) };
      },
    }),
  };
}
