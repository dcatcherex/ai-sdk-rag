/**
 * Thin AI SDK adapter for image generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { arrayContains, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { imageModelConfig } from '@/db/schema/admin';
import { KIE_IMAGE_MODELS } from '@/lib/models/kie-image';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { triggerImageGeneration } from './service';

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

const TASK_HINT_VALUES = ['social_post', 'photorealistic', 'illustration', 'edit'] as const;
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
        // Resolve model — priority: explicit modelId > taskHint default > global default > hard fallback
        let modelId = params.modelId;
        let { enablePro } = params;

        if (!modelId) {
          // 1. Task-specific default (admin-configured)
          if (params.taskHint) {
            const [taskModel] = await db
              .select({ id: imageModelConfig.id, defaultEnablePro: imageModelConfig.defaultEnablePro })
              .from(imageModelConfig)
              .where(arrayContains(imageModelConfig.taskDefaults, [params.taskHint]))
              .limit(1);
            if (taskModel) {
              modelId = taskModel.id as typeof imageAgentModelIds[number];
              if (enablePro === undefined) enablePro = taskModel.defaultEnablePro;
            }
          }

          // 2. Global default
          if (!modelId) {
            const [defaultModel] = await db
              .select({ id: imageModelConfig.id, defaultEnablePro: imageModelConfig.defaultEnablePro })
              .from(imageModelConfig)
              .where(eq(imageModelConfig.isDefault, true))
              .limit(1);
            modelId = (defaultModel?.id as typeof imageAgentModelIds[number] | undefined) ?? 'gpt-image/1.5-text-to-image';
            if (enablePro === undefined && defaultModel) enablePro = defaultModel.defaultEnablePro;
          }
        }

        // Apply admin enablePro default for the resolved model when LLM didn't set it
        if (enablePro === undefined) {
          const [adminConfig] = await db
            .select({ defaultEnablePro: imageModelConfig.defaultEnablePro })
            .from(imageModelConfig)
            .where(eq(imageModelConfig.id, modelId))
            .limit(1);
          if (adminConfig) enablePro = adminConfig.defaultEnablePro;
        }

        const sanitizedImageUrls = params.imageUrls?.length
          ? params.imageUrls.map((url, index) =>
              isTemporaryProviderImageUrl(url) && referenceImageUrls?.[index]
                ? referenceImageUrls[index]!
                : url
            )
          : params.imageUrls;

        try {
          const { taskId, generationId } = await triggerImageGeneration(
            { ...params, modelId, enablePro, imageUrls: sanitizedImageUrls, promptTitle: params.prompt.substring(0, 50) },
            userId,
            { threadId, source: source ?? 'agent', referenceImageUrls },
          );
          return {
            started: true,
            status: 'processing' as const,
            taskId,
            generationId,
            startedAt: new Date().toISOString(),
            message: 'Image generation started. The image will appear in this chat when it is ready.',
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
