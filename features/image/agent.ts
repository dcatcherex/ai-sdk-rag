/**
 * Thin AI SDK adapter for image generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { KIE_IMAGE_MODELS } from '@/lib/models/kie-image';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { getPlatformSettings } from '@/lib/platform-settings';
import { getStockImages, recordStockUsage } from './stock-service';
import { triggerImageGeneration } from './service';
import { IMAGE_TASK_HINT_VALUES, resolveAdminImageModel } from './model-selection';
import { buildReferencePreviewItems } from './reference-previews';

const imageAgentModelIds = KIE_IMAGE_MODELS.map((model) => model.id) as [string, ...string[]];

function isTemporaryProviderImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();
    return (
      hostname.endsWith('oaiusercontent.com') ||
      hostname.endsWith('oausercontent.com') ||
      (hostname === 'storage.googleapis.com' && pathname.includes('/generativeai-filters/'))
    );
  } catch {
    return false;
  }
}

const TASK_HINT_VALUES = IMAGE_TASK_HINT_VALUES;
type TaskHint = typeof TASK_HINT_VALUES[number];

const TASK_HINT_DESCRIPTIONS: Record<TaskHint, string> = {
  social_post:    'Social media posts, marketing banners, designed graphics — anything needing visible text, brand colors, or composed layout',
  photorealistic: 'Realistic photos, portraits, product shots, lifestyle scenes',
  illustration:   'Artistic illustrations, anime, concept art, stylized visuals',
  edit:           'Edit or transform an existing image (image-to-image)',
};

export function createImageAgentTools(ctx: Pick<AgentToolContext, 'userId' | 'threadId' | 'referenceImageUrls' | 'source'>) {
  const { userId, threadId, referenceImageUrls, source } = ctx;

  const taskHintGuide = TASK_HINT_VALUES
    .map(t => `  • "${t}" — ${TASK_HINT_DESCRIPTIONS[t]}`)
    .join('\n');

  return {
    generate_image: tool({
      description:
        'Generate or edit an image. Use taskHint to let the platform pick the admin-configured model for the job — no need to know model names.\n' +
        'TASK HINT GUIDE (prefer taskHint over modelId unless the user explicitly names a model):\n' +
        taskHintGuide + '\n' +
        'For best prompts include: subject, style, composition, colors, AND any text that should appear on the image. ' +
        'Generation starts async — the UI shows a waiting state then displays the image inline when ready. ' +
        'IMPORTANT: If the result contains errorType "reference_image_inaccessible", stop and ask the user to re-upload the image or confirm text-only generation.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Detailed image description. Include subject, style, composition, location, and any text to render.'),
        taskHint: z.enum(TASK_HINT_VALUES).optional().describe(
          'Task type — platform picks the admin-configured model. ' +
          TASK_HINT_VALUES.map(t => `"${t}": ${TASK_HINT_DESCRIPTIONS[t]}`).join('; ')
        ),
        modelId: z.enum(imageAgentModelIds).optional().describe('Explicit model override — only use when the user specifically requests a model.'),
        aspectRatio: z.string().optional().describe('Aspect ratio e.g. "16:9", "1:1", "9:16"'),
        quality: z.enum(['medium', 'high']).optional().describe('Quality for GPT Image models'),
        enablePro: z.boolean().optional().describe('Enable pro/quality mode for Grok Imagine models'),
        imageUrls: z.array(z.string()).optional().describe('Reference images for style guidance or editing. Include: (1) user-uploaded images when editing, (2) active brand style-reference assets when branded output should match the canonical brand visual identity.'),
      }),
      async execute(params) {
        const adminSelection = await resolveAdminImageModel({
          explicitModelId: params.modelId,
          taskHint: params.taskHint,
        });
        const modelId = adminSelection.modelId as typeof imageAgentModelIds[number];
        const enablePro = params.enablePro ?? adminSelection.enablePro;

        const sanitizedImageUrls = params.imageUrls?.length
          ? params.imageUrls.map((url, index) =>
              isTemporaryProviderImageUrl(url) && referenceImageUrls?.[index]
                ? referenceImageUrls[index]!
                : url
            )
          : params.imageUrls;
        const referenceImages = buildReferencePreviewItems(sanitizedImageUrls);

        try {
          const { taskId, generationId } = await triggerImageGeneration(
            {
              ...params, modelId, enablePro, imageUrls: sanitizedImageUrls,
              promptTitle: params.prompt.substring(0, 50),
              taskHint: params.taskHint,
            },
            userId,
            { threadId, source: source ?? 'agent', referenceImageUrls },
          );

          // Instant stock preview — serve 2 stock images immediately while personalizing in background
          const platformSettings = await getPlatformSettings();
          let stockImageUrls: string[] | undefined;
          let stockThumbnailUrls: string[] | undefined;
          if (platformSettings.instantStockEnabled) {
            const stockItems = await getStockImages(params.taskHint, params.aspectRatio, 2);
            if (stockItems.length > 0) {
              stockImageUrls = stockItems.map(s => s.imageUrl);
              stockThumbnailUrls = stockItems.map(s => s.thumbnailUrl ?? s.imageUrl);
              recordStockUsage(stockImageUrls);
            }
          }

          return {
            started: true,
            status: 'processing' as const,
            taskId,
            generationId,
            startedAt: new Date().toISOString(),
            ...(referenceImages.length ? { referenceImages } : {}),
            ...(stockImageUrls?.length ? { stockImageUrls, stockThumbnailUrls } : {}),
            message: stockImageUrls?.length
              ? 'Image generation started. Showing similar images from our library while your personalized image is being created.'
              : 'Image generation started. The image will appear in this chat when it is ready.',
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error';
          const isRefImageError = message.includes('Reference image') || message.includes('no longer accessible') || message.includes('re-upload');
          if (isRefImageError) {
            return {
              error: true,
              errorType: 'reference_image_inaccessible' as const,
              message,
              instruction: 'STOP. Do not retry without the reference image. Inform the user that the reference image could not be loaded, then ask: do they want to re-upload the image, or proceed with text-only generation using just the prompt description?',
            };
          }
          throw err;
        }
      },
    }),
  };
}
