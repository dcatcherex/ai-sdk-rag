/**
 * LINE tool set builder.
 *
 * Mirrors buildToolSet() from lib/tools/index.ts but adapted for LINE:
 *   - Base/registry tools via buildToolSet() when a linked userId is available.
 *   - LINE-specific overrides for unlinked draft handling and LINE-formatted output.
 */

import { generateImage, tool } from 'ai';
import { z } from 'zod';
import type { ToolSet } from 'ai';
import { uploadPublicObject } from '@/lib/r2';
import { buildToolSet } from '@/lib/tools/index';
import { buildContentMarketingLineTools } from '@/features/content-marketing/line-tools';
import { buildContentPlannerLineTools } from '@/features/content-calendar/line-tools';
import { buildLineMetricsTools } from '@/features/line-oa/metrics-tools';
import { createLineBrandDraftAgentTools } from '@/features/line-oa/brand-draft/agent';

export const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

const LINE_OVERRIDE_IDS = new Set([
  'line_brand_draft',
  'content_marketing',
  'content_planning',
  'line_analytics',
]);

export type LineToolSetOptions = {
  enabledToolIds: string[];
  userId?: string;
  lineUserId: string;
  channelId: string;
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

  if (!userId) {
    Object.assign(result, createLineBrandDraftAgentTools({ lineUserId, channelId }));
  }

  result.generate_image = tool({
    description:
      'Generate an image from a prompt and deliver it to the user. ' +
      'If canonical brand context is already present, use that first. Only call the LINE brand draft tools when the user is unlinked and no canonical brand context is available.',
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

  if (enabledToolIds.includes('content_marketing')) {
    Object.assign(result, buildContentMarketingLineTools(userId ?? null));
  }
  if (enabledToolIds.includes('content_planning')) {
    Object.assign(result, buildContentPlannerLineTools(userId ?? null));
  }
  if (enabledToolIds.includes('line_analytics')) {
    Object.assign(result, buildLineMetricsTools(userId ?? null, channelId));
  }

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
