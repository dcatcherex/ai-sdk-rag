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
import type { messagingApi } from '@line/bot-sdk';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { toolRun } from '@/db/schema';
import { uploadPublicObject } from '@/lib/r2';
import { buildToolSet } from '@/lib/tools/index';
import { buildContentMarketingLineTools } from '@/features/content-marketing/line-tools';
import { buildContentPlannerLineTools } from '@/features/content-calendar/line-tools';
import { buildLineMetricsTools } from '@/features/line-oa/metrics-tools';
import { createLineBrandDraftAgentTools } from '@/features/line-oa/brand-draft/agent';
import { getKieApiKey } from '@/lib/api/routeGuards';
import { completeMediaRun } from '@/lib/generation/complete-media-run';
import { failMediaRun } from '@/lib/generation/fail-media-run';
import { persistToolRunOutputToStorage, persistToolRunOutputsToStorage } from '@/lib/generation/persist-tool-run-output';
import { IMAGE_TASK_HINT_VALUES, resolveAdminImageModel } from '@/features/image/model-selection';
import { triggerImageGeneration } from '@/features/image/service';
import { resolveKieTaskStatus } from '@/app/api/generate/_shared/kieStatus';

export const LINE_IMAGE_MODEL = 'openai/gpt-image-1.5';

const LINE_OVERRIDE_IDS = new Set([
  'image',
  'line_brand_draft',
  'content_marketing',
  'content_planning',
  'line_analytics',
]);

export type LineToolSetOptions = {
  enabledToolIds: string[];
  userId?: string;
  brandId?: string;
  lineUserId: string;
  channelId: string;
  documentIds?: string[];
  rerankEnabled?: boolean;
  threadId?: string;
  lineClient?: messagingApi.MessagingApiClient;
};

export async function pollAndPushGeneratedLineImage(params: {
  lineClient: messagingApi.MessagingApiClient;
  to: string;
  userId: string;
  taskId: string;
  generationId: string;
}) {
  const apiKey = getKieApiKey();
  if (!apiKey) return;

  for (let attempt = 0; attempt < 36; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));

    const result = await resolveKieTaskStatus(params.taskId, 'image', apiKey);
    if (result.status === 'processing') continue;

    if (result.status === 'failed') {
      await failMediaRun({ generationId: params.generationId, errorMessage: result.error });
      await params.lineClient.pushMessage({
        to: params.to,
        messages: [{ type: 'text', text: `Image generation failed: ${result.error}` }],
      });
      return;
    }

    const [record] = await db
      .select()
      .from(toolRun)
      .where(eq(toolRun.id, params.generationId))
      .limit(1);
    const outputJson = (record?.outputJson ?? {}) as Record<string, unknown>;
    const outputUrls = result.outputUrls?.length ? result.outputUrls : [result.outputUrl];
    const latency = record ? Math.round(Date.now() - new Date(record.createdAt).getTime()) : undefined;

    await completeMediaRun({
      generationId: params.generationId,
      outputUrl: result.outputUrl,
      outputUrls,
      latency,
      existingOutputJson: outputJson,
    });

    let finalUrls = outputUrls;
    try {
      if (outputUrls.length > 1) {
        const persisted = await persistToolRunOutputsToStorage({
          generationId: params.generationId,
          toolSlug: 'image',
          userId: params.userId,
          outputJson: {
            ...outputJson,
            output: result.outputUrl,
            outputs: outputUrls,
            ...(latency !== undefined ? { latency } : {}),
          },
          sourceUrls: outputUrls,
        });
        finalUrls = persisted.publicUrls;
      } else {
        const persisted = await persistToolRunOutputToStorage({
          generationId: params.generationId,
          toolSlug: 'image',
          userId: params.userId,
          outputJson: {
            ...outputJson,
            output: result.outputUrl,
            outputs: outputUrls,
            ...(latency !== undefined ? { latency } : {}),
          },
          sourceUrl: result.outputUrl,
        });
        finalUrls = [persisted.publicUrl];
      }
    } catch (persistError) {
      console.error('[LINE] image persist failed:', persistError);
    }

    await params.lineClient.pushMessage({
      to: params.to,
      messages: finalUrls
        .slice(0, 5)
        .map((url) => ({ type: 'image', originalContentUrl: url, previewImageUrl: url })),
    });
    return;
  }
}

export function buildLineToolSet({
  enabledToolIds,
  userId,
  brandId,
  lineUserId,
  channelId,
  documentIds,
  rerankEnabled,
  threadId,
  lineClient,
}: LineToolSetOptions): ToolSet {
  const result: ToolSet = {};

  if (!userId) {
    Object.assign(result, createLineBrandDraftAgentTools({ lineUserId, channelId }));
  }

  result.generate_image = tool({
    description:
      'Generate or edit an image from a prompt and deliver it to the user. Accepts reference image URLs, aspect ratio, and task hints for branded social posts. ' +
      'If canonical brand context is already present, use that first. Only call the LINE brand draft tools when the user is unlinked and no canonical brand context is available.',
    inputSchema: z.object({
      prompt: z.string().describe(
        'Full image prompt including brand style, colors, content details, and composition',
      ),
      taskHint: z.enum(IMAGE_TASK_HINT_VALUES).optional().describe('Use "social_post" for branded ads/social posts and "edit" when reference images are supplied.'),
      modelId: z.string().optional().describe('Optional explicit image model ID. Prefer taskHint unless the user names a model.'),
      aspectRatio: z.string().optional().describe('Aspect ratio such as "4:5", "1:1", or "16:9".'),
      quality: z.enum(['medium', 'high']).optional(),
      imageUrls: z.array(z.string()).optional().describe('Reference images for editing or branded social post generation.'),
    }),
    async execute(params) {
      if (userId && lineClient) {
        const selection = await resolveAdminImageModel({
          explicitModelId: params.modelId,
          taskHint: params.taskHint,
        });
        const { taskId, generationId } = await triggerImageGeneration(
          {
            prompt: params.prompt,
            modelId: selection.modelId,
            enablePro: selection.enablePro,
            promptTitle: params.prompt.substring(0, 50),
            ...(params.taskHint ? { taskHint: params.taskHint } : {}),
            ...(params.aspectRatio ? { aspectRatio: params.aspectRatio } : {}),
            ...(params.quality ? { quality: params.quality } : {}),
            ...(params.imageUrls?.length ? { imageUrls: params.imageUrls } : {}),
          },
          userId,
          { threadId, source: 'agent', referenceImageUrls: params.imageUrls },
        );

        void pollAndPushGeneratedLineImage({
          lineClient,
          to: lineUserId,
          userId,
          taskId,
          generationId,
        }).catch((err) => console.error('[LINE] async image delivery failed:', err));

        return {
          started: true,
          status: 'processing' as const,
          taskId,
          generationId,
          message: 'Image generation started. The image will be sent to this LINE chat when it is ready.',
        };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const imageResult = await generateImage({ model: LINE_IMAGE_MODEL as any, prompt: params.prompt });
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
    const { generate_image: _ignoredGenerateImage, ...contentMarketingTools } = buildContentMarketingLineTools(userId ?? null);
    Object.assign(result, contentMarketingTools);
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
          brandId,
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
