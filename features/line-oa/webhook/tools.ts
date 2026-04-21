/**
 * LINE tool set builder.
 *
 * Mirrors buildToolSet() from lib/tools/index.ts but adapted for LINE:
 *   - Base/registry tools (weather, knowledge_base, exam_prep, certificate, …) via buildToolSet()
 *     — only when a linked userId is available.
 *   - LINE-specific overrides for tools that need lineUserId context or LINE-formatted output:
 *       brand_profile, generate_image, content_marketing, content_planning, line_analytics
 *
 * Usage in handleMessageEvent:
 *   const tools = buildLineToolSet({ enabledToolIds, userId, lineUserId, channelId, threadId });
 */

import { generateImage, tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';
import { uploadPublicObject } from '@/lib/r2';
import { buildToolSet } from '@/lib/tools/index';
import { buildContentMarketingLineTools } from '@/features/content-marketing/line-tools';
import { buildContentPlannerLineTools } from '@/features/content-calendar/line-tools';
import { buildLineMetricsTools } from '@/features/line-oa/metrics-tools';
import { createBrandProfileAgentTools } from '@/features/brand-profile/agent';

/** Model used for all LINE image generation */
export const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

/** Tool IDs handled by LINE-specific builders — excluded from the base buildToolSet() call */
const LINE_OVERRIDE_IDS = new Set([
  'brand_profile',
  'content_marketing',
  'content_planning',
  'line_analytics',
]);

export type LineToolSetOptions = {
  /** All enabled tool IDs for the active agent (agent.enabledTools + skillToolIds) */
  enabledToolIds: string[];
  /** Linked Vaja account user ID — undefined for non-linked LINE users */
  userId?: string;
  /** LINE user ID — always present */
  lineUserId: string;
  /** LINE OA channel ID — always present */
  channelId: string;
  /** Document IDs for knowledge base scoping */
  documentIds?: string[];
  rerankEnabled?: boolean;
  threadId?: string;
};

export function buildLineToolSet({
  enabledToolIds,
  userId,
  lineUserId,
  channelId,
  documentIds,
  rerankEnabled,
  threadId,
}: LineToolSetOptions): ToolSet {
  const result: ToolSet = {};

  // ── Brand profile: always available, LINE-aware (supports lineUserId + channelId) ──
  Object.assign(result, createBrandProfileAgentTools({ userId, lineUserId, channelId }));

  // ── Image generation: always available ──
  // The LLM is instructed to call get_brand_profile first and embed brand context in the prompt.
  result.generate_image = tool({
    description:
      'Generate an image from a prompt and deliver it to the user. ' +
      'Always call get_brand_profile first and incorporate brand colors, visual style, and tone into the prompt.',
    inputSchema: z.object({
      prompt: z.string().describe(
        'Full image prompt including brand style, colors, content details, and composition',
      ),
    }),
    async execute({ prompt }) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageResult = await generateImage({ model: LINE_IMAGE_MODEL as any, prompt });
      const { base64, mediaType } = imageResult.image;
      const ext = mediaType.includes('png') ? 'png' : 'jpg';
      const key = `line-images/${crypto.randomUUID()}.${ext}`;
      const { url } = await uploadPublicObject({
        key,
        body: Buffer.from(base64, 'base64'),
        contentType: mediaType,
      });
      return { imageUrl: url };
    },
  });

  // ── LINE-specific tool overrides (LINE-formatted output, accept nullable userId) ──
  if (enabledToolIds.includes('content_marketing')) {
    Object.assign(result, buildContentMarketingLineTools(userId ?? null));
  }
  if (enabledToolIds.includes('content_planning')) {
    Object.assign(result, buildContentPlannerLineTools(userId ?? null));
  }
  if (enabledToolIds.includes('line_analytics')) {
    Object.assign(result, buildLineMetricsTools(userId ?? null, channelId));
  }

  // ── Base registry tools (weather, knowledge_base, exam_prep, certificate, …) ──
  // Requires a linked userId — skipped for non-linked LINE users.
  if (userId) {
    const baseIds = enabledToolIds.filter((id) => !LINE_OVERRIDE_IDS.has(id));
    if (baseIds.length > 0) {
      Object.assign(
        result,
        buildToolSet({
          enabledToolIds: baseIds,
          userId,
          documentIds,
          rerankEnabled,
          threadId,
          source: 'agent',
        }),
      );
    }
  }

  return result;
}
