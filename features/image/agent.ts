/**
 * Thin AI SDK adapter for image generation.
 * Option B: fire + redirect — starts generation and returns a link to the tool page.
 * All business logic lives in service.ts.
 */

import { tool } from 'ai';
import { z } from 'zod';
import type { AgentToolContext } from '@/features/tools/registry/types';
import { triggerImageGeneration } from './service';

export function createImageAgentTools(ctx: Pick<AgentToolContext, 'userId'>) {
  const { userId } = ctx;

  return {
    generate_image: tool({
      description:
        'Generate or edit an image using KIE AI models (Nano Banana 2, GPT Image 1.5, Qwen Z-Image, Grok Imagine, etc.). ' +
        'For best results include: subject, composition, action, location, and style in the prompt. ' +
        'Starts the generation asynchronously. The chat UI will show a waiting state, then display the final image inline when it is ready. ' +
        'Use this when the user asks to create, draw, generate, or edit an image.',
      inputSchema: z.object({
        prompt: z.string().min(1).describe('Detailed image description. Include subject, style, composition, location.'),
        modelId: z.enum([
          'nano-banana-2',
          'gpt-image/1.5-text-to-image',
          'gpt-image/1.5-image-to-image',
          'z-image',
          'qwen/image-edit',
          'grok-imagine/text-to-image',
          'grok-imagine/image-to-image',
        ]).optional().default('grok-imagine/text-to-image').describe('Model to use. Default: grok-imagine/text-to-image'),
        aspectRatio: z.string().optional().describe('Aspect ratio e.g. "16:9", "1:1", "9:16"'),
        quality: z.enum(['medium', 'high']).optional().describe('Quality for GPT Image models'),
        enablePro: z.boolean().optional().default(true).describe('Enable pro/quality mode for Grok Imagine models. Default: true'),
        imageUrls: z.array(z.string()).optional().describe('Optional reference or edit images. Use these when the user uploaded or selected images for the next generation.'),
      }),
      async execute(params) {
        const { taskId, generationId } = await triggerImageGeneration(
          { ...params, promptTitle: params.prompt.substring(0, 50) },
          userId,
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
