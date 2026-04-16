/**
 * Thin AI SDK adapter for image generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import { z } from 'zod';
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

export function createImageAgentTools(ctx: Pick<AgentToolContext, 'userId' | 'threadId' | 'referenceImageUrls' | 'source'>) {
  const { userId, threadId, referenceImageUrls, source } = ctx;

  return {
    generate_image: tool({
      description:
        'Generate or edit an image using KIE AI models (Nano Banana 2, GPT Image 1.5, Qwen Z-Image, Grok Imagine, etc.). ' +
        'For best results include: subject, composition, action, location, and style in the prompt. ' +
        'Starts the generation asynchronously. The chat UI will show a waiting state, then display the final image inline when it is ready. ' +
        'Use this when the user asks to create, draw, generate, or edit an image.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Detailed image description. Include subject, style, composition, location.'),
        modelId: z.enum(imageAgentModelIds).optional().default('grok-imagine/text-to-image').describe('Model to use. Default: grok-imagine/text-to-image'),
        aspectRatio: z.string().optional().describe('Aspect ratio e.g. "16:9", "1:1", "9:16"'),
        quality: z.enum(['medium', 'high']).optional().describe('Quality for GPT Image models'),
        enablePro: z.boolean().optional().describe('Enable pro/quality mode for Grok Imagine models'),
        imageUrls: z.array(z.string()).optional().describe('Optional reference or edit images. Use these when the user uploaded or selected images for the next generation.'),
      }),
      async execute(params) {
        const sanitizedImageUrls = params.imageUrls?.length
          ? params.imageUrls.map((url, index) =>
              isTemporaryProviderImageUrl(url) && referenceImageUrls?.[index]
                ? referenceImageUrls[index]!
                : url
            )
          : params.imageUrls;
        const { taskId, generationId } = await triggerImageGeneration(
          { ...params, imageUrls: sanitizedImageUrls, promptTitle: params.prompt.substring(0, 50) },
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
      },
    }),
  };
}
